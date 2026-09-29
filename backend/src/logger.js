function log(level, message, extra = "") {
  const line = `${new Date().toISOString()} [${level}] ${message} ${extra}`.trimEnd() + "\n";
  process.stdout.write(line);
}

module.exports = { log };
