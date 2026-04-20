"""
Screenshot Capture & Sync Client for Windows 11
Runs in background, listens for global hotkey, captures screen, uploads to server.
"""

import sys
import os
import io
import time
import uuid
import json
import queue
import ctypes
import logging
import threading
import datetime
import configparser
from pathlib import Path

import requests
from PIL import ImageGrab, Image
import keyboard
import pystray
from pystray import MenuItem as item
from PIL import Image as PILImage

# ─── Logging Setup ────────────────────────────────────────────────────────────
LOG_DIR = Path.home() / "AppData" / "Local" / "ScreenshotSync"
LOG_DIR.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_DIR / "client.log"),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger("ScreenshotSync")

# ─── Default Config ───────────────────────────────────────────────────────────
DEFAULT_CONFIG = {
    "capture": {
        "hotkey": "Win+Alt+C",
        "mode": "all",           # "all" = all monitors, "primary" = primary only
        "format": "png",         # png gives the highest screenshot fidelity
        "quality": "100",        # kept at 100 if the user switches back to jpeg
        "merge_monitors": "true",
        "profile": "max_quality_v1",
    },
    "upload": {
        "endpoint": "http://localhost:3000/upload",
        "device_id": str(uuid.uuid4()),
        "max_queue_size": "100",
        "max_retries": "5",
        "retry_base_delay": "2",  # seconds
        "timeout": "30",
    },
    "storage": {
        "queue_dir": str(LOG_DIR / "queue"),
        "keep_on_success": "false",
    },
}


def upgrade_capture_quality(cfg: configparser.ConfigParser) -> bool:
    """One-time migration that moves existing clients to the highest-quality capture profile."""
    target_profile = DEFAULT_CONFIG["capture"]["profile"]
    current_profile = cfg.get("capture", "profile", fallback="")
    if current_profile == target_profile:
        return False

    current_format = cfg.get("capture", "format", fallback="jpeg").strip().lower()
    current_quality = cfg.get("capture", "quality", fallback="85").strip()

    # This migration intentionally upgrades legacy lossy defaults to lossless PNG.
    if current_format in {"jpeg", "jpg", "png"}:
        cfg.set("capture", "format", "png")
        cfg.set("capture", "quality", "100")
        cfg.set("capture", "profile", target_profile)
        log.info(
            "Capture quality upgraded to the max-quality profile (PNG, lossless screenshots)."
        )
        return True

    if current_quality != "100":
        cfg.set("capture", "quality", "100")
        cfg.set("capture", "profile", target_profile)
        log.info("JPEG quality upgraded to 100 for the active capture profile.")
        return True

    cfg.set("capture", "profile", target_profile)
    return True


def load_config() -> configparser.ConfigParser:
    cfg_path = LOG_DIR / "config.ini"
    cfg = configparser.ConfigParser()
    cfg.read_dict(DEFAULT_CONFIG)
    changed = False
    if cfg_path.exists():
        cfg.read(cfg_path)
    else:
        changed = True
        log.info(f"Default config prepared for {cfg_path}")

    if upgrade_capture_quality(cfg):
        changed = True

    if changed:
        with open(cfg_path, "w") as f:
            cfg.write(f)
        log.info(f"Capture config saved to {cfg_path}")
    return cfg


class SingleInstanceGuard:
    """Windows named mutex so only one background client can register the hotkey."""

    _ERROR_ALREADY_EXISTS = 183

    def __init__(self, name: str):
        self._handle = ctypes.windll.kernel32.CreateMutexW(None, False, name)
        self.already_running = ctypes.windll.kernel32.GetLastError() == self._ERROR_ALREADY_EXISTS

    def close(self):
        if self._handle:
            ctypes.windll.kernel32.CloseHandle(self._handle)
            self._handle = None


# ─── Queue Manager ────────────────────────────────────────────────────────────
class PersistentQueue:
    """File-backed queue so captures survive crashes/restarts."""

    def __init__(self, queue_dir: str, max_size: int = 100):
        self.dir = Path(queue_dir)
        self.dir.mkdir(parents=True, exist_ok=True)
        self.max_size = max_size
        self._lock = threading.Lock()

    def enqueue(self, image_bytes: bytes, metadata: dict) -> str | None:
        with self._lock:
            items = self._list_items()
            if len(items) >= self.max_size:
                log.warning("Queue full — dropping oldest item")
                oldest = items[0]
                oldest_meta_path = self.dir / f"{oldest}.json"
                oldest_ext = "jpeg"
                if oldest_meta_path.exists():
                    try:
                        oldest_meta = json.loads(oldest_meta_path.read_text())
                        oldest_ext = oldest_meta.get("format", "jpeg")
                    except Exception as e:
                        log.warning(f"Could not parse metadata for dropped queue item {oldest}: {e}")
                (self.dir / f"{oldest}.{oldest_ext}").unlink(missing_ok=True)
                oldest_meta_path.unlink(missing_ok=True)

            item_id = str(uuid.uuid4())
            ext = metadata.get("format", "jpeg")
            img_path = self.dir / f"{item_id}.{ext}"
            meta_path = self.dir / f"{item_id}.json"

            img_path.write_bytes(image_bytes)
            meta_path.write_text(json.dumps(metadata))
            log.info(f"Enqueued {item_id} ({len(image_bytes)//1024} KB)")
            return item_id

    def peek_all(self) -> list[tuple[str, bytes, dict]]:
        """Return all queued items as (id, image_bytes, metadata)."""
        results = []
        with self._lock:
            for item_id in self._list_items():
                try:
                    meta_path = self.dir / f"{item_id}.json"
                    meta = json.loads(meta_path.read_text())
                    ext = meta.get("format", "jpeg")
                    img_path = self.dir / f"{item_id}.{ext}"
                    results.append((item_id, img_path.read_bytes(), meta))
                except Exception as e:
                    log.error(f"Error reading queue item {item_id}: {e}")
        return results

    def remove(self, item_id: str, meta: dict):
        with self._lock:
            ext = meta.get("format", "jpeg")
            (self.dir / f"{item_id}.{ext}").unlink(missing_ok=True)
            (self.dir / f"{item_id}.json").unlink(missing_ok=True)

    def size(self) -> int:
        with self._lock:
            return len(self._list_items())

    def _list_items(self) -> list[str]:
        return [
            p.stem
            for p in sorted(self.dir.glob("*.json"), key=lambda path: path.stat().st_mtime)
        ]


# ─── Screenshot Capture ───────────────────────────────────────────────────────
class ScreenCapture:
    def __init__(self, cfg: configparser.ConfigParser):
        self.mode = cfg.get("capture", "mode")
        self.fmt = cfg.get("capture", "format").lower()
        self.quality = cfg.getint("capture", "quality")
        self.merge = cfg.getboolean("capture", "merge_monitors")

    def capture(self) -> list[tuple[bytes, str]]:
        """Returns list of (image_bytes, label) tuples."""
        results = []
        try:
            if self.mode == "primary":
                screenshots = [("primary", ImageGrab.grab())]
            else:
                # Capture all monitors by grabbing the bounding box of all screens
                try:
                    import ctypes
                    from screeninfo import get_monitors
                    monitors = get_monitors()
                    if self.merge or len(monitors) == 1:
                        screenshots = [("all", ImageGrab.grab(all_screens=True))]
                    else:
                        screenshots = []
                        for i, m in enumerate(monitors):
                            bbox = (m.x, m.y, m.x + m.width, m.y + m.height)
                            img = ImageGrab.grab(bbox=bbox, all_screens=True)
                            screenshots.append((f"monitor_{i}", img))
                except ImportError:
                    screenshots = [("all", ImageGrab.grab(all_screens=True))]

            for label, img in screenshots:
                buf = io.BytesIO()
                if self.fmt == "jpeg":
                    img = img.convert("RGB")
                    img.save(buf, format="JPEG", quality=self.quality, optimize=True, subsampling=0)
                else:
                    img.save(buf, format="PNG", optimize=True)
                image_bytes = buf.getvalue()
                if not image_bytes:
                    log.warning(f"Skipping empty capture payload for {label}")
                    continue
                results.append((image_bytes, label))

        except Exception as e:
            log.error(f"Capture failed: {e}")

        return results


# ─── Uploader ─────────────────────────────────────────────────────────────────
class Uploader:
    def __init__(self, cfg: configparser.ConfigParser, pq: PersistentQueue):
        self.endpoint = cfg.get("upload", "endpoint")
        self.device_id = cfg.get("upload", "device_id")
        self.max_retries = cfg.getint("upload", "max_retries")
        self.base_delay = cfg.getfloat("upload", "retry_base_delay")
        self.timeout = cfg.getint("upload", "timeout")
        self.pq = pq
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._worker, daemon=True, name="Uploader")

    def start(self):
        self._thread.start()
        log.info("Uploader thread started")

    def stop(self):
        self._stop.set()

    def _worker(self):
        while not self._stop.is_set():
            try:
                items = self.pq.peek_all()
                if not items:
                    time.sleep(2)
                    continue

                for item_id, image_bytes, meta in items:
                    if self._stop.is_set():
                        break
                    success = self._upload_with_retry(item_id, image_bytes, meta)
                    if success:
                        self.pq.remove(item_id, meta)

            except Exception as e:
                log.error(f"Uploader worker error: {e}")
            time.sleep(1)

    def _upload_with_retry(self, item_id: str, image_bytes: bytes, meta: dict) -> bool:
        fmt = meta.get("format", "jpeg")
        mime = "image/jpeg" if fmt == "jpeg" else "image/png"

        for attempt in range(1, self.max_retries + 1):
            try:
                files = {"screenshot": (f"{item_id}.{fmt}", image_bytes, mime)}
                data = {
                    "id": item_id,
                    "device_id": self.device_id,
                    "timestamp": meta.get("timestamp", ""),
                    "label": meta.get("label", ""),
                }
                resp = requests.post(
                    self.endpoint,
                    files=files,
                    data=data,
                    timeout=self.timeout,
                )
                if resp.status_code in (200, 201, 409):  # 409 = duplicate (idempotent)
                    log.info(f"Uploaded {item_id} (attempt {attempt})")
                    return True
                else:
                    log.warning(f"Upload {item_id} got HTTP {resp.status_code} (attempt {attempt})")

            except requests.exceptions.RequestException as e:
                log.warning(f"Upload {item_id} failed attempt {attempt}: {e}")

            if attempt < self.max_retries:
                delay = self.base_delay * (2 ** (attempt - 1))  # exponential backoff
                log.info(f"Retrying {item_id} in {delay:.1f}s")
                time.sleep(delay)

        log.error(f"Giving up on {item_id} after {self.max_retries} attempts — stays in queue")
        return False


# ─── System Tray Icon ─────────────────────────────────────────────────────────
def make_tray_icon(app: "ScreenshotSyncApp"):
    """Create a simple colored icon for the system tray."""
    size = 64
    img = PILImage.new("RGBA", (size, size), (0, 0, 0, 0))
    from PIL import ImageDraw
    draw = ImageDraw.Draw(img)
    # Draw a camera-like icon
    draw.rectangle([8, 18, 56, 50], fill=(41, 128, 185), outline=(255,255,255), width=2)
    draw.ellipse([22, 24, 42, 44], fill=(255, 255, 255))
    draw.ellipse([28, 30, 36, 38], fill=(41, 128, 185))
    draw.rectangle([38, 14, 48, 20], fill=(41, 128, 185), outline=(255,255,255), width=1)
    return img


class ScreenshotSyncApp:
    def __init__(self):
        self.cfg = load_config()
        self.pq = PersistentQueue(
            self.cfg.get("storage", "queue_dir"),
            self.cfg.getint("upload", "max_queue_size"),
        )
        self.capture = ScreenCapture(self.cfg)
        self.uploader = Uploader(self.cfg, self.pq)
        self.hotkey = self.cfg.get("capture", "hotkey")
        self.hotkey_cooldown = 0.75
        self.empty_capture_retry_delay = 0.2
        self._capturing = False
        self._capture_lock = threading.Lock()
        self._last_hotkey_at = 0.0
        self._tray = None

    def on_hotkey(self):
        now = time.monotonic()
        should_start = False

        with self._capture_lock:
            if self._capturing:
                log.info("Ignoring hotkey because a capture is already in progress")
                return

            if now - self._last_hotkey_at < self.hotkey_cooldown:
                log.info("Ignoring duplicate hotkey trigger inside cooldown window")
                return

            self._capturing = True
            self._last_hotkey_at = now
            should_start = True

        if should_start:
            threading.Thread(target=self._do_capture, daemon=True, name="CaptureWorker").start()

    def _capture_with_retry(self) -> list[tuple[bytes, str]]:
        shots = self.capture.capture()
        if shots:
            return shots

        log.warning("Capture returned no screenshots on the first attempt; retrying once")
        time.sleep(self.empty_capture_retry_delay)
        return self.capture.capture()

    def _do_capture(self):
        try:
            start = time.perf_counter()
            shots = self._capture_with_retry()
            if not shots:
                log.warning("No screenshots were captured after retry; nothing will be enqueued")
                return

            fmt = self.cfg.get("capture", "format")
            ts = datetime.datetime.utcnow().isoformat()

            for image_bytes, label in shots:
                meta = {
                    "timestamp": ts,
                    "label": label,
                    "format": fmt,
                    "device_id": self.cfg.get("upload", "device_id"),
                }
                self.pq.enqueue(image_bytes, meta)

            elapsed = (time.perf_counter() - start) * 1000
            log.info(f"Captured {len(shots)} screenshot(s) in {elapsed:.1f}ms")
        except Exception as e:
            log.error(f"Capture error: {e}")
        finally:
            with self._capture_lock:
                self._capturing = False

    def _tray_quit(self, icon, item):
        log.info("Shutting down via tray")
        self.uploader.stop()
        keyboard.unhook_all()
        icon.stop()

    def _tray_status(self, icon, item):
        size = self.pq.size()
        log.info(f"Queue size: {size}")

    def run(self):
        log.info(f"ScreenshotSync starting — hotkey: {self.hotkey}")
        keyboard.add_hotkey(self.hotkey, self.on_hotkey, suppress=False, trigger_on_release=True)
        self.uploader.start()

        icon_img = make_tray_icon(self)
        menu = pystray.Menu(
            item("Screenshot Sync — Running", lambda i, m: None, enabled=False),
            item(f"Hotkey: {self.hotkey}", lambda i, m: None, enabled=False),
            pystray.Menu.SEPARATOR,
            item("Check Queue Size", self._tray_status),
            item("Quit", self._tray_quit),
        )
        self._tray = pystray.Icon("ScreenshotSync", icon_img, "Screenshot Sync", menu)
        log.info("System tray icon created — running in background")
        self._tray.run()


# ─── Entry Point ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    instance_guard = SingleInstanceGuard("Local\\ExamHelperScreenshotClient")
    if instance_guard.already_running:
        log.warning("Another ExamHelper screenshot client instance is already running; exiting.")
        sys.exit(0)

    app = ScreenshotSyncApp()
    try:
        app.run()
    finally:
        instance_guard.close()
