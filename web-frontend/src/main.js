import { api } from "./api.js";
import { PROMPTS } from "./prompts.js";

const state = {
  activeView: "screenshots",
  items: [],
  snippets: [],
  config: null,
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
  navTabs: document.querySelectorAll("[data-view]"),
  viewPanels: document.querySelectorAll("[data-panel]"),
  snippetForm: document.querySelector("#snippet-form"),
  snippetId: document.querySelector("#snippet-id"),
  snippetShortcut: document.querySelector("#snippet-shortcut"),
  snippetText: document.querySelector("#snippet-text"),
  snippetCancelButton: document.querySelector("#snippet-cancel-btn"),
  snippetsList: document.querySelector("#snippets-list"),
  settingsForm: document.querySelector("#settings-form"),
  screenshotHotkey: document.querySelector("#screenshot-hotkey"),
  imageModal: document.querySelector("#image-modal"),
  modalImage: document.querySelector("#modal-image"),
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

function screenshotById(id) {
  return state.items.find((item) => item.id === id);
}

function setBusy(isBusy) {
  state.busy = isBusy;
  render();
}

async function loadDashboard(silent = false) {
  try {
    if (!silent) setStatus("Loading...");
    const { screenshots, stats, snippets, config } = await api.loadDashboard();

    // Check if anything fundamentally changed to avoid redundant re-renders
    const currentIds = state.items.map(i => i.id).join(",");
    const newIds = screenshots.items.map(i => i.id).join(",");

    const currentSnippetIds = state.snippets.map(i => `${i.id}:${i.updatedAt}`).join(",");
    const newSnippetIds = snippets.items.map(i => `${i.id}:${i.updatedAt}`).join(",");
    const configChanged = state.config?.screenshot_hotkey !== config.screenshot_hotkey;

    if (currentIds !== newIds || currentSnippetIds !== newSnippetIds || configChanged || !state.stats) {
      const validIds = new Set(screenshots.items.map((item) => item.id));
      state.items = screenshots.items;
      state.snippets = snippets.items;
      state.config = config;
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

function renderViews() {
  elements.navTabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.view === state.activeView);
  });
  elements.viewPanels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.panel === state.activeView);
  });
}

function renderSnippets() {
  if (state.snippets.length === 0) {
    elements.snippetsList.innerHTML = `
      <div class="empty-state compact-empty">
        <i class="ph ph-text-aa"></i>
        <div>
          <h3>No snippets yet</h3>
          <p>Add a shortcut and it will sync to the desktop client.</p>
        </div>
      </div>
    `;
    return;
  }

  elements.snippetsList.innerHTML = state.snippets
    .map((snippet) => `
      <article class="snippet-row" data-snippet-id="${escapeHtml(snippet.id)}">
        <div>
          <div class="snippet-shortcut">${escapeHtml(snippet.shortcut)}</div>
          <pre class="snippet-preview">${escapeHtml(snippet.text)}</pre>
        </div>
        <div class="card-actions">
          <button class="button button-secondary icon-btn" type="button" data-snippet-action="edit" data-id="${escapeHtml(snippet.id)}" title="Edit">
            <i class="ph ph-pencil-simple"></i>
          </button>
          <button class="button button-danger icon-btn" type="button" data-snippet-action="delete" data-id="${escapeHtml(snippet.id)}" title="Delete">
            <i class="ph ph-trash"></i>
          </button>
        </div>
      </article>
    `)
    .join("");
}

function renderSettings() {
  if (state.config) {
    elements.screenshotHotkey.value = state.config.screenshot_hotkey;
  }
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
            <div class="shot-hover-actions">
              <button class="button button-secondary icon-btn" type="button" data-action="copy-one" data-id="${item.id}" title="Copy">
                <i class="ph ph-copy"></i>
              </button>
              <button class="button button-primary icon-btn" type="button" data-action="view-one" data-id="${item.id}" title="View">
                <i class="ph ph-arrows-out-simple"></i>
              </button>
            </div>
            <img src="${escapeHtml(item.image_url || "")}" alt="Screenshot ${escapeHtml(item.id)}" loading="lazy" />
          </div>

          <div class="shot-body">
            <div class="shot-heading">
              <h3 class="shot-title">${escapeHtml(item.label || item.filename || "Screenshot")}</h3>
            </div>

            <div class="card-actions">
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
  renderViews();
  renderToolbar();
  renderPrompts();
  renderSnippets();
  renderSettings();
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

function resetSnippetForm() {
  elements.snippetId.value = "";
  elements.snippetShortcut.value = "";
  elements.snippetText.value = "";
  elements.snippetCancelButton.hidden = true;
}

function editSnippet(id) {
  const snippet = state.snippets.find((item) => item.id === id);
  if (!snippet) return;

  elements.snippetId.value = snippet.id;
  elements.snippetShortcut.value = snippet.shortcut;
  elements.snippetText.value = snippet.text;
  elements.snippetCancelButton.hidden = false;
  elements.snippetShortcut.focus();
}

function dedentText(value) {
  const lines = String(value).split(/\r?\n/);
  const eol = value.includes("\r\n") ? "\r\n" : "\n";

  return lines
    .map((line) => line.replace(/^[\t ]+/, ""))
    .join(eol);
}

async function persistSnippet(text) {
  const id = elements.snippetId.value;
  const payload = {
    shortcut: elements.snippetShortcut.value.trim(),
    text,
  };

  if (id) {
    await api.updateSnippet(id, payload);
    return "updated";
  }

  await api.createSnippet(payload);
  return "created";
}

async function saveSnippet(event) {
  event.preventDefault();
  const saveMode = event.submitter?.dataset.saveMode || "exact";
  const text =
    saveMode === "dedent"
      ? dedentText(elements.snippetText.value)
      : elements.snippetText.value;

  try {
    setBusy(true);
    const result = await persistSnippet(text);
    showToast(result === "updated" ? "Snippet updated." : "Snippet created.");
    resetSnippetForm();
    await loadDashboard(true);
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

async function deleteSnippet(id) {
  const snippet = state.snippets.find((item) => item.id === id);
  if (!snippet || !window.confirm(`Delete snippet ${snippet.shortcut}?`)) {
    return;
  }

  try {
    setBusy(true);
    await api.deleteSnippet(id);
    if (elements.snippetId.value === id) {
      resetSnippetForm();
    }
    await loadDashboard(true);
    showToast("Snippet deleted.");
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

function handleSnippetClick(event) {
  const button = event.target.closest("[data-snippet-action]");
  if (!button) return;

  if (button.dataset.snippetAction === "edit") {
    editSnippet(button.dataset.id);
    return;
  }

  if (button.dataset.snippetAction === "delete") {
    void deleteSnippet(button.dataset.id);
  }
}

async function saveSettings(event) {
  event.preventDefault();
  try {
    setBusy(true);
    const response = await api.updateConfig({
      screenshot_hotkey: elements.screenshotHotkey.value,
    });
    state.config = response.config;
    render();
    showToast("Screenshot hotkey updated.");
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
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

async function copySingleImage(id) {
  try {
    setBusy(true);
    await copyImages([id]);
    showToast("Copied screenshot to the clipboard.");
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

function openImageModal(id) {
  const item = screenshotById(id);
  if (!item?.image_url) {
    showToast("Unable to open screenshot.");
    return;
  }

  elements.modalImage.src = item.image_url;
  elements.modalImage.alt = `Screenshot ${item.id}`;
  elements.imageModal.hidden = false;
  document.body.classList.add("modal-open");
}

function closeImageModal() {
  elements.imageModal.hidden = true;
  elements.modalImage.removeAttribute("src");
  elements.modalImage.alt = "";
  document.body.classList.remove("modal-open");
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
    void copySingleImage(id);
    return;
  }

  if (action === "view-one") {
    openImageModal(id);
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
  elements.navTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      state.activeView = tab.dataset.view;
      render();
    });
  });

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
  elements.snippetForm.addEventListener("submit", saveSnippet);
  elements.snippetCancelButton.addEventListener("click", resetSnippetForm);
  elements.snippetsList.addEventListener("click", handleSnippetClick);
  elements.settingsForm.addEventListener("submit", saveSettings);
  elements.imageModal.addEventListener("click", (event) => {
    if (event.target.closest("[data-modal-close]")) {
      closeImageModal();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !elements.imageModal.hidden) {
      closeImageModal();
    }
  });
}

bindEvents();
resetSnippetForm();
render();
void loadDashboard();

// Start silent polling every 3 seconds for background updates
setInterval(() => {
  if (!state.busy) {
    void loadDashboard(true);
  }
}, 3000);
