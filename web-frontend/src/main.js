import { api } from "./api.js";
import { PROMPTS } from "./prompts.js";

const state = {
  items: [],
  stats: null,
  selectedIds: new Set(),
  extractedText: "",
  extractedItems: [],
  busy: false,
};

const elements = {
  screenshotsContainer: document.querySelector("#screenshots-container"),
  screenshotCount: document.querySelector("#screenshot-count"),
  selectionCount: document.querySelector("#selection-count"),
  statusPill: document.querySelector("#status-pill"),
  selectAllButton: document.querySelector("#select-all-btn"),
  clearSelectionButton: document.querySelector("#clear-selection-btn"),
  copySelectedButton: document.querySelector("#copy-selected-btn"),
  extractSelectedButton: document.querySelector("#extract-selected-btn"),
  deleteSelectedButton: document.querySelector("#delete-selected-btn"),
  promptList: document.querySelector("#prompt-list"),
  toast: document.querySelector("#toast"),
};

let toastTimer = null;

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function setStatus(message) {
  elements.statusPill.textContent = message;
}

function showToast(message) {
  if (!elements.toast) {
    return;
  }

  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    elements.toast.classList.remove("is-visible");
  }, 2600);
}

function formatDate(value) {
  if (!value) {
    return "Unknown time";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatSize(bytes) {
  if (!Number.isFinite(bytes)) {
    return "Unknown size";
  }

  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  return `${Math.max(bytes / 1024, 0.1).toFixed(1)} KB`;
}

function selectedItems() {
  return state.items.filter((item) => state.selectedIds.has(item.id));
}

function setBusy(isBusy) {
  state.busy = isBusy;
  render();
}

async function loadDashboard(silent = false) {
  try {
    if (!silent) setStatus("Loading...");
    const { screenshots, stats } = await api.loadDashboard();
    
    // Check if anything fundamentally changed to avoid redundant re-renders
    const currentIds = state.items.map(i => i.id).join(",");
    const newIds = screenshots.items.map(i => i.id).join(",");
    
    if (currentIds !== newIds || !state.stats) {
      const validIds = new Set(screenshots.items.map((item) => item.id));
      state.items = screenshots.items;
      state.stats = stats;
      state.selectedIds = new Set([...state.selectedIds].filter((id) => validIds.has(id)));
      render();
    }
    
    setStatus(`Auto cleanup limit: ${stats.max_screenshots}`);
  } catch (error) {
    setStatus("Backend offline");
    if (!silent) showToast(error.message);
  }
}


function renderToolbar() {
  elements.screenshotCount.textContent = `${state.items.length}`;
  elements.selectionCount.textContent = `${state.selectedIds.size} selected`;

  const hasSelection = state.selectedIds.size > 0;
  elements.copySelectedButton.disabled = !hasSelection || state.busy;
  elements.extractSelectedButton.disabled = !hasSelection || state.busy;
  elements.deleteSelectedButton.disabled = !hasSelection || state.busy;
  elements.clearSelectionButton.disabled = !hasSelection || state.busy;
  elements.selectAllButton.disabled = state.items.length === 0 || state.busy;
}

function renderPrompts() {
  elements.promptList.innerHTML = PROMPTS.map((prompt) => {
    const hasTextClass = state.extractedText ? "has-text" : "";
    return `
      <button class="inline-prompt-btn ${hasTextClass}" type="button" data-prompt-action="copy" data-prompt-id="${prompt.id}" title="${escapeHtml(prompt.description)}">
        <i class="ph ph-chat-teardrop-text"></i> ${escapeHtml(prompt.title)}
      </button>
    `;
  }).join("");
}

function renderExtractionPanel() {
  // Empty logic to satisfy earlier reference or just omit; we extract via clipboard natively now.
}

function renderScreenshots() {
  if (state.items.length === 0) {
    elements.screenshotsContainer.innerHTML = `
      <div class="empty-state">
        <i class="ph ph-image" style="font-size: 3rem; color: var(--muted); margin-bottom: 16px;"></i>
        <div>
          <h3>Waiting for screenshots...</h3>
          <p>Use your desktop hotkey to capture. They will appear here immediately.</p>
        </div>
      </div>
    `;
    return;
  }

  elements.screenshotsContainer.innerHTML = state.items
    .map((item) => {
      const selected = state.selectedIds.has(item.id);
      const cardClasses = ["shot-card", selected ? "is-selected" : ""].filter(Boolean).join(" ");

      return `
        <article class="${cardClasses}" data-id="${item.id}">
          <div class="shot-preview">
            <button
              class="button select-pill"
              type="button"
              data-action="toggle-select"
              data-id="${item.id}"
              aria-pressed="${selected}"
              title="${selected ? "Deselect" : "Select"}"
            >
              <i class="ph ${selected ? 'ph-check-circle' : 'ph-circle'}"></i>
            </button>
            <img src="${escapeHtml(item.image_url || "")}" alt="Screenshot ${escapeHtml(item.id)}" loading="lazy" />
          </div>

          <div class="shot-body">
            <div class="shot-heading">
              <h3 class="shot-title">${escapeHtml(item.label || item.filename || "Screenshot")}</h3>
            </div>

            <div class="card-actions">
              <button class="button button-secondary icon-btn" type="button" data-action="copy-one" data-id="${item.id}" title="Copy">
                <i class="ph ph-copy"></i>
              </button>
              <button class="button button-primary icon-btn" type="button" data-action="extract-one" data-id="${item.id}" title="Extract Text">
                <i class="ph ph-sparkle"></i>
              </button>
              <button class="button button-danger icon-btn" type="button" data-action="delete-one" data-id="${item.id}" title="Delete">
                <i class="ph ph-trash"></i>
              </button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function render() {
  renderToolbar();
  renderPrompts();
  renderExtractionPanel();
  renderScreenshots();
}

// Removed setView function

function toggleSelection(id) {
  if (state.selectedIds.has(id)) {
    state.selectedIds.delete(id);
  } else {
    state.selectedIds.add(id);
  }
  render();
}

function parseTagInput(value) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

async function loadImageFromBlob(blob) {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Unable to decode screenshot image."));
      image.src = objectUrl;
    });
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function convertBlobToPng(blob) {
  const image = await loadImageFromBlob(blob);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0);
  return new Promise((resolve) => {
    canvas.toBlob((pngBlob) => resolve(pngBlob), "image/png");
  });
}

async function createContactSheet(entries) {
  const loadedEntries = [];
  for (const entry of entries) {
    loadedEntries.push({
      ...entry,
      image: await loadImageFromBlob(entry.blob),
    });
  }

  const gap = 24;
  const labelHeight = 32;
  const maxCellWidth = 320;
  const columns = loadedEntries.length === 1 ? 1 : loadedEntries.length === 2 ? 2 : 2;
  const rows = Math.ceil(loadedEntries.length / columns);

  const scaledSizes = loadedEntries.map((entry) => {
    const ratio = Math.min(maxCellWidth / entry.image.naturalWidth, 1);
    return {
      width: Math.round(entry.image.naturalWidth * ratio),
      height: Math.round(entry.image.naturalHeight * ratio),
    };
  });

  const rowHeights = Array.from({ length: rows }, (_, rowIndex) => {
    const rowSizes = scaledSizes.slice(rowIndex * columns, rowIndex * columns + columns);
    return Math.max(...rowSizes.map((size) => size.height + labelHeight), 0);
  });

  const canvasWidth = columns * maxCellWidth + gap * (columns + 1);
  const canvasHeight = rowHeights.reduce((sum, height) => sum + height, 0) + gap * (rows + 1);
  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  const context = canvas.getContext("2d");
  context.fillStyle = "#f8f2e9";
  context.fillRect(0, 0, canvasWidth, canvasHeight);
  context.fillStyle = "#1e2a27";
  context.font = "600 16px 'Trebuchet MS', sans-serif";

  let y = gap;
  loadedEntries.forEach((entry, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const size = scaledSizes[index];
    const x = gap + column * (maxCellWidth + gap);
    const text = `${index + 1}. ${entry.meta.label || entry.meta.filename || entry.meta.id}`;

    context.fillStyle = "#1e2a27";
    context.fillText(text, x, y + 18);
    context.fillStyle = "#ffffff";
    context.fillRect(x, y + labelHeight, size.width, size.height);
    context.drawImage(entry.image, x, y + labelHeight, size.width, size.height);

    if (column === columns - 1 || index === loadedEntries.length - 1) {
      y += rowHeights[row] + gap;
    }
  });

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

async function fetchSelectedImageBlobs(ids) {
  const chosenItems = state.items.filter((item) => ids.includes(item.id));
  const results = [];

  for (const item of chosenItems) {
    const response = await fetch(item.image_url);
    if (!response.ok) {
      throw new Error(`Unable to load screenshot ${item.id}.`);
    }

    const blob = await response.blob();
    const pngBlob = await convertBlobToPng(blob);
    results.push({ meta: item, blob: pngBlob });
  }

  return results;
}

async function copyImages(ids) {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new Error("Your browser does not support image clipboard writes.");
  }

  const blobs = await fetchSelectedImageBlobs(ids);
  if (blobs.length === 0) {
    throw new Error("Select at least one screenshot first.");
  }

  if (blobs.length === 1) {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blobs[0].blob })]);
    return "single";
  }

  try {
    await navigator.clipboard.write(blobs.map((entry) => new ClipboardItem({ "image/png": entry.blob })));
    return "multiple";
  } catch {
    const contactSheet = await createContactSheet(blobs);
    await navigator.clipboard.write([new ClipboardItem({ "image/png": contactSheet })]);
    return "contact-sheet";
  }
}

async function copySelected() {
  try {
    setBusy(true);
    const ids = [...state.selectedIds];
    const mode = await copyImages(ids);
    if (mode === "contact-sheet") {
      showToast("Copied a contact-sheet image for the selected screenshots.");
    } else {
      showToast("Copied the selected screenshots to the clipboard.");
    }
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

async function extractSelected(ids = [...state.selectedIds]) {
  try {
    setBusy(true);
    setStatus("Extracting text with Gemini...");
    const response = await api.extractText(ids);
    state.extractedText = response.text || "";
    
    // Attempt to auto-copy to clipboard if possible
    if (state.extractedText) {
      try {
        await navigator.clipboard.writeText(state.extractedText);
        showToast("Text extracted and copied to clipboard.");
      } catch {
        showToast("Text extracted, but clipboard access was denied.");
      }
    } else {
      showToast("No text found.");
    }
    
    state.extractedItems = response.items || [];
    render();
    setStatus(`Auto cleanup limit: ${(state.stats && state.stats.max_screenshots) || 50}`);
  } catch (error) {
    showToast(error.message);
    setStatus("Extraction failed");
  } finally {
    setBusy(false);
  }
}

async function deleteSelected(ids = [...state.selectedIds]) {
  if (ids.length === 0) {
    return;
  }

  const confirmed = window.confirm(`Delete ${ids.length} screenshot${ids.length === 1 ? "" : "s"}?`);
  if (!confirmed) {
    return;
  }

  try {
    setBusy(true);
    await api.bulkDelete(ids);
    ids.forEach((id) => state.selectedIds.delete(id));
    await loadDashboard();
    showToast("Selected screenshots deleted.");
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}



async function copyPrompt(promptId) {
  const prompt = PROMPTS.find((item) => item.id === promptId);
  if (!prompt) return;

  // Since we only have one button now, we seamlessly append extracted text if it is available!
  const fullPrompt = state.extractedText
    ? `${prompt.prompt}\n\nUse the following extracted screenshot text as the source material:\n${state.extractedText}`
    : prompt.prompt;

  try {
    await navigator.clipboard.writeText(fullPrompt);
    showToast(state.extractedText ? "Prompt and extracted text copied." : "Prompt copied.");
  } catch (error) {
    showToast("Clipboard access was denied.");
  }
}

function handlePromptClick(event) {
  const button = event.target.closest("[data-prompt-action]");
  if (!button) return;

  const promptId = button.dataset.promptId;
  const action = button.dataset.promptAction;
  
  if (action === "copy") {
    void copyPrompt(promptId);
  }
}

function handleScreenshotClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button) {
    return;
  }

  const action = button.dataset.action;
  const id = button.dataset.id;

  if (action === "toggle-select") {
    toggleSelection(id);
    return;
  }

  if (action === "copy-one") {
    state.selectedIds = new Set([id]);
    render();
    void copySelected();
    return;
  }

  if (action === "extract-one") {
    state.selectedIds = new Set([id]);
    render();
    void extractSelected([id]);
    return;
  }

  if (action === "delete-one") {
    state.selectedIds = new Set([id]);
    render();
    void deleteSelected([id]);
  }
}

function bindEvents() {
  elements.selectAllButton.addEventListener("click", () => {
    state.selectedIds = new Set(state.items.map((item) => item.id));
    render();
  });

  elements.clearSelectionButton.addEventListener("click", () => {
    state.selectedIds.clear();
    render();
  });

  elements.copySelectedButton.addEventListener("click", () => {
    void copySelected();
  });

  elements.extractSelectedButton.addEventListener("click", () => {
    void extractSelected();
  });

  elements.deleteSelectedButton.addEventListener("click", () => {
    void deleteSelected();
  });

  elements.promptList.addEventListener("click", handlePromptClick);
  elements.screenshotsContainer.addEventListener("click", handleScreenshotClick);
}

bindEvents();
render();
void loadDashboard();

// Start silent polling every 3 seconds for background updates
setInterval(() => {
  if (!state.busy) {
    void loadDashboard(true);
  }
}, 3000);
