/**
 * TALLER EL VARÓN - sync.js
 * Motor de sincronización del Outbox con Google Apps Script.
 * - FIFO (respeta el orden: cliente -> vehículo -> orden -> detalle/foto).
 * - Envía opId para idempotencia en el backend (además del upsert por id).
 * - Backoff exponencial ante fallos; reintenta al volver la conexión.
 * - Emite el evento "taller-sync" para el indicador de estado del header.
 * Expone el objeto global SYNC.
 */

let SYNCING = false;
let _backoff = 0;
let _retryTimer = null;
let _lastMs = 0;

function _online() { return (typeof navigator === "undefined") ? true : navigator.onLine; }
function _cloud() { return CONFIG.API_URL && CONFIG.API_URL.trim() !== ""; }

function emit() {
  try {
    window.dispatchEvent(new CustomEvent("taller-sync", {
      detail: { online: _online(), cloud: _cloud(), pending: STORE.outbox().length, syncing: SYNCING, ms: _lastMs, errored: STORE.outbox().filter(function (o) { return o.error; }).length }
    }));
  } catch (e) { /* sin window/CustomEvent */ }
}

async function post(action, extra) {
  const resp = await fetch(CONFIG.API_URL, {
    method: "POST",
    redirect: "follow",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(Object.assign({ action: action, token: localStorage.getItem(CONFIG.TOKEN_KEY) }, extra || {}))
  });
  return resp.json();
}

function scheduleRetry() {
  if (_retryTimer) return;
  const delay = Math.min(30000, 1000 * Math.pow(2, _backoff++));
  _retryTimer = setTimeout(() => { _retryTimer = null; flush(); }, delay);
}

// Sube toda la cola en UNA sola petición (endpoint "batch"); si el backend no lo
// soporta, cae automáticamente al envío por operación.
async function flush() {
  await STORE.ready();
  if (!_cloud() || !_online() || SYNCING) { emit(); return; }
  const q = STORE.outbox();
  if (q.length === 0) { emit(); return; }

  SYNCING = true; emit();
  const _t0 = Date.now();
  try {
    const ops = q.map(op => ({ opId: op.opId, action: op.action, data: op.data }));
    let json;
    try {
      json = await post("batch", { ops: ops });
    } catch (netErr) {
      scheduleRetry();
      return; // finally libera SYNCING
    }
    if (json && json.status === "success" && Array.isArray(json.data)) {
      const res = {};
      json.data.forEach(r => { if (r && r.opId) res[r.opId] = r; });
      for (let i = q.length - 1; i >= 0; i--) {
        const op = q[i], r = res[op.opId];
        if (r && (r.status === "success" || r.idempotent)) {
          if (r.data && r.data.url) {
            const f = STORE.memDb().fotos.find(x => STORE.eq(x.id, r.data.id));
            if (f) { f.url = r.data.url; if (r.data.driveFileId) f.driveFileId = r.data.driveFileId; }
          }
          q.splice(i, 1);
        } else if (r && r.status === "error") {
          op.tries = (op.tries || 0) + 1;
          op.lastError = r.message || "error";
          console.warn("El servidor rechazó una operación:", op.action, r.message);
          if (op.tries >= 5) op.error = true; // NO se descarta: se conserva y se avisa en la UI
        }
      }
      STORE.persist(); _backoff = 0; _lastMs = Date.now() - _t0;
      if (q.length > 0) scheduleRetry();
    } else {
      // Backend sin "batch": respaldo por operación.
      await _flushPorOperacion(q);
    }
  } finally {
    SYNCING = false; emit();
  }
}

// Respaldo: envía la cola de a una operación (backend antiguo).
async function _flushPorOperacion(q) {
  let intentos = q.length; // guarda: no repetir indefinidamente en un mismo flush
  while (q.length > 0 && intentos-- > 0) {
    const op = q[0];
    let json;
    try {
      json = await post(op.action, { data: op.data, opId: op.opId });
    } catch (netErr) { scheduleRetry(); break; }
    if (json && json.status === "success") {
      if (op.action === "subirFoto" && json.data && json.data.url) {
        const f = STORE.memDb().fotos.find(x => STORE.eq(x.id, op.data.id));
        if (f) { f.url = json.data.url; if (json.data.driveFileId) f.driveFileId = json.data.driveFileId; }
      }
      q.shift(); STORE.persist(); _backoff = 0;
    } else {
      op.tries = (op.tries || 0) + 1;
      op.lastError = (json && json.message) || "error";
      if (op.tries >= 5) { op.error = true; q.push(q.shift()); STORE.persist(); } // conserva y rota (no se pierde)
      else { STORE.persist(); scheduleRetry(); break; }
    }
  }
}

const SYNC = { flush, emit, post, isSyncing: () => SYNCING };
if (typeof window !== "undefined") window.SYNC = SYNC;

// Arranque y reacción a cambios de conectividad.
STORE.ready().then(() => { emit(); flush(); });
if (typeof window !== "undefined") {
  window.addEventListener("online", () => { emit(); flush(); });
  window.addEventListener("offline", () => { emit(); });
}
