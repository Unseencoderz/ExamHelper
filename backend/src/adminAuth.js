const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const express = require("express");
const { ADMIN_SESSION_SECRET, ADMIN_SESSION_TTL_HOURS, ADMIN_SESSION_CONFIGURED } = require("./config");
const { requireSupabase, throwIfDatabaseError } = require("./supabase");

const ADMIN_USERNAME = "admin";
const SESSION_COOKIE = "examhelper_admin_session";
const SESSION_TTL_SECONDS = ADMIN_SESSION_TTL_HOURS * 60 * 60;

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function sign(value) {
  return crypto.createHmac("sha256", ADMIN_SESSION_SECRET).update(value).digest("base64url");
}

function parseCookies(header = "") {
  return Object.fromEntries(header.split(";").map((entry) => entry.trim()).filter(Boolean).map((entry) => {
    const separator = entry.indexOf("=");
    if (separator === -1) return [entry, ""];
    try { return [entry.slice(0, separator), decodeURIComponent(entry.slice(separator + 1))]; }
    catch { return [entry.slice(0, separator), ""]; }
  }));
}

function createSession() {
  const body = encode({ username: ADMIN_USERNAME, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS });
  return `${body}.${sign(body)}`;
}

function readSession(req) {
  if (!ADMIN_SESSION_CONFIGURED) return null;
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = sign(body);
  if (Buffer.byteLength(signature) !== Buffer.byteLength(expected) || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return payload.username === ADMIN_USERNAME && Number(payload.exp) > Math.floor(Date.now() / 1000) ? payload : null;
  } catch { return null; }
}

function sessionCookie(value, maxAge = SESSION_TTL_SECONDS) {
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}

async function readAdminPasswordHash() {
  const { data, error } = await requireSupabase().from("admin_settings").select("password_hash").eq("id", true).maybeSingle();
  throwIfDatabaseError(error, "read admin password");
  if (data?.password_hash) return data.password_hash;
  const missing = new Error("Admin password is not configured. Set it in Supabase using the documented SQL.");
  missing.statusCode = 503;
  throw missing;
}

function requireAdminSession(req, res, next) {
  if (!ADMIN_SESSION_CONFIGURED) return res.status(503).json({ error: "Admin sessions are not configured. Set ADMIN_SESSION_SECRET." });
  const session = readSession(req);
  if (!session) return res.status(401).json({ error: "Admin login required." });
  req.adminSession = session;
  return next();
}

function createAdminAuthRouter() {
  const router = express.Router();

  router.post("/auth/login", async (req, res) => {
    try {
      const username = typeof req.body?.username === "string" ? req.body.username : "";
      const password = typeof req.body?.password === "string" ? req.body.password : "";
      if (!ADMIN_SESSION_CONFIGURED) return res.status(503).json({ error: "Admin sessions are not configured. Set ADMIN_SESSION_SECRET." });
      if (username !== ADMIN_USERNAME) return res.status(401).json({ error: "Invalid username or password." });
      const passwordHash = await readAdminPasswordHash();
      if (!await bcrypt.compare(password, passwordHash)) return res.status(401).json({ error: "Invalid username or password." });
      res.setHeader("Set-Cookie", sessionCookie(createSession()));
      return res.json({ status: "authenticated", user: { username: ADMIN_USERNAME }, expires_in_seconds: SESSION_TTL_SECONDS });
    } catch (error) { return res.status(error.statusCode || 500).json({ error: error.message || "Unable to sign in." }); }
  });

  router.post("/auth/logout", (req, res) => {
    res.setHeader("Set-Cookie", sessionCookie("", 0));
    res.json({ status: "logged_out" });
  });

  router.get("/auth/session", (req, res) => {
    const session = readSession(req);
    res.json(session ? { authenticated: true, user: { username: ADMIN_USERNAME }, expires_at: new Date(session.exp * 1000).toISOString() } : { authenticated: false });
  });

  return router;
}

module.exports = { createAdminAuthRouter, requireAdminSession };
