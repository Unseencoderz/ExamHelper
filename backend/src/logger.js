const fs = require("fs");
const { LOG_FILE } = require("./config");

function log(level, message, extra = "") {
  const line = `${new Date().toISOString()} [${level}] ${message} ${extra}`.trimEnd() + "\n";
  process.stdout.write(line);
  fs.appendFileSync(LOG_FILE, line);
}

module.exports = { log };
