const { Server } = require("socket.io");
const { readSnippets } = require("./snippets/store");
const { readAppConfig } = require("./appConfig/store");
const { readClipboard, appendClipboard } = require("./clipboard/store");
const { log } = require("./logger");

async function getClientState() {
  const [snippets, config, clipboard] = await Promise.all([readSnippets(), readAppConfig(), readClipboard()]);
  return { snippets, config, clipboard };
}
function createRealtime(server) {
  const io = new Server(server, { cors: { origin: "*" } });
  let desktopSocketId = null;
  const getDesktopStatus = () => ({ connected: Boolean(desktopSocketId) });
  const broadcastDesktopStatus = () => io.emit("desktop_status_changed", getDesktopStatus());

  io.on("connection", async (socket) => {
    if (socket.handshake.query.client === "desktop" || socket.handshake.auth?.client === "desktop") {
      desktopSocketId = socket.id;
      broadcastDesktopStatus();
    }
    try { socket.emit("state_snapshot", await getClientState()); } catch { socket.emit("state_snapshot", { snippets: [], config: {}, clipboard: { history: [] } }); }
    socket.emit("desktop_status_changed", getDesktopStatus());
    socket.on("clipboard:update", async (payload) => {
      const content = typeof payload?.content === "string" ? payload.content : typeof payload === "string" ? payload : null;
      if (content === null) return;
      try {
        const clipboard = await appendClipboard(content);
        if (clipboard.added) io.emit("clipboard_updated", { history: clipboard.history });
      } catch (error) { log("WARN", "Unable to persist clipboard update", error.message); }
    });
    socket.on("disconnect", () => {
      if (desktopSocketId === socket.id) {
        desktopSocketId = null;
        broadcastDesktopStatus();
      }
    });
  });

  return {
    io,
    broadcastClientEvent(event, payload) { io.emit(event, payload); },
    pushClipboard(content) {
      if (!desktopSocketId) return false;
      io.to(desktopSocketId).emit("clipboard:push", { content });
      return true;
    },
    getDesktopStatus,
  };
}

module.exports = { createRealtime, getClientState };
