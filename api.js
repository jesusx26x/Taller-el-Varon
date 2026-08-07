/**
 * TALLER EL VARÓN - api.js  (cliente público, offline-first)
 * Interfaz estable que usa app.js. Delega el almacenamiento en store.js y la
 * sincronización en sync.js. Cada escritura:
 *   1) sella el registro (uuid/createdAt/updatedAt),
 *   2) lo aplica de inmediato en local (respuesta instantánea, con o sin red),
 *   3) lo encola en el Outbox y dispara la sincronización en segundo plano.
 * Los borrados son lógicos (tombstones) para no "revivir" registros al fusionar.
 */

// Encola: aplica localmente + guarda + sincroniza.
function _enqueue(action, data) {
  const op = { opId: uid(), action: action, data: data, ts: nowISO(), tries: 0 };
  STORE.applyOp(STORE.memDb(), op);
  STORE.outbox().push(op);
  STORE.persist();
  SYNC.emit();
  SYNC.flush();
  return op;
}

const API = {
  isCloudMode: () => CONFIG.API_URL && CONFIG.API_URL.trim() !== "",
  setApiUrl: (url) => { CONFIG.API_URL = url ? url.trim() : ""; localStorage.setItem("taller_api_url", CONFIG.API_URL); SYNC.emit(); },
  getApiUrl: () => CONFIG.API_URL,

  ready: () => STORE.ready(),
  getLocalStore: () => STORE.visibleDb(STORE.memDb()),
  getPendingCount: () => STORE.outbox().length,
  sync: async () => { await STORE.ready(); await SYNC.flush(); },

  login: async (usuario, clave) => {
    if (API.isCloudMode()) {
      try {
        const json = await SYNC.post("login", { data: { usuario, clave } });
        if (json.status === "success" && json.data) {
          localStorage.setItem(CONFIG.TOKEN_KEY, json.data.token || "TOKEN_PABLO_ROSARIO");
          localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(json.data));
          return json.data;
        } else { throw new Error(json.message || "Usuario o contraseña incorrectos"); }
      } catch (err) { console.warn("Fallo en login de nube. Intentando validación local:", err); }
    }
    if (usuario === "prosario" && clave === "tallerelvaron") {
      const data = { token: "TOKEN_LOCAL_PABLO_ROSARIO", usuario: "Pablo Rosario", taller: "Taller El Varón (Modo Local)" };
      localStorage.setItem(CONFIG.TOKEN_KEY, data.token);
      localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(data));
      return data;
    }
    throw new Error("Usuario o contraseña incorrectos.");
  },

  logout: () => { localStorage.removeItem(CONFIG.TOKEN_KEY); localStorage.removeItem(CONFIG.USER_KEY); },
  isAuthenticated: () => !!localStorage.getItem(CONFIG.TOKEN_KEY),

  // Descarga con merge: sube lo pendiente, baja la nube y reaplica el Outbox.
  // Conserva los tombstones (para que un borrado no reaparezca) y da prioridad a
  // lo pendiente local (last-write-wins efectivo: la nube ya refleja lo último confirmado).
  obtenerTodo: async () => {
    await STORE.ready();
    if (API.isCloudMode() && (typeof navigator === "undefined" || navigator.onLine)) {
      try {
        await SYNC.flush();
        const json = await SYNC.post("obtenerTodo", {});
        if (json.status === "success" && json.data) {
          const merged = STORE.sanitizeDb(json.data);
          STORE.outbox().forEach(op => { try { STORE.applyOp(merged, op); } catch (e) { } });
          STORE.setMem(merged);
          STORE.persist();
          SYNC.emit();
          return STORE.visibleDb(merged);
        }
      } catch (err) { console.warn("No se pudo sincronizar con la nube. Datos locales:", err); }
    }
    SYNC.emit();
    return STORE.visibleDb(STORE.memDb());
  },

  // ---- CREACIÓN (uuid + timestamps en el cliente) ----
  crearCliente: async (cliente) => {
    await STORE.ready();
    const rec = STORE.stamp(Object.assign({ id: uid(), fechaRegistro: nowISO().split("T")[0] }, cliente), true);
    _enqueue("crearCliente", rec);
    return rec;
  },
  crearVehiculo: async (vehiculo) => {
    await STORE.ready();
    const rec = STORE.stamp(Object.assign({ id: uid() }, vehiculo), true);
    _enqueue("crearVehiculo", rec);
    return rec;
  },
  crearOrden: async (ordenData) => {
    await STORE.ready();
    const ordenId = folioOrden();
    const servicios = (Array.isArray(ordenData.servicios) ? ordenData.servicios : []).map(s => ({
      id: uid(), uuid: undefined, tipo: s.tipo || "Servicio", descripcion: s.descripcion || "",
      cantidad: Number(s.cantidad) || 1, precioUnitario: Number(s.precioUnitario) || 0
    }));
    servicios.forEach(s => { s.uuid = s.id; });
    const data = STORE.stamp({
      id: ordenId, clienteId: ordenData.clienteId, vehiculoId: ordenData.vehiculoId,
      fechaIngreso: nowISO(), estado: ordenData.estado || "Pendiente",
      motivoVisita: ordenData.motivoVisita || "", diagnostico: ordenData.diagnostico || "",
      kilometrajeEntrada: Number(ordenData.kilometrajeEntrada) || 0, notas: ordenData.notas || "",
      servicios: servicios
    }, true);
    _enqueue("crearOrden", data);
    return STORE.memDb().ordenes.find(o => eq(o.id, ordenId));
  },
  actualizarEstadoOrden: async (ordenId, nuevoEstado) => {
    await STORE.ready();
    _enqueue("actualizarEstadoOrden", { ordenId, nuevoEstado, fechaEntrega: nuevoEstado === "Entregado" ? nowISO() : "", updatedAt: nowISO() });
    return { id: ordenId, estado: nuevoEstado };
  },
  agregarServicioAOrden: async (ordenId, tipo, descripcion, cantidad, precioUnitario) => {
    await STORE.ready();
    const data = STORE.stamp({ id: uid(), ordenId, tipo, descripcion, cantidad: Number(cantidad) || 1, precioUnitario: Number(precioUnitario) || 0 }, true);
    _enqueue("agregarServicioAOrden", data);
    return STORE.memDb().detalleServicios.find(d => eq(d.id, data.id));
  },
  subirFoto: async (ordenId, base64, nombreArchivo, descripcion) => {
    await STORE.ready();
    const data = STORE.stamp({ id: uid(), ordenId, base64, nombreArchivo, descripcion: descripcion || "Evidencia fotográfica" }, true);
    _enqueue("subirFoto", data);
    return STORE.memDb().fotos.find(f => eq(f.id, data.id));
  },

  // ---- EDICIÓN ----
  actualizarCliente: async (cliente) => {
    await STORE.ready();
    const data = Object.assign({}, cliente, { updatedAt: nowISO() });
    _enqueue("actualizarCliente", data);
    return STORE.memDb().clientes.find(c => eq(c.id, cliente.id)) || data;
  },
  actualizarVehiculo: async (vehiculo) => {
    await STORE.ready();
    const data = Object.assign({}, vehiculo, { updatedAt: nowISO() });
    _enqueue("actualizarVehiculo", data);
    return STORE.memDb().vehiculos.find(v => eq(v.id, vehiculo.id)) || data;
  },
  editarServicio: async (detalle) => {
    await STORE.ready();
    const data = { id: detalle.id, ordenId: detalle.ordenId, tipo: detalle.tipo, descripcion: detalle.descripcion, cantidad: Number(detalle.cantidad) || 1, precioUnitario: Number(detalle.precioUnitario) || 0, updatedAt: nowISO() };
    _enqueue("editarServicioDetalle", data);
    return STORE.memDb().detalleServicios.find(d => eq(d.id, data.id));
  },

  // ---- ELIMINACIÓN (lógica / tombstone) ----
  eliminarServicio: async (ordenId, detalleId) => { await STORE.ready(); _enqueue("eliminarServicioDetalle", { id: detalleId, ordenId, deleted: true, deletedAt: nowISO(), updatedAt: nowISO() }); return { id: detalleId, ordenId }; },
  eliminarOrden: async (ordenId) => { await STORE.ready(); _enqueue("eliminarOrden", { ordenId, deleted: true, deletedAt: nowISO(), updatedAt: nowISO() }); return { id: ordenId, eliminado: true }; },
  eliminarCliente: async (id) => { await STORE.ready(); _enqueue("eliminarRegistro", { tabla: "Clientes", id, deleted: true, deletedAt: nowISO(), updatedAt: nowISO() }); return { id, eliminado: true }; },
  eliminarVehiculo: async (id) => { await STORE.ready(); _enqueue("eliminarRegistro", { tabla: "Vehiculos", id, deleted: true, deletedAt: nowISO(), updatedAt: nowISO() }); return { id, eliminado: true }; }
};
if (typeof window !== "undefined") window.API = API;
