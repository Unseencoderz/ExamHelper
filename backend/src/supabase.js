const { createClient } = require("@supabase/supabase-js");
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_CONFIGURED } = require("./config");

const supabase = SUPABASE_CONFIGURED
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  : null;

function requireSupabase() {
  if (supabase) return supabase;
  const error = new Error("Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  error.statusCode = 503;
  throw error;
}

function throwIfDatabaseError(error, action) {
  if (!error) return;
  const wrapped = new Error(`Supabase ${action} failed: ${error.message}`);
  wrapped.statusCode = 502;
  throw wrapped;
}

module.exports = { requireSupabase, throwIfDatabaseError };
