import { api } from "./api.js";

const state = {
  activeView: "screenshots",
  items: [],
  archivedItems: [],
  archivePage: 1,
  archiveTotal: 0,
  snippets: [],
  config: null,
  clipboard: { history: [] },
  stats: null,
  selectedIds: new Set(),
  selectedArchiveIds: new Set(),
  busy: false,
  viewerItems: [],
  viewerIndex: -1,
  cropMode: false,
  cropStart: null,
  cropRect: null,
};

const elements = {
  screenshotsContainer: document.querySelector("#screenshots-container"),
  archiveContainer: document.querySelector("#archive-container"),
  screenshotCount: document.querySelector("#screenshot-count"),
  selectionCount: document.querySelector("#selection-count"),
  archiveCount: document.querySelector("#archive-count"),
  archiveScreenshotCount: document.querySelector("#archive-screenshot-count"),
  archiveSelectionCount: document.querySelector("#archive-selection-count"),
  archivePageLabel: document.querySelector("#archive-page-label"),
  archivePreviousPageButton: document.querySelector("#archive-previous-page-btn"),
  archiveNextPageButton: document.querySelector("#archive-next-page-btn"),
  statusPill: document.querySelector("#status-pill"),
  selectAllButton: document.querySelector("#select-all-btn"),
  clearSelectionButton: document.querySelector("#clear-selection-btn"),
  copyLatestButton: document.querySelector("#copy-latest-btn"),
  copySelectedButton: document.querySelector("#copy-selected-btn"),
  copyAllButton: document.querySelector("#copy-all-btn"),
  archiveSelectedButton: document.querySelector("#archive-selected-btn"),
  archiveAllButton: document.querySelector("#archive-all-btn"),
  archiveSelectAllButton: document.querySelector("#archive-select-all-btn"),
  archiveClearSelectionButton: document.querySelector("#archive-clear-selection-btn"),
  restoreSelectedButton: document.querySelector("#restore-selected-btn"),
  deleteArchivedSelectedButton: document.querySelector("#delete-archived-selected-btn"),
  navTabs: document.querySelectorAll("[data-view]"),
  viewPanels: document.querySelectorAll("[data-panel]"),
  snippetForm: document.querySelector("#snippet-form"),
  snippetId: document.querySelector("#snippet-id"),
  snippetShortcut: document.querySelector("#snippet-shortcut"),
  snippetText: document.querySelector("#snippet-text"),
  snippetCancelButton: document.querySelector("#snippet-cancel-btn"),
  snippetsList: document.querySelector("#snippets-list"),
  clipboardHistory: document.querySelector("#clipboard-history"),
  clipboardClearButton: document.querySelector("#clipboard-clear-btn"),
  clipboardPushForm: document.querySelector("#clipboard-push-form"),
  clipboardPushText: document.querySelector("#clipboard-push-text"),
  clipboardPushButton: document.querySelector("#clipboard-push-btn"),
  settingsForm: document.querySelector("#settings-form"),
  screenshotHotkey: document.querySelector("#screenshot-hotkey"),
  imageModal: document.querySelector("#image-modal"),
  modalImage: document.querySelector("#modal-image"),
  previousImageButton: document.querySelector("#previous-image-btn"),
  nextImageButton: document.querySelector("#next-image-btn"),
  cropModeButton: document.querySelector("#crop-mode-btn"),
  copyCropButton: document.querySelector("#copy-crop-btn"),
  copyViewedImageButton: document.querySelector("#copy-viewed-image-btn"),
  cropSelection: document.querySelector("#crop-selection"),
  cropHint: document.querySelector("#crop-hint"),
  confirmModal: document.querySelector("#confirm-modal"),
  confirmTitle: document.querySelector("#confirm-title"),
  confirmMessage: document.querySelector("#confirm-message"),
  confirmCancelButton: document.querySelector("#confirm-cancel-btn"),
  confirmAcceptButton: document.querySelector("#confirm-accept-btn"),
  toast: document.querySelector("#toast"),
};

let toastTimer = null;
let confirmationResolver = null;

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

function confirmAction({ title, message, confirmLabel = "Confirm", danger = true }) {
  if (confirmationResolver) {
    confirmationResolver(false);
  }

  elements.confirmTitle.textContent = title;
  elements.confirmMessage.textContent = message;
  elements.confirmAcceptButton.textContent = confirmLabel;
  elements.confirmAcceptButton.classList.toggle("button-danger", danger);
  elements.confirmAcceptButton.classList.toggle("button-primary", !danger);
  elements.confirmModal.hidden = false;
  document.body.classList.add("modal-open");
  elements.confirmCancelButton.focus();

  return new Promise((resolve) => {
    confirmationResolver = resolve;
  });
}

function closeConfirmation(confirmed) {
  if (!confirmationResolver) {
    return;
  }

  elements.confirmModal.hidden = true;
  document.body.classList.remove("modal-open");
  const resolve = confirmationResolver;
  confirmationResolver = null;
  resolve(confirmed);
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

function screenshotById(id, items = state.items) {
  return items.find((item) => item.id === id);
}

function setBusy(isBusy) {
  state.busy = isBusy;
  render();
  updateCropSelection();
}

async function loadDashboard(silent = false) {
  try {
    if (!silent) setStatus("Loading...");
    const { screenshots, archive, stats, snippets, config, clipboard } = await api.loadDashboard(state.archivePage);
    const archivePageCount = Math.max(1, Math.ceil(archive.total / archive.limit));
    if (state.archivePage > archivePageCount) {
      state.archivePage = archivePageCount;
      return loadDashboard(silent);
    }

    const currentIds = state.items.map((item) => item.id).join(",");
    const newIds = screenshots.items.map((item) => item.id).join(",");
    const currentArchiveIds = state.archivedItems.map((item) => item.id).join(",");
    const newArchiveIds = archive.items.map((item) => item.id).join(",");
    const archiveTotalChanged = state.archiveTotal !== archive.total;

    const currentSnippetIds = state.snippets.map(i => `${i.id}:${i.updatedAt}`).join(",");
    const newSnippetIds = snippets.items.map(i => `${i.id}:${i.updatedAt}`).join(",");
    const configChanged = state.config?.screenshot_hotkey !== config.screenshot_hotkey;
    const clipboardChanged = JSON.stringify(state.clipboard.history) !== JSON.stringify(clipboard.history);

    if (
      currentIds !== newIds ||
      currentArchiveIds !== newArchiveIds ||
      archiveTotalChanged ||
      currentSnippetIds !== newSnippetIds ||
      configChanged ||
      clipboardChanged ||
      !state.stats
    ) {
      const validIds = new Set(screenshots.items.map((item) => item.id));
      state.items = screenshots.items;
      state.archivedItems = archive.items;
      state.archiveTotal = archive.total;
      state.snippets = snippets.items;
      state.config = config;
      state.clipboard = clipboard;
      state.stats = stats;
      state.selectedIds = new Set([...state.selectedIds].filter((id) => validIds.has(id)));
      render();
    }

    setStatus(`${state.items.length} active · ${state.archiveTotal} archived`);
  } catch (error) {
    setStatus("Backend offline");
    if (!silent) showToast(error.message);
  }
}


function renderToolbar() {
  elements.screenshotCount.textContent = `${state.items.length} screenshots`;
  elements.selectionCount.textContent = `${state.selectedIds.size} selected`;
  elements.archiveCount.textContent = `${state.archiveTotal}`;
  elements.archiveScreenshotCount.textContent = `${state.archiveTotal} archived`;
  elements.archiveSelectionCount.textContent = `${state.selectedArchiveIds.size} selected`;
  const archivePageCount = Math.max(1, Math.ceil(state.archiveTotal / 100));
  elements.archivePageLabel.textContent = `Page ${state.archivePage} of ${archivePageCount}`;

  const hasActiveItems = state.items.length > 0;
  const hasArchivedItems = state.archivedItems.length > 0;
  const hasSelection = state.selectedIds.size > 0;
  const hasArchiveSelection = state.selectedArchiveIds.size > 0;
  elements.copyLatestButton.disabled = !hasActiveItems || state.busy;
  elements.copySelectedButton.disabled = !hasSelection || state.busy;
  elements.copyAllButton.disabled = !hasActiveItems || state.busy;
  elements.archiveSelectedButton.disabled = !hasSelection || state.busy;
  elements.archiveAllButton.disabled = !hasActiveItems || state.busy;
  elements.clearSelectionButton.disabled = !hasSelection || state.busy;
  elements.selectAllButton.disabled = !hasActiveItems || state.busy;
  elements.restoreSelectedButton.disabled = !hasArchiveSelection || state.busy;
  elements.deleteArchivedSelectedButton.disabled = !hasArchiveSelection || state.busy;
  elements.archiveClearSelectionButton.disabled = !hasArchiveSelection || state.busy;
  elements.archiveSelectAllButton.disabled = !hasArchivedItems || state.busy;
  elements.archivePreviousPageButton.disabled = state.archivePage <= 1 || state.busy;
  elements.archiveNextPageButton.disabled = state.archivePage >= archivePageCount || state.busy;
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

function renderClipboard() {
  const history = state.clipboard?.history || [];
  elements.clipboardClearButton.disabled = history.length === 0;
  if (history.length === 0) {
    elements.clipboardHistory.innerHTML = '<div class="empty-state compact-empty"><div><h3>No copied text yet</h3><p>Text copied on the desktop client will appear here.</p></div></div>';
    return;
  }
  elements.clipboardHistory.innerHTML = history.map((entry) => `
    <article class="clipboard-entry">
      <div class="clipboard-entry-header">
        <time>${escapeHtml(formatDate(entry.updatedAt))}</time>
        <button class="button button-danger icon-btn" type="button" data-clipboard-action="delete" data-id="${escapeHtml(entry.id)}" title="Delete history entry" aria-label="Delete history entry"><i class="ph ph-trash"></i></button>
      </div>
      <pre>${escapeHtml(entry.content)}</pre>
    </article>
  `).join("");
}

function renderImageCards(items, container, archived = false) {
  if (items.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="ph ${archived ? "ph-archive" : "ph-image"}" aria-hidden="true"></i>
        <div>
          <h3>${archived ? "Archive is empty" : "Waiting for screenshots..."}</h3>
          <p>${archived
            ? "Images older than 30 minutes and images you archive will appear here."
            : "Use your desktop hotkey to capture. Screenshots stay here for 30 minutes before archiving."}</p>
        </div>
      </div>
    `;
    return;
  }

  const selectedIds = archived ? state.selectedArchiveIds : state.selectedIds;
  container.innerHTML = items
    .map((item) => {
      const selected = selectedIds.has(item.id);
      const cardClasses = ["shot-card", selected ? "is-selected" : ""].filter(Boolean).join(" ");

      return `
        <article class="${cardClasses}" data-id="${escapeHtml(item.id)}">
          <div class="shot-preview">
            <button
              class="button select-pill"
              type="button"
              data-action="toggle-select"
              data-id="${escapeHtml(item.id)}"
              aria-pressed="${selected}"
              aria-label="${selected ? "Deselect" : "Select"} screenshot"
              title="${selected ? "Deselect" : "Select"}"
            >
              <i class="ph ${selected ? 'ph-check-circle' : 'ph-circle'}"></i>
            </button>
            <div class="shot-hover-actions">
              <button class="button button-secondary icon-btn" type="button" data-action="copy-one" data-id="${escapeHtml(item.id)}" title="Copy image" aria-label="Copy image">
                <i class="ph ph-copy"></i>
              </button>
              <button class="button button-primary icon-btn" type="button" data-action="view-one" data-id="${escapeHtml(item.id)}" title="View" aria-label="View image">
                <i class="ph ph-arrows-out-simple"></i>
              </button>
            </div>
            <img src="${escapeHtml(item.image_url || "")}" alt="Screenshot ${escapeHtml(item.label || item.filename || item.id)}" loading="lazy" />
          </div>

          <div class="shot-body">
            <div class="shot-heading">
              <h3 class="shot-title">${escapeHtml(item.label || item.filename || "Screenshot")}</h3>
              <p class="shot-meta">${archived ? `Archived ${formatDate(item.archived_at)}` : `Added ${formatDate(item.received_at)}`}</p>
            </div>

            <div class="card-actions">
              ${archived
                ? `<button class="button button-secondary icon-btn" type="button" data-action="restore-one" data-id="${escapeHtml(item.id)}" title="Restore to dashboard" aria-label="Restore to dashboard"><i class="ph ph-arrow-u-up-left"></i></button>
                   <button class="button button-danger icon-btn" type="button" data-action="delete-permanently-one" data-id="${escapeHtml(item.id)}" title="Delete permanently" aria-label="Delete permanently"><i class="ph ph-trash"></i></button>`
                : `<button class="button button-secondary icon-btn" type="button" data-action="archive-one" data-id="${escapeHtml(item.id)}" title="Move to archive" aria-label="Move to archive"><i class="ph ph-archive"></i></button>`}
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
  renderSnippets();
  renderSettings();
  renderClipboard();
  renderImageCards(state.items, elements.screenshotsContainer);
  renderImageCards(state.archivedItems, elements.archiveContainer, true);
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

function toggleArchiveSelection(id) {
  if (state.selectedArchiveIds.has(id)) {
    state.selectedArchiveIds.delete(id);
  } else {
    state.selectedArchiveIds.add(id);
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
  if (!snippet || !(await confirmAction({
    title: "Delete snippet?",
    message: `Delete the “${snippet.shortcut}” snippet? This cannot be undone.`,
    confirmLabel: "Delete snippet",
  }))) {
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

async function pushClipboard(event) {
  event.preventDefault();
  try {
    elements.clipboardPushButton.disabled = true;
    const response = await api.pushClipboard(elements.clipboardPushText.value);
    showToast(response.delivered ? "Sent to the desktop clipboard." : "Desktop client is offline; nothing was sent.");
  } catch (error) {
    showToast(error.message);
  } finally {
    elements.clipboardPushButton.disabled = false;
  }
}

async function deleteClipboardHistoryEntry(id) {
  try {
    const response = await api.deleteClipboardHistoryEntry(id);
    state.clipboard = { history: response.history };
    renderClipboard();
  } catch (error) {
    showToast(error.message);
  }
}

async function clearClipboardHistory() {
  if (!window.confirm("Clear all clipboard history? This cannot be undone.")) return;
  try {
    const response = await api.clearClipboardHistory();
    state.clipboard = { history: response.history };
    renderClipboard();
  } catch (error) {
    showToast(error.message);
  }
}

function handleClipboardHistoryClick(event) {
  const button = event.target.closest("[data-clipboard-action]");
  if (button?.dataset.clipboardAction === "delete") void deleteClipboardHistoryEntry(button.dataset.id);
}

function connectRealtime() {
  if (typeof window.io !== "function") return;
  const socket = window.io();
  const updateClipboard = (clipboard) => {
    if (!clipboard || !Array.isArray(clipboard.history)) return;
    state.clipboard = clipboard;
    renderClipboard();
  };
  socket.on("state_snapshot", (snapshot) => updateClipboard(snapshot?.clipboard));
  socket.on("clipboard_updated", updateClipboard);
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
  if (!context) {
    throw new Error("Unable to prepare the screenshot image.");
  }
  context.drawImage(image, 0, 0);
  return canvasToPngBlob(canvas);
}

function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((pngBlob) => {
      if (pngBlob) {
        resolve(pngBlob);
      } else {
        reject(new Error("Unable to create the PNG image."));
      }
    }, "image/png");
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
  if (!context) {
    throw new Error("Unable to prepare the contact sheet.");
  }
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

  return canvasToPngBlob(canvas);
}

async function fetchSelectedImageBlobs(ids, items = state.items) {
  const chosenItems = items.filter((item) => ids.includes(item.id));
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

async function copyImages(ids, items = state.items) {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new Error("Your browser does not support image clipboard writes.");
  }

  const blobs = await fetchSelectedImageBlobs(ids, items);
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

async function copyFromItems(ids, items, successMessage) {
  try {
    setBusy(true);
    const mode = await copyImages(ids, items);
    showToast(mode === "contact-sheet"
      ? "Copied a contact sheet because this browser cannot copy multiple images at once."
      : successMessage);
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

async function copySelected() {
  await copyFromItems(
    [...state.selectedIds],
    state.items,
    "Copied the selected screenshots to the clipboard."
  );
}

async function copyAll() {
  await copyFromItems(
    state.items.map((item) => item.id),
    state.items,
    "Copied all dashboard screenshots to the clipboard."
  );
}

async function copyLatest() {
  const latest = state.items[0];
  if (!latest) {
    showToast("There are no dashboard screenshots to copy.");
    return;
  }

  await copyFromItems([latest.id], state.items, "Copied the newest screenshot to the clipboard.");
}

function activeViewerItem() {
  return state.viewerItems[state.viewerIndex] || null;
}

function updateCropSelection() {
  const rect = state.cropRect;
  elements.cropSelection.hidden = !rect;
  elements.copyCropButton.disabled = !rect || state.busy;
  if (rect) {
    elements.cropSelection.style.left = `${rect.x * 100}%`;
    elements.cropSelection.style.top = `${rect.y * 100}%`;
    elements.cropSelection.style.width = `${rect.width * 100}%`;
    elements.cropSelection.style.height = `${rect.height * 100}%`;
  }
}

function resetCropSelection() {
  state.cropStart = null;
  state.cropRect = null;
  updateCropSelection();
}

function renderViewerItem() {
  const item = activeViewerItem();
  if (!item?.image_url) {
    closeImageModal();
    return;
  }

  elements.modalImage.src = item.image_url;
  elements.modalImage.alt = `Screenshot ${item.label || item.filename || item.id}`;
  elements.previousImageButton.disabled = state.viewerIndex <= 0 || state.busy;
  elements.nextImageButton.disabled = state.viewerIndex >= state.viewerItems.length - 1 || state.busy;
  elements.cropModeButton.disabled = state.busy;
  elements.copyViewedImageButton.disabled = state.busy;
  elements.cropModeButton.classList.toggle("is-active", state.cropMode);
  elements.cropHint.hidden = !state.cropMode;
  elements.modalImage.classList.toggle("is-cropping", state.cropMode);
  resetCropSelection();
}

function openImageModal(id, items = state.items) {
  const item = screenshotById(id, items);
  if (!item?.image_url) {
    showToast("Unable to open screenshot.");
    return;
  }

  state.viewerItems = items;
  state.viewerIndex = items.findIndex((entry) => entry.id === id);
  state.cropMode = false;
  elements.imageModal.hidden = false;
  document.body.classList.add("modal-open");
  renderViewerItem();
}

function closeImageModal() {
  elements.imageModal.hidden = true;
  elements.modalImage.removeAttribute("src");
  elements.modalImage.alt = "";
  state.viewerItems = [];
  state.viewerIndex = -1;
  state.cropMode = false;
  resetCropSelection();
  document.body.classList.remove("modal-open");
}

function navigateViewer(offset) {
  const nextIndex = state.viewerIndex + offset;
  if (nextIndex < 0 || nextIndex >= state.viewerItems.length) {
    return;
  }
  state.viewerIndex = nextIndex;
  renderViewerItem();
}

function toggleCropMode() {
  state.cropMode = !state.cropMode;
  resetCropSelection();
  elements.cropModeButton.classList.toggle("is-active", state.cropMode);
  elements.cropHint.hidden = !state.cropMode;
  elements.modalImage.classList.toggle("is-cropping", state.cropMode);
}

function imagePoint(event) {
  const bounds = elements.modalImage.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
    y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)),
  };
}

function beginCrop(event) {
  if (!state.cropMode || event.button !== 0) {
    return;
  }
  event.preventDefault();
  state.cropStart = imagePoint(event);
  state.cropRect = { x: state.cropStart.x, y: state.cropStart.y, width: 0, height: 0 };
  elements.modalImage.setPointerCapture(event.pointerId);
  updateCropSelection();
}

function updateCrop(event) {
  if (!state.cropStart) {
    return;
  }
  const point = imagePoint(event);
  const left = Math.min(state.cropStart.x, point.x);
  const top = Math.min(state.cropStart.y, point.y);
  state.cropRect = {
    x: left,
    y: top,
    width: Math.abs(point.x - state.cropStart.x),
    height: Math.abs(point.y - state.cropStart.y),
  };
  updateCropSelection();
}

function finishCrop(event) {
  if (!state.cropStart) {
    return;
  }
  updateCrop(event);
  state.cropStart = null;
  if (state.cropRect && (state.cropRect.width < 1 / elements.modalImage.naturalWidth ||
    state.cropRect.height < 1 / elements.modalImage.naturalHeight)) {
    resetCropSelection();
  }
}

async function copyCrop() {
  const rect = state.cropRect;
  const image = elements.modalImage;
  if (!rect || !image.naturalWidth || !image.naturalHeight) {
    showToast("Select an area of the image first.");
    return;
  }
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    showToast("Your browser does not support image clipboard writes.");
    return;
  }

  try {
    setBusy(true);
    const sourceX = Math.min(image.naturalWidth - 1, Math.round(rect.x * image.naturalWidth));
    const sourceY = Math.min(image.naturalHeight - 1, Math.round(rect.y * image.naturalHeight));
    const width = Math.min(
      image.naturalWidth - sourceX,
      Math.max(1, Math.round(rect.width * image.naturalWidth))
    );
    const height = Math.min(
      image.naturalHeight - sourceY,
      Math.max(1, Math.round(rect.height * image.naturalHeight))
    );
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Unable to prepare the selected crop.");
    }
    context.drawImage(image, sourceX, sourceY, width, height, 0, 0, width, height);
    const blob = await canvasToPngBlob(canvas);
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    showToast("Cropped image copied to the clipboard.");
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

async function copyViewedImage() {
  const item = activeViewerItem();
  if (item) {
    await copyFromItems([item.id], state.viewerItems, "Copied screenshot to the clipboard.");
  }
}

async function archiveScreenshots(ids, confirm = false) {
  if (ids.length === 0) {
    return;
  }
  if (confirm && !(await confirmAction({
    title: "Archive all dashboard images?",
    message: `${ids.length} image${ids.length === 1 ? "" : "s"} will leave the dashboard and remain available in Archive.`,
    confirmLabel: "Archive all",
  }))) {
    return;
  }

  try {
    setBusy(true);
    if (ids.length === 1 && !confirm) {
      await api.archiveScreenshot(ids[0]);
    } else {
      await api.archiveScreenshots(ids);
    }
    await loadDashboard(true);
    showToast(ids.length === 1 ? "Image moved to Archive." : `${ids.length} images moved to Archive.`);
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

async function restoreScreenshots(ids) {
  if (ids.length === 0) {
    return;
  }
  try {
    setBusy(true);
    if (ids.length === 1) {
      await api.restoreScreenshot(ids[0]);
    } else {
      await api.restoreScreenshots(ids);
    }
    ids.forEach((id) => state.selectedArchiveIds.delete(id));
    await loadDashboard(true);
    showToast(ids.length === 1 ? "Image restored to the dashboard." : `${ids.length} images restored to the dashboard.`);
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

async function permanentlyDeleteScreenshots(ids) {
  if (ids.length === 0 || !(await confirmAction({
    title: "Delete archived images permanently?",
    message: `${ids.length} image${ids.length === 1 ? "" : "s"} will be permanently removed. This cannot be undone.`,
    confirmLabel: "Delete permanently",
  }))) {
    return;
  }

  try {
    setBusy(true);
    if (ids.length === 1) {
      await api.permanentlyDeleteScreenshot(ids[0]);
    } else {
      await api.permanentlyDeleteScreenshots(ids);
    }
    ids.forEach((id) => state.selectedArchiveIds.delete(id));
    await loadDashboard(true);
    showToast(ids.length === 1 ? "Image permanently deleted." : `${ids.length} images permanently deleted.`);
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

function handleScreenshotClick(event, archived = false) {
  const button = event.target.closest("[data-action]");
  if (!button) {
    return;
  }

  const action = button.dataset.action;
  const id = button.dataset.id;

  if (action === "toggle-select") {
    archived ? toggleArchiveSelection(id) : toggleSelection(id);
    return;
  }

  if (action === "copy-one") {
    void copyFromItems(
      [id],
      archived ? state.archivedItems : state.items,
      "Copied screenshot to the clipboard."
    );
    return;
  }

  if (action === "view-one") {
    openImageModal(id, archived ? state.archivedItems : state.items);
    return;
  }

  if (action === "archive-one") {
    void archiveScreenshots([id]);
    return;
  }

  if (action === "restore-one") {
    void restoreScreenshots([id]);
    return;
  }

  if (action === "delete-permanently-one") {
    void permanentlyDeleteScreenshots([id]);
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

  elements.copyLatestButton.addEventListener("click", () => {
    void copyLatest();
  });
  elements.copySelectedButton.addEventListener("click", () => {
    void copySelected();
  });
  elements.copyAllButton.addEventListener("click", () => {
    void copyAll();
  });
  elements.archiveSelectedButton.addEventListener("click", () => {
    void archiveScreenshots([...state.selectedIds]);
  });
  elements.archiveAllButton.addEventListener("click", () => {
    void archiveScreenshots(state.items.map((item) => item.id), true);
  });
  elements.archiveSelectAllButton.addEventListener("click", () => {
    state.archivedItems.forEach((item) => state.selectedArchiveIds.add(item.id));
    render();
  });
  elements.archiveClearSelectionButton.addEventListener("click", () => {
    state.selectedArchiveIds.clear();
    render();
  });
  elements.archivePreviousPageButton.addEventListener("click", () => {
    state.archivePage -= 1;
    void loadDashboard(true);
  });
  elements.archiveNextPageButton.addEventListener("click", () => {
    state.archivePage += 1;
    void loadDashboard(true);
  });
  elements.restoreSelectedButton.addEventListener("click", () => {
    void restoreScreenshots([...state.selectedArchiveIds]);
  });
  elements.deleteArchivedSelectedButton.addEventListener("click", () => {
    void permanentlyDeleteScreenshots([...state.selectedArchiveIds]);
  });

  elements.screenshotsContainer.addEventListener("click", handleScreenshotClick);
  elements.archiveContainer.addEventListener("click", (event) => {
    handleScreenshotClick(event, true);
  });
  elements.snippetForm.addEventListener("submit", saveSnippet);
  elements.snippetCancelButton.addEventListener("click", resetSnippetForm);
  elements.snippetsList.addEventListener("click", handleSnippetClick);
  elements.settingsForm.addEventListener("submit", saveSettings);
  elements.clipboardPushForm.addEventListener("submit", pushClipboard);
  elements.clipboardHistory.addEventListener("click", handleClipboardHistoryClick);
  elements.clipboardClearButton.addEventListener("click", () => void clearClipboardHistory());
  elements.confirmCancelButton.addEventListener("click", () => closeConfirmation(false));
  elements.confirmAcceptButton.addEventListener("click", () => closeConfirmation(true));
  elements.confirmModal.addEventListener("click", (event) => {
    if (event.target.classList.contains("confirm-backdrop")) {
      closeConfirmation(false);
    }
  });
  elements.previousImageButton.addEventListener("click", () => navigateViewer(-1));
  elements.nextImageButton.addEventListener("click", () => navigateViewer(1));
  elements.cropModeButton.addEventListener("click", toggleCropMode);
  elements.copyCropButton.addEventListener("click", () => {
    void copyCrop();
  });
  elements.copyViewedImageButton.addEventListener("click", () => {
    void copyViewedImage();
  });
  elements.modalImage.addEventListener("pointerdown", beginCrop);
  elements.modalImage.addEventListener("pointermove", updateCrop);
  elements.modalImage.addEventListener("pointerup", finishCrop);
  elements.modalImage.addEventListener("pointercancel", finishCrop);
  elements.imageModal.addEventListener("click", (event) => {
    if (event.target.closest("[data-modal-close]")) {
      closeImageModal();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !elements.confirmModal.hidden) {
      closeConfirmation(false);
    } else if (event.key === "Escape" && !elements.imageModal.hidden) {
      closeImageModal();
    } else if (!elements.imageModal.hidden && event.key === "ArrowLeft") {
      navigateViewer(-1);
    } else if (!elements.imageModal.hidden && event.key === "ArrowRight") {
      navigateViewer(1);
    }
  });
}

bindEvents();
resetSnippetForm();
render();
void loadDashboard();
connectRealtime();

// Start silent polling every 3 seconds for background updates
setInterval(() => {
  if (!state.busy) {
    void loadDashboard(true);
  }
}, 3000);
