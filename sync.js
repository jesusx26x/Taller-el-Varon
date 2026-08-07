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

function _online() { return (typeof navigator === "undefined") ? true : navigator.onLine; }
function _cloud() { return CONFIG.API_URL && CONFIG.API_URL.trim() !== ""; }

function emit() {
  try {
    window.dispatchEvent(new CustomEvent("taller-sync", {
      detail: { online: _online(), cloud: _cloud(), pending: STORE.outbox().length, syncing: SYNCING }
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

async function flush() {
  await STORE.ready();
  if (!_cloud() || !_online() || SYNCING) { emit(); return; }
  const q = STORE.outbox();
  if (q.length === 0) { emit(); return; }

  SYNCING = true; emit();
  try {
    while (q.length > 0) {
      const op = q[0];
      let json;
      try {
        json = await post(op.action, { data: op.data, opId: op.opId });
      } catch (netErr) {
        scheduleRetry(); // sin conexión a mitad de camino: reintentar luego
        break;
      }
      if (json && json.status === "success") {
        if (op.action === "subirFoto" && json.data && json.data.url) {
          const f = STORE.memDb().fotos.find(x => STORE.eq(x.id, op.data.id));
          if (f) { f.url = json.data.url; if (json.data.driveFileId) f.driveFileId = json.data.driveFileId; }
        }
        q.shift(); STORE.persist(); _backoff = 0;
      } else {
        op.tries = (op.tries || 0) + 1;
        console.warn("El servidor rechazó una operación:", op.action, json && json.message);
        if (op.tries >= 5) { q.shift(); STORE.persist(); }
        else { STORE.persist(); scheduleRetry(); break; }
      }
    }
  } finally {
    SYNCING = false; emit();
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
