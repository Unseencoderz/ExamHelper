const { Server } = require("socket.io");
const { readSnippets } = require("./snippets/store");
const { readAppConfig } = require("./appConfig/store");
const { readClipboard, appendClipboard } = require("./clipboard/store");

function getClientState() { return { snippets: readSnippets(), config: readAppConfig(), clipboard: readClipboard() }; }
function createRealtime(server) {
  const io = new Server(server, { cors: { origin: "*" } });
  let desktopSocketId = null;

  io.on("connection", (socket) => {
    if (socket.handshake.query.client === "desktop" || socket.handshake.auth?.client === "desktop") desktopSocketId = socket.id;
    socket.emit("state_snapshot", getClientState());
    socket.on("clipboard:update", (payload) => {
      const content = typeof payload?.content === "string" ? payload.content : typeof payload === "string" ? payload : null;
      if (content === null) return;
      const clipboard = appendClipboard(content);
      if (clipboard.added) io.emit("clipboard_updated", { history: clipboard.history });
    });
    socket.on("disconnect", () => {
      if (desktopSocketId === socket.id) desktopSocketId = null;
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
  };
}

module.exports = { createRealtime, getClientState };
