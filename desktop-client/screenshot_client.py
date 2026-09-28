"""
Screenshot Capture & Sync Client for Windows 11
Runs in background, listens for global hotkey, captures screen, uploads to server.
"""

import sys
import io
import time
import uuid
import json
import queue
import ctypes
import logging
from logging.handlers import RotatingFileHandler
import threading
import datetime
import configparser
from pathlib import Path
from ctypes import wintypes

import requests
from PIL import ImageGrab, Image

try:
    import keyboard
except ImportError:
    keyboard = None

try:
    import socketio
except ImportError:
    socketio = None

try:
    import pyperclip
except ImportError:
    pyperclip = None

if sys.platform == "win32":
    try:
        import win32clipboard
        import win32con
        import win32gui
    except ImportError:
        win32clipboard = win32con = win32gui = None
else:
    win32clipboard = win32con = win32gui = None

# ─── Logging Setup ────────────────────────────────────────────────────────────
LOG_DIR = Path.home() / "AppData" / "Local" / "ScreenshotSync"
LOG_DIR.mkdir(parents=True, exist_ok=True)
CONFIG_PATH = LOG_DIR / "config.ini"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        RotatingFileHandler(LOG_DIR / "client.log", maxBytes=1_000_000, backupCount=3, encoding="utf-8"),
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
    "sync": {
        "enabled": "true",
        "endpoint": "",
        "excluded_window_keywords": "ExamHelper",
    },
}


def upgrade_capture_quality(
    cfg: configparser.ConfigParser,
    raw_profile: str | None,
    raw_format: str | None,
    raw_quality: str | None,
) -> bool:
    """One-time migration that moves existing clients to the highest-quality capture profile."""
    target_profile = DEFAULT_CONFIG["capture"]["profile"]
    current_profile = (raw_profile or "").strip()
    if current_profile == target_profile:
        return False

    current_format = (raw_format or cfg.get("capture", "format", fallback="jpeg")).strip().lower()
    current_quality = (raw_quality or cfg.get("capture", "quality", fallback="85")).strip()

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


def upgrade_upload_endpoint(cfg: configparser.ConfigParser) -> bool:
    """One-time migration that updates localhost endpoints to the production default."""
    target_endpoint = DEFAULT_CONFIG["upload"]["endpoint"]
    current_endpoint = cfg.get("upload", "endpoint", fallback="")
    if current_endpoint != target_endpoint and ("localhost" in current_endpoint or "127.0.0.1" in current_endpoint):
        cfg.set("upload", "endpoint", target_endpoint)
        log.info(f"Upload endpoint upgraded to {target_endpoint}")
        return True
    return False


def load_config() -> configparser.ConfigParser:
    raw_cfg = configparser.ConfigParser()
    if CONFIG_PATH.exists():
        raw_cfg.read(CONFIG_PATH)

    cfg = configparser.ConfigParser()
    cfg.read_dict(DEFAULT_CONFIG)
    changed = False
    if CONFIG_PATH.exists():
        cfg.read(CONFIG_PATH)
    else:
        changed = True
        log.info(f"Default config prepared for {CONFIG_PATH}")

    if upgrade_capture_quality(
        cfg,
        raw_cfg.get("capture", "profile", fallback=None),
        raw_cfg.get("capture", "format", fallback=None),
        raw_cfg.get("capture", "quality", fallback=None),
    ):
        changed = True

    if upgrade_upload_endpoint(cfg):
        changed = True

    if changed:
        with open(CONFIG_PATH, "w") as f:
            cfg.write(f)
        log.info(f"Capture config saved to {CONFIG_PATH}")
    return cfg


def save_config(cfg: configparser.ConfigParser):
    with open(CONFIG_PATH, "w") as f:
        cfg.write(f)
    log.info(f"Capture config saved to {CONFIG_PATH}")


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


class WindowsHotkeyListener:
    """Native Windows hotkey registration for packaged background apps."""

    WM_HOTKEY = 0x0312
    MOD_ALT = 0x0001
    MOD_CONTROL = 0x0002
    MOD_SHIFT = 0x0004
    MOD_WIN = 0x0008
    VK_MAP = {
        "backspace": 0x08,
        "tab": 0x09,
        "enter": 0x0D,
        "return": 0x0D,
        "pause": 0x13,
        "capslock": 0x14,
        "esc": 0x1B,
        "escape": 0x1B,
        "space": 0x20,
        "pageup": 0x21,
        "pagedown": 0x22,
        "end": 0x23,
        "home": 0x24,
        "left": 0x25,
        "up": 0x26,
        "right": 0x27,
        "down": 0x28,
        "insert": 0x2D,
        "ins": 0x2D,
        "delete": 0x2E,
        "del": 0x2E,
        "printscreen": 0x2C,
        "print": 0x2C,
    }
    MODIFIER_MAP = {
        "alt": MOD_ALT,
        "ctrl": MOD_CONTROL,
        "control": MOD_CONTROL,
        "shift": MOD_SHIFT,
        "win": MOD_WIN,
        "windows": MOD_WIN,
        "cmd": MOD_WIN,
    }

    class MSG(ctypes.Structure):
        _fields_ = [
            ("hwnd", wintypes.HWND),
            ("message", wintypes.UINT),
            ("wParam", wintypes.WPARAM),
            ("lParam", wintypes.LPARAM),
            ("time", wintypes.DWORD),
            ("pt", wintypes.POINT),
            ("lPrivate", wintypes.DWORD),
        ]

    def __init__(self, hotkey: str, callback):
        self.hotkey = hotkey
        self.callback = callback
        self._hotkey_id = 1
        self._thread = threading.Thread(target=self._run, daemon=True, name="HotkeyListener")
        self._thread_id = None
        self._registered = False
        self._ready = threading.Event()
        self._stop = threading.Event()

    @classmethod
    def _normalize_hotkey(cls, value: str) -> str:
        normalized = value.strip().lower()
        replacements = {
            "print screen": "printscreen",
            "page up": "pageup",
            "page down": "pagedown",
        }
        for before, after in replacements.items():
            normalized = normalized.replace(before, after)
        return normalized

    @classmethod
    def parse(cls, hotkey: str) -> tuple[int, int]:
        normalized = cls._normalize_hotkey(hotkey)
        tokens = [token.strip().replace(" ", "") for token in normalized.split("+") if token.strip()]
        if not tokens:
            raise ValueError("Hotkey is empty.")

        modifiers = 0
        main_key = None
        for token in tokens:
            if token in cls.MODIFIER_MAP:
                modifiers |= cls.MODIFIER_MAP[token]
                continue

            if token.startswith("f") and token[1:].isdigit():
                key_number = int(token[1:])
                if 1 <= key_number <= 24:
                    key_code = 0x70 + key_number - 1
                else:
                    raise ValueError(f"Unsupported function key: {token}")
            elif token in cls.VK_MAP:
                key_code = cls.VK_MAP[token]
            elif len(token) == 1:
                key_code = ord(token.upper())
            else:
                raise ValueError(f"Unsupported hotkey token: {token}")

            if main_key is not None:
                raise ValueError("Hotkey must contain exactly one non-modifier key.")
            main_key = key_code

        if main_key is None:
            raise ValueError("Hotkey must include a non-modifier key.")

        return modifiers, main_key

    def start(self) -> bool:
        self._thread.start()
        self._ready.wait(timeout=2)
        return self._registered

    def stop(self):
        self._stop.set()
        if self._thread_id:
            ctypes.windll.user32.PostThreadMessageW(self._thread_id, 0x0012, 0, 0)
        if self._thread.is_alive():
            self._thread.join(timeout=2)

    def _run(self):
        self._thread_id = ctypes.windll.kernel32.GetCurrentThreadId()
        try:
            modifiers, virtual_key = self.parse(self.hotkey)
        except ValueError as error:
            log.error(f"Hotkey configuration is invalid: {error}")
            self._ready.set()
            return

        if not ctypes.windll.user32.RegisterHotKey(None, self._hotkey_id, modifiers, virtual_key):
            error_code = ctypes.windll.kernel32.GetLastError()
            log.error(f"Failed to register global hotkey {self.hotkey} (Win32 error {error_code})")
            self._ready.set()
            return

        self._registered = True
        log.info(f"Registered global hotkey: {self.hotkey}")
        self._ready.set()

        message = self.MSG()
        while not self._stop.is_set():
            result = ctypes.windll.user32.GetMessageW(ctypes.byref(message), None, 0, 0)
            if result <= 0:
                break

            if message.message == self.WM_HOTKEY and message.wParam == self._hotkey_id:
                try:
                    self.callback()
                except Exception as error:
                    log.error(f"Hotkey callback failed: {error}")

        if self._registered:
            ctypes.windll.user32.UnregisterHotKey(None, self._hotkey_id)
            self._registered = False


# ─── Queue Manager ────────────────────────────────────────────────────────────
def derive_sync_endpoint(upload_endpoint: str, configured_endpoint: str = "") -> str:
    configured_endpoint = (configured_endpoint or "").strip()
    if configured_endpoint:
        return configured_endpoint.rstrip("/")

    endpoint = (upload_endpoint or "").strip()
    if endpoint.endswith("/upload"):
        endpoint = endpoint[:-len("/upload")]
    return endpoint.rstrip("/")


class TextSnippetExpander:
    """Global text expander using simulated keystrokes and no clipboard access."""

    TERMINATORS = {" ", "\n", "\t", ".", ",", "!", "?", ";", ":", ")", "]", "}"}
    BOUNDARIES = set(" \n\t\r.,!?;:([{<\"'")
    KEY_CHARS = {"space": " ", "enter": "\n", "tab": "\t", "decimal": "."}
    IGNORED_MODIFIERS = {
        "alt", "alt gr", "ctrl", "left ctrl", "right ctrl", "shift", "left shift",
        "right shift", "windows", "left windows", "right windows", "cmd",
    }

    def __init__(self, excluded_keywords: list[str] | None = None):
        self._snippets: dict[str, str] = {}
        self._buffer = ""
        self._max_shortcut_len = 20
        self._lock = threading.Lock()
        self._hook = None
        self._suspended = threading.Event()
        self._excluded_keywords = [keyword.lower() for keyword in (excluded_keywords or []) if keyword]

    def start(self):
        if keyboard is None:
            log.warning("keyboard package is not installed; text snippet expansion is disabled.")
            return
        self._hook = keyboard.on_press(self._on_press, suppress=False)
        log.info("Text snippet expander started")

    def stop(self):
        if keyboard is not None and self._hook is not None:
            keyboard.unhook(self._hook)
            self._hook = None

    def replace_all(self, snippets: list[dict]):
        with self._lock:
            self._snippets = {
                str(snippet.get("shortcut", "")).strip(): str(snippet.get("text", ""))
                for snippet in snippets
                if str(snippet.get("shortcut", "")).strip() and snippet.get("text") is not None
            }
            self._max_shortcut_len = max([20, *[len(shortcut) for shortcut in self._snippets]])
            self._buffer = self._buffer[-(self._max_shortcut_len + 2):]
        log.info(f"Loaded {len(self._snippets)} text snippet(s)")

    def upsert(self, snippet: dict):
        shortcut = str(snippet.get("shortcut", "")).strip()
        text = str(snippet.get("text", ""))
        if not shortcut:
            return
        with self._lock:
            self._snippets[shortcut] = text
            self._max_shortcut_len = max([20, *[len(key) for key in self._snippets]])
        log.info(f"Snippet synced: {shortcut}")

    def delete(self, payload: dict):
        shortcut = str(payload.get("shortcut", "")).strip()
        with self._lock:
            if shortcut in self._snippets:
                del self._snippets[shortcut]
            self._max_shortcut_len = max([20, *[len(key) for key in self._snippets]])
        log.info(f"Snippet removed: {shortcut}")

    def _foreground_window_title(self) -> str:
        try:
            hwnd = ctypes.windll.user32.GetForegroundWindow()
            length = ctypes.windll.user32.GetWindowTextLengthW(hwnd)
            buffer = ctypes.create_unicode_buffer(length + 1)
            ctypes.windll.user32.GetWindowTextW(hwnd, buffer, length + 1)
            return buffer.value
        except Exception:
            return ""

    def _should_ignore_window(self) -> bool:
        title = self._foreground_window_title().lower()
        return bool(title and any(keyword in title for keyword in self._excluded_keywords))

    def _on_press(self, event):
        if self._suspended.is_set() or self._should_ignore_window():
            return
        if event.name in self.IGNORED_MODIFIERS:
            return
        if keyboard is not None and self._any_modifier_pressed():
            return

        char = self._event_to_char(event)
        if char is None:
            if event.name == "backspace":
                with self._lock:
                    self._buffer = self._buffer[:-1]
            return

        with self._lock:
            self._buffer = (self._buffer + char)[-(self._max_shortcut_len + 2):]
            match = self._find_match_locked()

        if match:
            shortcut, text, terminator = match
            threading.Thread(
                target=self._expand,
                args=(shortcut, text, terminator),
                daemon=True,
                name="SnippetExpansion",
            ).start()

    def _event_to_char(self, event) -> str | None:
        if not event.name:
            return None
        if event.name in self.KEY_CHARS:
            return self.KEY_CHARS[event.name]
        if len(event.name) == 1:
            return event.name.upper() if keyboard and keyboard.is_pressed("shift") else event.name
        return None

    def _any_modifier_pressed(self) -> bool:
        for name in ("ctrl", "alt", "windows", "left windows", "right windows"):
            try:
                if keyboard.is_pressed(name):
                    return True
            except Exception:
                continue
        return False

    def _find_match_locked(self) -> tuple[str, str, str] | None:
        if not self._snippets or not self._buffer:
            return None

        terminator = self._buffer[-1] if self._buffer[-1] in self.TERMINATORS else ""
        search_text = self._buffer[:-1] if terminator else self._buffer
        for shortcut in sorted(self._snippets, key=len, reverse=True):
            if not search_text.endswith(shortcut):
                continue
            prefix_index = len(search_text) - len(shortcut) - 1
            has_boundary = prefix_index < 0 or search_text[prefix_index] in self.BOUNDARIES
            if not has_boundary:
                continue
            if terminator or not self._has_longer_shortcut_prefix(shortcut):
                return shortcut, self._snippets[shortcut], terminator
        return None

    def _has_longer_shortcut_prefix(self, shortcut: str) -> bool:
        return any(
            candidate != shortcut and candidate.startswith(shortcut)
            for candidate in self._snippets
        )

    def _expand(self, shortcut: str, text: str, terminator: str):
        if keyboard is None:
            return
        self._suspended.set()
        try:
            erase_count = len(shortcut) + (1 if terminator else 0)
            for _ in range(erase_count):
                keyboard.send("backspace")
            self._type_text(text)
            if terminator:
                self._type_text(terminator)
            with self._lock:
                self._buffer = ""
        except Exception as error:
            log.error(f"Snippet expansion failed: {error}")
        finally:
            self._suspended.clear()

    def _type_text(self, text: str):
        for char in text:
            if char == "\n":
                keyboard.send("enter")
            elif char == "\t":
                keyboard.send("tab")
            else:
                keyboard.write(char)


class ClipboardWatcher:
    """Silently mirrors plain-text clipboard changes while the Socket.IO client is connected."""

    WM_CLIPBOARDUPDATE = 0x031D
    HWND_MESSAGE = -3

    def __init__(self, on_change, is_connected):
        self.on_change = on_change
        self.is_connected = is_connected
        self._baseline = None
        self._baseline_lock = threading.Lock()
        self._started = False
        self._stop = threading.Event()
        self._thread = None
        self._hwnd = None

    def start(self):
        if self._started:
            return
        self._started = True
        try:
            self._set_baseline(self._read_text())
        except Exception as error:
            log.error(f"Initial clipboard read failed: {error}")
            self._set_baseline(None)
        target = self._run_windows_listener if win32gui is not None else self._run_polling_listener
        self._thread = threading.Thread(target=target, daemon=True, name="ClipboardWatcher")
        self._thread.start()
        log.info("Clipboard watcher started")

    def stop(self):
        self._stop.set()
        if self._hwnd and win32gui is not None:
            try:
                win32gui.PostMessage(self._hwnd, win32con.WM_CLOSE, 0, 0)
            except Exception:
                pass

    def apply_server_push(self, content):
        if not isinstance(content, str):
            return
        try:
            # Set this before the write posts WM_CLIPBOARDUPDATE to prevent an echo upload.
            self._set_baseline(content)
            self._write_text(content)
        except Exception as error:
            log.error(f"Clipboard push failed: {error}")

    def _set_baseline(self, content):
        with self._baseline_lock:
            self._baseline = content

    def _handle_clipboard_change(self):
        try:
            content = self._read_text()
            if content is None:
                return
            with self._baseline_lock:
                if content == self._baseline:
                    return
                # A disconnected change is intentionally dropped, but still becomes the baseline.
                self._baseline = content
            if self.is_connected():
                self.on_change(content)
        except Exception as error:
            log.error(f"Clipboard read or upload failed: {error}")

    def _read_text(self):
        if win32clipboard is not None:
            for _ in range(3):
                try:
                    win32clipboard.OpenClipboard()
                    try:
                        if not win32clipboard.IsClipboardFormatAvailable(win32con.CF_UNICODETEXT):
                            return None
                        value = win32clipboard.GetClipboardData(win32con.CF_UNICODETEXT)
                        return value if isinstance(value, str) else None
                    finally:
                        win32clipboard.CloseClipboard()
                except Exception:
                    time.sleep(0.05)
            return None
        if pyperclip is None:
            return None
        value = pyperclip.paste()
        return value if isinstance(value, str) else None

    def _write_text(self, content: str):
        if win32clipboard is not None:
            for attempt in range(3):
                try:
                    win32clipboard.OpenClipboard()
                    try:
                        win32clipboard.EmptyClipboard()
                        win32clipboard.SetClipboardText(content, win32con.CF_UNICODETEXT)
                        return
                    finally:
                        win32clipboard.CloseClipboard()
                except Exception:
                    if attempt == 2:
                        raise
                    time.sleep(0.05)
            return
        if pyperclip is None:
            raise RuntimeError("pyperclip is not installed")
        pyperclip.copy(content)

    def _run_windows_listener(self):
        class_name = f"ExamHelperClipboardWatcher{uuid.uuid4().hex}"

        def window_proc(hwnd, message, wparam, lparam):
            if message == self.WM_CLIPBOARDUPDATE:
                self._handle_clipboard_change()
                return 0
            if message == win32con.WM_CLOSE:
                win32gui.DestroyWindow(hwnd)
                return 0
            if message == win32con.WM_DESTROY:
                win32gui.PostQuitMessage(0)
                return 0
            return win32gui.DefWindowProc(hwnd, message, wparam, lparam)

        try:
            wc = win32gui.WNDCLASS()
            wc.lpfnWndProc = window_proc
            wc.lpszClassName = class_name
            win32gui.RegisterClass(wc)
            self._hwnd = win32gui.CreateWindowEx(0, class_name, class_name, 0, 0, 0, 0, 0, self.HWND_MESSAGE, 0, 0, None)
            win32gui.AddClipboardFormatListener(self._hwnd)
            win32gui.PumpMessages()
        except Exception as error:
            log.error(f"Native clipboard listener failed; using polling fallback: {error}")
            self._run_polling_listener()
        finally:
            if self._hwnd:
                try:
                    win32gui.RemoveClipboardFormatListener(self._hwnd)
                except Exception:
                    pass
                self._hwnd = None

    def _run_polling_listener(self):
        while not self._stop.wait(0.4):
            self._handle_clipboard_change()


class RealtimeConfigSync:
    """Socket.IO client that keeps snippets, hotkey, and clipboard state current."""

    def __init__(self, endpoint: str, expander: TextSnippetExpander, hotkey_callback, clipboard_watcher: ClipboardWatcher):
        self.endpoint = endpoint
        self.expander = expander
        self.hotkey_callback = hotkey_callback
        self.clipboard_watcher = clipboard_watcher
        self._client = None

    def start(self):
        if not self.endpoint:
            log.warning("Realtime sync endpoint is empty; snippet and hotkey push is disabled.")
            return
        if socketio is None:
            log.warning("python-socketio is not installed; realtime sync is disabled.")
            self._sync_once_from_rest()
            return

        self._client = socketio.Client(reconnection=True, reconnection_attempts=0, logger=False, engineio_logger=False)
        self._client.on("connect", self._on_connect)
        self._client.on("state_snapshot", self._on_state_snapshot)
        self._client.on("snippet_created", self._on_snippet_upsert)
        self._client.on("snippet_updated", self._on_snippet_upsert)
        self._client.on("snippet_deleted", self._on_snippet_deleted)
        self._client.on("hotkey_changed", self._on_hotkey_changed)
        self._client.on("clipboard:push", self._on_clipboard_push)
        threading.Thread(target=self._connect, daemon=True, name="RealtimeConfigSync").start()

    def stop(self):
        self.clipboard_watcher.stop()
        if self._client is not None:
            try:
                self._client.disconnect()
            except Exception:
                pass

    def _connect(self):
        try:
            self._client.connect(self.endpoint, transports=["websocket", "polling"], wait_timeout=10, auth={"client": "desktop"}, headers={"X-ExamHelper-Client": "desktop"})
            self._client.wait()
        except Exception as error:
            log.warning(f"Realtime sync connection failed: {error}")

    def _sync_once_from_rest(self):
        try:
            response = requests.get(f"{self.endpoint}/client-state", timeout=10)
            response.raise_for_status()
            self._on_state_snapshot(response.json())
            log.info("Loaded snippets and hotkey once via REST fallback")
        except Exception as error:
            log.warning(f"REST fallback state sync failed: {error}")

    def _on_connect(self):
        log.info(f"Realtime sync connected to {self.endpoint}")
        self.clipboard_watcher.start()

    def _on_state_snapshot(self, payload):
        self.expander.replace_all(payload.get("snippets", []))
        hotkey = payload.get("config", {}).get("screenshot_hotkey")
        if hotkey:
            self.hotkey_callback(hotkey)

    def _on_snippet_upsert(self, payload):
        self.expander.upsert(payload)

    def _on_snippet_deleted(self, payload):
        self.expander.delete(payload)

    def _on_hotkey_changed(self, payload):
        hotkey = payload.get("screenshot_hotkey")
        if hotkey:
            self.hotkey_callback(hotkey)

    def _on_clipboard_push(self, payload):
        self.clipboard_watcher.apply_server_push(payload.get("content") if isinstance(payload, dict) else payload)

    def is_connected(self) -> bool:
        return bool(self._client and self._client.connected)

    def emit_clipboard_update(self, content: str):
        if self.is_connected():
            try:
                self._client.emit("clipboard:update", {"content": content})
            except Exception as error:
                log.error(f"Clipboard upload failed: {error}")


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
        self._stop = threading.Event()
        self._hotkey_listener = WindowsHotkeyListener(self.hotkey, self.on_hotkey)
        excluded_keywords = [
            keyword.strip()
            for keyword in self.cfg.get("sync", "excluded_window_keywords", fallback="ExamHelper").split(",")
            if keyword.strip()
        ]
        self.snippet_expander = TextSnippetExpander(excluded_keywords)
        sync_endpoint = derive_sync_endpoint(
            self.cfg.get("upload", "endpoint"),
            self.cfg.get("sync", "endpoint", fallback=""),
        )
        self.clipboard_watcher = ClipboardWatcher(
            lambda content: self.realtime_sync.emit_clipboard_update(content),
            lambda: self.realtime_sync.is_connected(),
        )
        self.realtime_sync = RealtimeConfigSync(
            sync_endpoint, self.snippet_expander, self._set_hotkey, self.clipboard_watcher
        )

    def on_hotkey(self):
        self._request_capture("hotkey", enforce_cooldown=True)

    def _request_capture(self, source: str, enforce_cooldown: bool):
        now = time.monotonic()
        should_start = False

        with self._capture_lock:
            if self._capturing:
                log.info(f"Ignoring {source} trigger because a capture is already in progress")
                return

            if enforce_cooldown and now - self._last_hotkey_at < self.hotkey_cooldown:
                log.info(f"Ignoring duplicate {source} trigger inside cooldown window")
                return

            self._capturing = True
            if enforce_cooldown:
                self._last_hotkey_at = now
            should_start = True

        if should_start:
            log.info(f"Accepted {source} capture request")
            threading.Thread(
                target=self._do_capture,
                args=(source,),
                daemon=True,
                name="CaptureWorker",
            ).start()

    def _capture_with_retry(self) -> list[tuple[bytes, str]]:
        shots = self.capture.capture()
        if shots:
            return shots

        log.warning("Capture returned no screenshots on the first attempt; retrying once")
        time.sleep(self.empty_capture_retry_delay)
        return self.capture.capture()

    def _do_capture(self, source: str):
        try:
            start = time.perf_counter()
            log.info(f"Starting screenshot capture from {source}")
            shots = self._capture_with_retry()
            if not shots:
                log.warning(
                    f"No screenshots were captured after retry for {source}; nothing will be enqueued"
                )
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
            log.info(f"Captured {len(shots)} screenshot(s) from {source} in {elapsed:.1f}ms")
        except Exception as e:
            log.error(f"Capture error: {e}")
        finally:
            with self._capture_lock:
                self._capturing = False

    def stop(self):
        self.realtime_sync.stop()
        self.snippet_expander.stop()
        self.uploader.stop()
        self._hotkey_listener.stop()
        self._stop.set()

    def _set_hotkey(self, new_hotkey: str) -> bool:
        if not new_hotkey or new_hotkey == self.hotkey:
            return True

        try:
            WindowsHotkeyListener.parse(new_hotkey)
        except ValueError as error:
            log.error(f"Hotkey configuration is invalid: {error}")
            return False

        previous_hotkey = self.hotkey
        previous_listener = self._hotkey_listener
        previous_listener.stop()

        replacement = WindowsHotkeyListener(new_hotkey, self.on_hotkey)
        if not replacement.start():
            log.error(f"Could not register updated hotkey: {new_hotkey}")
            self._hotkey_listener = WindowsHotkeyListener(previous_hotkey, self.on_hotkey)
            self._hotkey_listener.start()
            return False

        self.hotkey = new_hotkey
        self._hotkey_listener = replacement
        self.cfg.set("capture", "hotkey", new_hotkey)
        save_config(self.cfg)
        return True

    def run(self):
        log.info(f"ScreenshotSync starting — hotkey: {self.hotkey}")
        log.info(
            f"Capture format={self.cfg.get('capture', 'format')} "
            f"endpoint={self.cfg.get('upload', 'endpoint')}"
        )
        hotkey_registered = self._hotkey_listener.start()
        if not hotkey_registered:
            log.error(
                "Global hotkey registration failed; screenshot hotkeys are unavailable."
            )
        self.uploader.start()
        if self.cfg.getboolean("sync", "enabled", fallback=True):
            self.snippet_expander.start()
            self.realtime_sync.start()

        self._stop.wait()


# ─── Entry Point ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    instance_guard = SingleInstanceGuard("Local\\Microphone")
    if instance_guard.already_running:
        log.warning("Another Microphone instance is already running; exiting.")
        sys.exit(0)

    app = ScreenshotSyncApp()
    try:
        app.run()
    except KeyboardInterrupt:
        app.stop()
    finally:
        app.stop()
        instance_guard.close()
