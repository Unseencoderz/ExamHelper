# ExamHelper backend API reference

This document describes the API implemented by the current backend. All HTTP and Socket.IO endpoints are **same-origin relative paths**: use paths such as `/screenshots`, `/auth/login`, and `/socket.io`; there is no configurable API base URL and no frontend CORS setup required.

HTTP JSON requests should use `Content-Type: application/json`. The server accepts JSON bodies up to 8 MB. Screenshot upload is the one multipart endpoint. IDs are opaque strings (normally UUIDs) and ISO timestamps are strings in ISO 8601 UTC format.

## Shared conventions

### Admin session

The only credential used by the HTTP API is the HttpOnly cookie named `examhelper_admin_session`. `POST /auth/login` sets it. Since it is HttpOnly, the frontend must not try to read it; same-origin `fetch` sends it normally (and `credentials: "same-origin"` is a safe explicit setting).

Protected endpoints return one of these without a valid session:

```json
{ "error": "Admin login required." }
```

with HTTP `401`, or, if the backend has no `ADMIN_SESSION_SECRET` configured, HTTP `503` with:

```json
{ "error": "Admin sessions are not configured. Set ADMIN_SESSION_SECRET." }
```

### Common object shapes

`Screenshot`:

```ts
type CloudinaryAsset = {
  asset_id: string;
  public_id: string;
  secure_url: string;
  bytes: number;
  format: string;
  uploaded_at: string; // ISO timestamp
};

type Screenshot = {
  id: string;
  device_id: string;
  timestamp: string; // supplied capture timestamp or receipt timestamp
  label: string;
  source: string;
  tags: string[];
  filename: string;
  size_bytes: number;
  mimetype: string | null;
  received_at: string; // ISO timestamp
  status: "active" | "archived";
  dashboard_since?: string | null;
  archived_at: string | null;
  cloudinary: CloudinaryAsset | null;
  cloudinary_url: string | null;
  image_url: string | null; // same URL as cloudinary_url
};
```

The persistence layer can normalize older rows, so fields marked optional above may be absent in an individual response if their source data does not contain them.

`Snippet`:

```ts
type Snippet = {
  id: string;
  shortcut: string;
  text: string;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
};
```

`ClipboardEntry` and configuration:

```ts
type ClipboardEntry = { id: string; content: string; updatedAt: string };
type Clipboard = { history: ClipboardEntry[] };
type AppConfig = { screenshot_hotkey: string };
```

Most application-data endpoints require Supabase. If it is not configured, they return HTTP `503` with an error that begins `Supabase is not configured.`. A Supabase operation failure is typically HTTP `502` and has an error beginning `Supabase ... failed:`. Screenshot upload additionally needs Cloudinary; when it is not configured it returns HTTP `503` with an error beginning `Cloudinary is not configured.`.

## Health and connection status

### `GET /health`

Public. Returns backend capability/configuration status.

Success `200`:

```ts
{
  status: "ok";
  timestamp: string;
  max_screenshots: number;
  cloudinary_archive_configured: boolean;
  supabase_configured: boolean;
  admin_session_configured: boolean;
}
```

### `GET /desktop-status`

Public. Returns whether the most recently connected desktop Socket.IO client is currently connected.

Success `200`: `{ connected: boolean }`.

### `GET /client-state`

Public. Fetches all currently persisted snippets, configuration, and clipboard history in one response.

Success `200`:

```ts
{ snippets: Snippet[]; config: AppConfig; clipboard: Clipboard }
```

Typical failure: `500` or propagated storage status with `{ error: "Unable to load client state." }`.

### `GET /stats`

Public. Aggregates screenshot counts and active-screenshot storage usage.

Success `200`:

```ts
{
  total_screenshots: number;     // active only
  archived_screenshots: number;
  total_size_mb: string;         // decimal string with two digits, e.g. "12.34"
  days_with_data: number;        // distinct YYYY-MM-DD values among active screenshots
  storage_dir: "cloudinary";
  max_screenshots: number;
}
```

Typical failure: `500` or storage failure with `{ error: "Unable to calculate stats." }`.

## Authentication

### `POST /auth/login`

Public. Validates the fixed username `admin` and configured password, then creates the admin session cookie.

JSON body:

```ts
{ username: string; password: string }
```

Success `200`, with `Set-Cookie: examhelper_admin_session=...; Path=/; HttpOnly; SameSite=Lax; ...`:

```ts
{ status: "authenticated"; user: { username: "admin" }; expires_in_seconds: number }
```

Typical errors: `401` `{ error: "Invalid username or password." }`; `503` when sessions are not configured or the admin password is absent; `502` for a database failure.

### `POST /auth/logout`

Public; it does not require an existing valid session. Clears the session cookie.

No body. Success `200`: `{ status: "logged_out" }` and a `Set-Cookie` header with `Max-Age=0`.

### `GET /auth/session`

Public. Checks the cookie if present.

Success `200` when authenticated:

```ts
{ authenticated: true; user: { username: "admin" }; expires_at: string }
```

Success `200` when no session, invalid session, expired session, or sessions are unconfigured:

```ts
{ authenticated: false }
```

## Screenshots and archive

The active screenshot endpoints are public. Archiving an active screenshot is also public. Listing archived items, restoring archived items, and permanently deleting archived items require the admin session.

Active screenshots are automatically moved to the archive after 30 minutes from `dashboard_since` (or `received_at` if absent). The server also archives oldest active screenshots whenever the configured active limit is exceeded. These lifecycle actions do not emit a Socket.IO event.

### `POST /upload`

Public. Uploads an image directly to Cloudinary and stores its metadata. This endpoint uses `multipart/form-data`, not JSON.

Form fields:

```ts
{
  screenshot: File;              // required; one file, JPEG, PNG, or WebP; max configured size (80 MB by default)
  id?: string;                   // generated UUID if omitted
  device_id?: string;            // defaults to "unknown-device"
  timestamp?: string;            // defaults to receipt timestamp
  label?: string;                // defaults to "screenshot"
  source?: string;               // defaults to ""
  tags?: string | string[];      // stored then normalized to string[]; JSON-array and comma-delimited strings are supported
}
```

Success `201`: `{ status: "stored", item: Screenshot, archived: string[] }`, where `archived` contains active screenshot IDs moved to the archive because of the limit.

Typical errors: `400` `{ error: string }` for a missing/empty file, a disallowed MIME type, multipart error, or size limit; `409` `{ status: "duplicate", id: string }` when the supplied/generated ID already exists; `503` for missing Cloudinary/Supabase configuration; `502` for remote storage failure; `500` `{ error: "Internal server error." }` for an unhandled failure.

### `GET /screenshots`

Public. Lists active screenshots, newest receipt timestamp first.

Query parameters: `page?: integer` (default `1`, minimum `1`); `limit?: integer` (default `100`, clamped to `1..200`); `source?: string` (exact match); `tag?: string` (item must include it).

Success `200`: `{ total: number, page: number, limit: number, items: Screenshot[] }`.

Typical error: `500` or storage failure, `{ error: "Unable to list screenshots." }`.

### `PATCH /screenshots/:id`

Public. Updates active or archived screenshot metadata; only supplied supported fields change.

Path parameter: `id: string`.

JSON body:

```ts
{ tags?: string[] | string; source?: string }
```

`tags` uses the same JSON-array/comma-delimited normalization as upload. A non-string `source` is ignored; a string is trimmed.

Success `200`: `{ status: "updated", item: Screenshot }`.

Typical errors: `404` `{ error: "Screenshot not found." }`; `500` or storage failure `{ error: "Unable to update screenshot metadata." }`.

### `DELETE /screenshots/:id`

Public. Moves an active screenshot to the archive. Calling it for an already archived ID returns that archived item successfully.

Path parameter: `id: string`. No body.

Success `200`: `{ status: "archived", item: Screenshot }`.

Typical errors: `404` `{ error: "Screenshot not found." }`; otherwise `500`/storage failure with `{ error: string }`.

### `POST /screenshots/bulk-delete`

Public. Moves the listed active screenshots to the archive. Missing IDs and already archived IDs are silently omitted from `items`.

JSON body: `{ ids: unknown[] }`. The handler accepts only an array, stringifies values, and de-duplicates them; an empty/non-array value is invalid.

Success `200`: `{ status: "archived", archived_count: number, items: Screenshot[] }`.

Typical errors: `400` `{ error: "No screenshot ids were provided." }`; otherwise `500`/storage failure `{ error: string }`.

### `GET /archive`

Admin session required. Lists archived screenshots, newest receipt timestamp first.

Query parameters: `page?: integer` and `limit?: integer`, with the same defaults/clamping as `GET /screenshots`.

Success `200`: `{ total: number, page: number, limit: number, items: Screenshot[] }`.

No session: `401` or `503` as described in Shared conventions. Typical storage error: `500`/storage failure `{ error: "Unable to list archived screenshots." }`.

### `POST /archive/:id/restore`

Admin session required. Restores one archived screenshot to active status, then may archive older active screenshots to enforce the active limit (those additional IDs are not returned).

Path parameter: `id: string`. No body.

Success `200`: `{ status: "restored", item: Screenshot }`.

Typical errors: session `401`/`503`; `404` `{ error: "Archived screenshot not found." }`; otherwise `500`/storage failure `{ error: "Unable to restore archived screenshot." }`.

### `POST /screenshots/bulk-restore`

Admin session required. Restores each requested archived screenshot. Unknown and active IDs are silently omitted.

JSON body: `{ ids: unknown[] }` (array only; entries are stringified and de-duplicated).

Success `200`: `{ status: "restored", restored_count: number, items: Screenshot[] }`.

Typical errors: session `401`/`503`; `400` `{ error: "No screenshot ids were provided." }`; otherwise `500`/storage failure `{ error: "Unable to restore selected screenshots." }`.

### `DELETE /archive/:id`

Admin session required. Permanently deletes an archived screenshot from Cloudinary and its metadata record.

Path parameter: `id: string`. No body.

Success `200`: `{ status: "deleted", item: Screenshot }`.

Typical errors: session `401`/`503`; `404` `{ error: "Archived screenshot not found." }`; otherwise `500` or storage/Cloudinary failure `{ error: string }`.

### `DELETE /archive/bulk-delete`

Admin session required. Permanently deletes each requested archived screenshot. Unknown and active IDs are silently omitted.

JSON body: `{ ids: unknown[] }` (array only; entries are stringified and de-duplicated).

Success `200`: `{ status: "deleted", deleted_count: number, items: Screenshot[] }`.

Typical errors: session `401`/`503`; `400` `{ error: "No archived screenshot ids were provided." }`; otherwise `500` or storage/Cloudinary failure `{ error: string }`.

## Snippets

All snippet endpoints are public. They emit the documented Socket.IO notification after a successful write.

### `GET /snippets`

Public. Lists snippets in ascending creation time.

Success `200`: `{ items: Snippet[] }`.

Typical error: `500`/storage failure `{ error: "Unable to load snippets." }`.

### `POST /snippets`

Public. Creates a text snippet.

JSON body: `{ shortcut: string; text?: string }`. `shortcut` is required, trimmed, at most 40 characters, and cannot contain whitespace. `text` defaults to `""` and must be at most 8,000 characters.

Success `201`: `{ status: "created", item: Snippet }`.

Typical errors: `400` `{ error: "Shortcut is required and must be 40 characters or fewer." }`, `{ error: "Shortcut cannot contain whitespace." }`, or `{ error: "Snippet text must be 8000 characters or fewer." }`; `409` `{ error: "A snippet with this shortcut already exists." }` (case-insensitive); otherwise `500`/storage failure `{ error: string }`.

### `PATCH /snippets/:id`

Public. Updates a snippet. Omitted `shortcut`/`text` values retain their existing values.

Path parameter: `id: string`. JSON body: `{ shortcut?: string; text?: string }`, with the same validation as creation.

Success `200`: `{ status: "updated", item: Snippet }`.

Typical errors: `404` `{ error: "Snippet not found." }`; validation `400`; duplicate shortcut `409`; otherwise `500`/storage failure `{ error: string }`.

### `DELETE /snippets/:id`

Public. Deletes one snippet.

Path parameter: `id: string`. No body.

Success `200`: `{ status: "deleted", item: Snippet }`.

Typical errors: `404` `{ error: "Snippet not found." }`; `500` `{ error: "Unable to delete snippet." }`.

## App configuration

Both configuration endpoints require the admin session. Updating config broadcasts the new hotkey through Socket.IO.

### `GET /config`

Admin session required. Reads the screenshot hotkey; the server falls back to its configured default (normally `Win+Alt+C`) when no usable stored value exists.

Success `200`: `AppConfig` (`{ screenshot_hotkey: string }`).

No session: `401`/`503`. Typical storage error: `500`/storage failure `{ error: "Unable to load configuration." }`.

### `PATCH /config`

Admin session required. Updates only `screenshot_hotkey`; other body properties are ignored.

JSON body: `{ screenshot_hotkey?: string }`. A valid hotkey is a `+`-separated string with at least two tokens, exactly one non-modifier key, and any number of recognized modifiers: `ctrl`, `control`, `shift`, `alt`, `win`, `windows`, or `cmd` (case-insensitive). Whitespace around tokens is removed.

Success `200`: `{ status: "updated", config: AppConfig }`.

Typical errors: session `401`/`503`; `400` `{ error: "Screenshot hotkey must include modifiers and one key." }`; otherwise `500`/storage failure `{ error: string }`.

## Clipboard

All clipboard endpoints are public. Clipboard history has at most 50 entries; duplicate content equal to the newest entry is not stored again.

### `GET /clipboard`

Public. Lists history newest first.

Success `200`: `Clipboard` (`{ history: ClipboardEntry[] }`).

Typical error: `500`/storage failure `{ error: "Unable to load clipboard history." }`.

### `POST /clipboard/push`

Public. Sends plain text to the currently connected desktop Socket.IO client without writing it to history. If no desktop client is connected, the request still succeeds with `delivered: false`.

JSON body: `{ content: string }`.

Success `200`: `{ status: "pushed", delivered: boolean }`.

Typical error: `400` `{ error: "Clipboard content must be plain text." }` when `content` is absent or not a string.

### `DELETE /clipboard/history`

Public. Deletes all clipboard history, then broadcasts the empty history.

No body. Success `200`: `{ history: [] }`.

Typical error: `500`/storage failure `{ error: "Unable to clear clipboard history." }`.

### `DELETE /clipboard/history/:id`

Public. Deletes one clipboard history entry, then broadcasts the remaining history.

Path parameter: `id: string`. No body.

Success `200`: `{ history: ClipboardEntry[] }`.

Typical errors: `404` `{ error: "Clipboard history entry not found." }`; otherwise `500`/storage failure `{ error: "Unable to delete clipboard history entry." }`.

## Socket.IO (`/socket.io`)

Connect to the same origin with Socket.IO. The server creates Socket.IO with permissive CORS internally, but the web UI is same-origin and does not need cross-origin configuration. **Socket connections do not use or validate the admin session.** Every connection receives an initial state snapshot and its own current desktop-status event.

To identify the desktop companion, connect with either `auth: { client: "desktop" }` or query `{ client: "desktop" }`. The last socket to identify as desktop is the connection targeted by `/clipboard/push`; the server does not reserve a room or use an auth token. If that socket disconnects, desktop status becomes disconnected. A generic browser connection must not identify as `desktop`.

There is no custom reconnect protocol. Use normal Socket.IO reconnect behavior. Each successful (re)connection receives a fresh `state_snapshot` and `desktop_status_changed`; the client should replace its synchronized snippet/config/clipboard state from that snapshot.

### Client -> server events

| Event | Payload | When to emit | Server behavior |
| --- | --- | --- | --- |
| `clipboard:update` | `{ content: string }` or a plain `string` | Desktop companion emits this after it observes new plain-text clipboard content. | Invalid payloads are ignored. New content is appended to persistent history unless it duplicates the newest entry; when appended, `clipboard_updated` is broadcast to every connected client. No acknowledgement is sent. |

### Server -> client events

| Event | Payload | When sent | Delivery |
| --- | --- | --- | --- |
| `state_snapshot` | `{ snippets: Snippet[], config: AppConfig, clipboard: Clipboard }` | Immediately after every connection. If loading persistent state fails: `{ snippets: [], config: {}, clipboard: { history: [] } }`. | Targeted to the newly connected socket. |
| `desktop_status_changed` | `{ connected: boolean }` | Immediately after every connection; also when a desktop-identified socket connects or the current desktop socket disconnects. | The connection-time event is targeted to that socket. Connect/disconnect changes are broadcast to all sockets. |
| `snippet_created` | `Snippet` | After a successful `POST /snippets`. | Broadcast to all connected clients. |
| `snippet_updated` | `Snippet` | After a successful `PATCH /snippets/:id`. | Broadcast to all connected clients. |
| `snippet_deleted` | `{ id: string, shortcut: string }` | After a successful `DELETE /snippets/:id`. | Broadcast to all connected clients. |
| `hotkey_changed` | `{ screenshot_hotkey: string }` | After a successful `PATCH /config`. | Broadcast to all connected clients. |
| `clipboard_updated` | `{ history: ClipboardEntry[] }` | After a successful client `clipboard:update` that actually adds an entry; after clearing history; or after deleting one history entry. | Broadcast to all connected clients. |
| `clipboard:push` | `{ content: string }` | After `POST /clipboard/push`, only when a desktop socket is connected. | Targeted only to the currently registered desktop socket. |

## Non-API frontend hosting behavior

`GET /` serves the built frontend's `index.html` when present. Static files from the built frontend directory are served before API routing. If the built `index.html` is absent, `GET /` returns `404` with plain text `web-frontend/index.html is missing.`. Unknown API paths have Express's default 404 response rather than a defined JSON error contract.

The frontend itself enforces the admin session gate for the Archive and Settings views: both views render a login form when `GET /auth/session` returns `{ authenticated: false }`. The backend enforces the session independently on the affected endpoints (`GET /archive`, `POST /archive/:id/restore`, `DELETE /archive/:id`, `DELETE /archive/bulk-delete`, `POST /screenshots/bulk-restore`, `GET /config`, `PATCH /config`).
