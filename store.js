/**
 * TALLER EL VARÓN - store.js
 * Capa de almacenamiento local durable (IndexedDB con respaldo a localStorage)
 * y modelo de datos offline-first (uuid canónico, timestamps y borrado lógico/tombstones).
 * No hace red: eso vive en sync.js. Expone el objeto global STORE.
 */

const CONFIG = {
  API_URL: localStorage.getItem("taller_api_url") || "https://script.google.com/macros/s/AKfycbzxuBcAfHGUDdtSoou9I9i_ZT-kl58YCFb2F-Sxm1iPi2BeHpb3Z_ijIUbdMRaBZazj/exec",

  TOKEN_KEY: "taller_session_token",
  USER_KEY: "taller_user_info",
  LOCAL_DB_KEY: "taller_el_varon_db_v1",
  OUTBOX_KEY: "taller_el_varon_outbox_v1",
  SINCE_KEY: "taller_el_varon_since_v1",
  IDB_NAME: "taller_el_varon",
  IDB_VERSION: 1
};

// Helpers compartidos (globales entre store.js, sync.js y api.js).
const eq = (a, b) => String(a) === String(b);
const nowISO = () => new Date().toISOString();
function uid() { return (typeof UTILS !== "undefined" && UTILS.uuid) ? UTILS.uuid() : ("id-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8)); }
function folioOrden() { return (typeof UTILS !== "undefined" && UTILS.folioOrden) ? UTILS.folioOrden() : ("ORD-" + Date.now()); }

function sanitizeDb(data) {
  if (!data || typeof data !== "object") data = {};
  return {
    clientes: Array.isArray(data.clientes) ? data.clientes : [],
    vehiculos: Array.isArray(data.vehiculos) ? data.vehiculos : [],
    ordenes: Array.isArray(data.ordenes) ? data.ordenes : [],
    detalleServicios: Array.isArray(data.detalleServicios) ? data.detalleServicios : [],
    fotos: Array.isArray(data.fotos) ? data.fotos : []
  };
}
const DEMO_DATABASE = { clientes: [], vehiculos: [], ordenes: [], detalleServicios: [], fotos: [] };

/* ---------------- IndexedDB (con fallback a localStorage) ---------------- */
const IDB = (function () {
  let dbPromise = null;
  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve) => {
      try {
        if (typeof indexedDB === "undefined") return resolve(null);
        const req = indexedDB.open(CONFIG.IDB_NAME, CONFIG.IDB_VERSION);
        req.onupgradeneeded = () => { const db = req.result; if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv"); };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => { console.warn("IndexedDB no disponible:", req.error); resolve(null); };
      } catch (e) { console.warn("IndexedDB error:", e); resolve(null); }
    });
    return dbPromise;
  }
  async function get(key) {
    const db = await open(); if (!db) return undefined;
    return new Promise((resolve) => { try { const tx = db.transaction("kv", "readonly"); const r = tx.objectStore("kv").get(key); r.onsuccess = () => resolve(r.result); r.onerror = () => resolve(undefined); } catch (e) { resolve(undefined); } });
  }
  async function set(key, val) {
    const db = await open(); if (!db) return false;
    return new Promise((resolve) => { try { const tx = db.transaction("kv", "readwrite"); tx.objectStore("kv").put(val, key); tx.oncomplete = () => resolve(true); tx.onerror = () => resolve(false); } catch (e) { resolve(false); } });
  }
  return { get, set };
})();

/* ---------------- Estado en memoria + hidratación ---------------- */
let MEM = null;
let OUTBOX = null;
let READY = null;

function _readLocalDb() { try { return sanitizeDb(JSON.parse(localStorage.getItem(CONFIG.LOCAL_DB_KEY))); } catch (e) { return sanitizeDb(DEMO_DATABASE); } }
function _readLocalOutbox() { try { const a = JSON.parse(localStorage.getItem(CONFIG.OUTBOX_KEY)); return Array.isArray(a) ? a : []; } catch (e) { return []; } }

async function hydrate() {
  let db = await IDB.get("db");
  let ob = await IDB.get("outbox");
  if (!db) { db = _readLocalDb(); await IDB.set("db", db); }
  if (!Array.isArray(ob)) { ob = _readLocalOutbox(); await IDB.set("outbox", ob); }
  MEM = sanitizeDb(db); OUTBOX = ob;
}
function ensureReady() {
  if (!READY) READY = hydrate().catch((e) => { console.error("Fallo hidratando almacenamiento durable, uso localStorage:", e); MEM = _readLocalDb(); OUTBOX = _readLocalOutbox(); });
  return READY;
}
function memDb() { if (!MEM) MEM = _readLocalDb(); return MEM; }
function outbox() { if (!OUTBOX) OUTBOX = _readLocalOutbox(); return OUTBOX; }
function setMem(db) { MEM = sanitizeDb(db); }
function persist() {
  try { localStorage.setItem(CONFIG.LOCAL_DB_KEY, JSON.stringify(MEM)); } catch (e) { /* cuota (fotos) */ }
  try { localStorage.setItem(CONFIG.OUTBOX_KEY, JSON.stringify(OUTBOX)); } catch (e) { }
  IDB.set("db", MEM); IDB.set("outbox", OUTBOX);
}

/* ---------------- Modelo: sellado, colecciones, tombstones ---------------- */
// Añade uuid/createdAt/updatedAt (no pisa lo existente). isNew agrega createdAt.
function stamp(rec, isNew) {
  if (!rec.uuid) rec.uuid = rec.id;
  const t = nowISO();
  if (isNew && !rec.createdAt) rec.createdAt = t;
  rec.updatedAt = t;
  if (rec.deleted === undefined) rec.deleted = false;
  return rec;
}
function upsertArr(arr, obj) {
  if (!obj || obj.id === undefined) { arr.push(obj); return obj; }
  const i = arr.findIndex(x => eq(x.id, obj.id));
  if (i >= 0) arr[i] = Object.assign({}, arr[i], obj); else arr.push(obj);
  return obj;
}
function mergeArr(arr, obj) {
  const i = arr.findIndex(x => eq(x.id, obj.id));
  if (i >= 0) { arr[i] = Object.assign({}, arr[i], obj); return arr[i]; }
  arr.push(obj); return obj;
}
function activos(arr) { return (arr || []).filter(x => x && x.deleted !== true); }
function recalcTotal(db, ordenId) {
  const ord = db.ordenes.find(o => eq(o.id, ordenId));
  if (ord) ord.montoTotal = activos(db.detalleServicios).filter(d => eq(d.ordenId, ordenId)).reduce((s, i) => s + (Number(i.subtotal) || 0), 0);
}
function marcarBorrado(rec, d) {
  if (!rec) return;
  rec.deleted = true;
  rec.deletedAt = d.deletedAt || nowISO();
  rec.updatedAt = d.updatedAt || rec.deletedAt;
}

// Aplica una operación (datos ya sellados) sobre una base en memoria.
// Sirve tanto para escritura optimista local como para merge tras bajar de la nube.
function applyOp(db, op) {
  const d = op.data || {};
  switch (op.action) {
    case "crearCliente": upsertArr(db.clientes, d); break;
    case "actualizarCliente": mergeArr(db.clientes, d); break;
    case "crearVehiculo": upsertArr(db.vehiculos, d); break;
    case "actualizarVehiculo": mergeArr(db.vehiculos, d); break;
    case "crearOrden": {
      let total = 0;
      (d.servicios || []).forEach(s => {
        const cant = Number(s.cantidad) || 1, precio = Number(s.precioUnitario) || 0, sub = cant * precio; total += sub;
        upsertArr(db.detalleServicios, { id: s.id, uuid: s.uuid || s.id, ordenId: d.id, tipo: s.tipo || "Servicio", descripcion: s.descripcion || "", cantidad: cant, precioUnitario: precio, subtotal: sub, deleted: false, createdAt: d.createdAt, updatedAt: d.updatedAt });
      });
      upsertArr(db.ordenes, { id: d.id, uuid: d.uuid || d.id, clienteId: d.clienteId, vehiculoId: d.vehiculoId, fechaIngreso: d.fechaIngreso || nowISO(), fechaEntrega: "", estado: d.estado || (typeof UTILS !== "undefined" && UTILS.ESTADOS_ORDEN ? UTILS.ESTADOS_ORDEN.PENDIENTE : "Pendiente"), motivoVisita: d.motivoVisita || "", diagnostico: d.diagnostico || "", kilometrajeEntrada: Number(d.kilometrajeEntrada) || 0, montoTotal: total, notas: d.notas || "", deleted: false, createdAt: d.createdAt, updatedAt: d.updatedAt });
      break;
    }
    case "actualizarEstadoOrden": {
      const o = db.ordenes.find(x => eq(x.id, d.ordenId));
      if (o) { o.estado = d.nuevoEstado; o.fechaEntrega = d.nuevoEstado === (typeof UTILS !== "undefined" && UTILS.ESTADOS_ORDEN ? UTILS.ESTADOS_ORDEN.ENTREGADO : "Entregado") ? (d.fechaEntrega || nowISO()) : ""; o.updatedAt = d.updatedAt || nowISO(); }
      break;
    }
    case "agregarServicioAOrden": {
      const cant = Number(d.cantidad) || 1, precio = Number(d.precioUnitario) || 0;
      upsertArr(db.detalleServicios, { id: d.id, uuid: d.uuid || d.id, ordenId: d.ordenId, tipo: d.tipo || "Repuesto", descripcion: d.descripcion || "", cantidad: cant, precioUnitario: precio, subtotal: cant * precio, deleted: false, createdAt: d.createdAt, updatedAt: d.updatedAt });
      recalcTotal(db, d.ordenId);
      break;
    }
    case "editarServicioDetalle": {
      const det = db.detalleServicios.find(x => eq(x.id, d.id));
      if (det) { const cant = Number(d.cantidad) || 1, precio = Number(d.precioUnitario) || 0; det.tipo = d.tipo; det.descripcion = d.descripcion; det.cantidad = cant; det.precioUnitario = precio; det.subtotal = cant * precio; det.updatedAt = d.updatedAt || nowISO(); recalcTotal(db, det.ordenId); }
      break;
    }
    case "eliminarServicioDetalle": {
      marcarBorrado(db.detalleServicios.find(x => eq(x.id, d.id)), d);
      recalcTotal(db, d.ordenId);
      break;
    }
    case "eliminarOrden": {
      marcarBorrado(db.ordenes.find(x => eq(x.id, d.ordenId)), d);
      db.detalleServicios.filter(x => eq(x.ordenId, d.ordenId)).forEach(x => marcarBorrado(x, d));
      db.fotos.filter(x => eq(x.ordenId, d.ordenId)).forEach(x => marcarBorrado(x, d));
      break;
    }
    case "eliminarRegistro": {
      const key = d.tabla === "Clientes" ? "clientes" : "vehiculos";
      marcarBorrado(db[key].find(x => eq(x.id, d.id)), d);
      break;
    }
    case "subirFoto": {
      upsertArr(db.fotos, { id: d.id, uuid: d.uuid || d.id, ordenId: d.ordenId, url: d.base64 || d.url, descripcion: d.descripcion || "Evidencia fotográfica", fechaSubida: d.createdAt || nowISO(), deleted: false, createdAt: d.createdAt, updatedAt: d.updatedAt });
      break;
    }
  }
  return db;
}

// Vista "visible" para la UI: sin registros con tombstone.
function visibleDb(db) {
  db = db || memDb();
  return {
    clientes: activos(db.clientes),
    vehiculos: activos(db.vehiculos),
    ordenes: activos(db.ordenes),
    detalleServicios: activos(db.detalleServicios),
    fotos: activos(db.fotos)
  };
}

// FASE C: sincronización incremental (delta por updatedAt).
function getSince() { try { return localStorage.getItem(CONFIG.SINCE_KEY) || ""; } catch (e) { return ""; } }
function setSince(v) { try { if (v) localStorage.setItem(CONFIG.SINCE_KEY, String(v)); } catch (e) {} }
function maxUpdatedAt(data) {
  let mx = "";
  ["clientes", "vehiculos", "ordenes", "detalleServicios", "fotos"].forEach(k => {
    (data[k] || []).forEach(r => { const u = r && r.updatedAt ? String(r.updatedAt) : ""; if (u > mx) mx = u; });
  });
  return mx;
}
// Fusiona filas cambiadas (delta) del servidor dentro de MEM (upsert por id; respeta tombstones).
function mergeDelta(data) {
  const db = memDb();
  const map = { clientes: "clientes", vehiculos: "vehiculos", ordenes: "ordenes", detalleServicios: "detalleServicios", fotos: "fotos" };
  Object.keys(map).forEach(k => { (data[k] || []).forEach(row => { if (row && row.id !== undefined) upsertArr(db[k], row); }); });
  return db;
}

const STORE = {
  CONFIG, ready: ensureReady, memDb, outbox, setMem, persist, applyOp, stamp,
  visibleDb, sanitizeDb, recalcTotal, eq, nowISO, uid, folioOrden,
  getSince, setSince, maxUpdatedAt, mergeDelta, upsertArr
};
if (typeof window !== "undefined") window.STORE = STORE;
