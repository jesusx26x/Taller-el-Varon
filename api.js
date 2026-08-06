/**
 * TALLER EL VARÓN - API & STORE CLIENT
 * Interfaz de comunicación con Google Apps Script + Modo Local/Demo
 */

// Si colocas la URL del despliegue de Apps Script aquí, se conectará a Google Sheets.
// Si se deja vacío, utilizará el almacenamiento local (localStorage) con datos demo iniciales.
const CONFIG = {
  API_URL: localStorage.getItem("taller_api_url") || "https://script.google.com/macros/s/AKfycbzxuBcAfHGUDdtSoou9I9i_ZT-kl58YCFb2F-Sxm1iPi2BeHpb3Z_ijIUbdMRaBZazj/exec",
  TOKEN_KEY: "taller_session_token",
  USER_KEY: "taller_user_info",
  LOCAL_DB_KEY: "taller_el_varon_db_v1"
};

// Base de Datos inicial vacía para producción
const DEMO_DATABASE = {
  clientes: [],
  vehiculos: [],
  ordenes: [],
  detalleServicios: [],
  fotos: []
};

// Inicializar Base de Datos en localStorage si no existe
function initLocalStore() {
  const current = localStorage.getItem(CONFIG.LOCAL_DB_KEY);
  if (!current) {
    localStorage.setItem(CONFIG.LOCAL_DB_KEY, JSON.stringify(DEMO_DATABASE));
  }
}

function getLocalStore() {
  initLocalStore();
  return JSON.parse(localStorage.getItem(CONFIG.LOCAL_DB_KEY));
}

function saveLocalStore(db) {
  localStorage.setItem(CONFIG.LOCAL_DB_KEY, JSON.stringify(db));
}

/**
 * Cliente API universal
 */
const API = {
  isCloudMode: () => {
    return CONFIG.API_URL && CONFIG.API_URL.trim() !== "";
  },

  setApiUrl: (url) => {
    CONFIG.API_URL = url ? url.trim() : "";
    localStorage.setItem("taller_api_url", CONFIG.API_URL);
  },

  getApiUrl: () => CONFIG.API_URL,

  login: async (usuario, clave) => {
    if (API.isCloudMode()) {
      try {
        const resp = await fetch(CONFIG.API_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ action: "login", data: { usuario, clave } })
        });
        const json = await resp.json();
        if (json.status === "success") {
          localStorage.setItem(CONFIG.TOKEN_KEY, json.data.token);
          localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(json.data));
          return json.data;
        } else {
          throw new Error(json.message || "Credenciales incorrectas");
        }
      } catch (err) {
        console.warn("Fallo al conectar con Apps Script. Intentando credenciales en modo local:", err);
      }
    }

    // Validación Local (Offline / Demo)
    if (usuario === "prosario" && clave === "tallerelvaron") {
      const data = {
        token: "TOKEN_LOCAL_PABLO_ROSARIO",
        usuario: "Pablo Rosario",
        taller: "Taller El Varón (Modo Local)"
      };
      localStorage.setItem(CONFIG.TOKEN_KEY, data.token);
      localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(data));
      return data;
    } else {
      throw new Error("Usuario o contraseña incorrectos. (Prueba con prosario / tallerelvaron)");
    }
  },

  logout: () => {
    localStorage.removeItem(CONFIG.TOKEN_KEY);
    localStorage.removeItem(CONFIG.USER_KEY);
  },

  isAuthenticated: () => {
    return !!localStorage.getItem(CONFIG.TOKEN_KEY);
  },

  obtenerTodo: async () => {
    if (API.isCloudMode()) {
      try {
        const resp = await fetch(CONFIG.API_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({
            action: "obtenerTodo",
            token: localStorage.getItem(CONFIG.TOKEN_KEY)
          })
        });
        const json = await resp.json();
        if (json.status === "success") {
          // Actualizamos la copia local para cache
          saveLocalStore(json.data);
          return json.data;
        }
      } catch (err) {
        console.warn("No se pudo sincronizar con la nube. Cargando datos locales:", err);
      }
    }
    return getLocalStore();
  },

  crearCliente: async (cliente) => {
    if (API.isCloudMode()) {
      try {
        const resp = await fetch(CONFIG.API_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({
            action: "crearCliente",
            token: localStorage.getItem(CONFIG.TOKEN_KEY),
            data: cliente
          })
        });
        const json = await resp.json();
        if (json.status === "success") return json.data;
      } catch (e) {
        console.error("Error al guardar cliente en la nube:", e);
      }
    }

    // Simulación Local
    const db = getLocalStore();
    const newId = "CLI-" + String(db.clientes.length + 1).padStart(4, "0");
    const nuevoCliente = {
      id: newId,
      ...cliente,
      fechaRegistro: new Date().toISOString().split("T")[0]
    };
    db.clientes.push(nuevoCliente);
    saveLocalStore(db);
    return nuevoCliente;
  },

  crearVehiculo: async (vehiculo) => {
    if (API.isCloudMode()) {
      try {
        const resp = await fetch(CONFIG.API_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({
            action: "crearVehiculo",
            token: localStorage.getItem(CONFIG.TOKEN_KEY),
            data: vehiculo
          })
        });
        const json = await resp.json();
        if (json.status === "success") return json.data;
      } catch (e) {
        console.error("Error al guardar vehículo en la nube:", e);
      }
    }

    // Simulación Local
    const db = getLocalStore();
    const newId = "VEH-" + String(db.vehiculos.length + 1).padStart(4, "0");
    const nuevoVehiculo = {
      id: newId,
      ...vehiculo
    };
    db.vehiculos.push(nuevoVehiculo);
    saveLocalStore(db);
    return nuevoVehiculo;
  },

  crearOrden: async (ordenData) => {
    if (API.isCloudMode()) {
      try {
        const resp = await fetch(CONFIG.API_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({
            action: "crearOrden",
            token: localStorage.getItem(CONFIG.TOKEN_KEY),
            data: ordenData
          })
        });
        const json = await resp.json();
        if (json.status === "success") return json.data;
      } catch (e) {
        console.error("Error al crear orden en la nube:", e);
      }
    }

    // Simulación Local
    const db = getLocalStore();
    const year = new Date().getFullYear();
    const count = db.ordenes.length + 1;
    const ordenId = `ORD-${year}-${String(count).padStart(4, "0")}`;
    const fechaIngreso = new Date().toISOString();

    let total = 0;
    if (ordenData.servicios && Array.isArray(ordenData.servicios)) {
      ordenData.servicios.forEach((s, idx) => {
        const subtotal = (Number(s.cantidad) || 1) * (Number(s.precioUnitario) || 0);
        total += subtotal;
        db.detalleServicios.push({
          id: `DET-${ordenId}-${idx + 1}`,
          ordenId: ordenId,
          tipo: s.tipo || "Servicio",
          descripcion: s.descripcion,
          cantidad: Number(s.cantidad) || 1,
          precioUnitario: Number(s.precioUnitario) || 0,
          subtotal: subtotal
        });
      });
    }

    const nuevaOrden = {
      id: ordenId,
      clienteId: ordenData.clienteId,
      vehiculoId: ordenData.vehiculoId,
      fechaIngreso: fechaIngreso,
      fechaEntrega: "",
      estado: ordenData.estado || "Pendiente",
      motivoVisita: ordenData.motivoVisita || "",
      diagnostico: ordenData.diagnostico || "",
      kilometrajeEntrada: Number(ordenData.kilometrajeEntrada) || 0,
      montoTotal: total,
      notas: ordenData.notas || ""
    };

    db.ordenes.push(nuevaOrden);
    saveLocalStore(db);
    return nuevaOrden;
  },

  actualizarEstadoOrden: async (ordenId, nuevoEstado) => {
    const fechaEntrega = nuevoEstado === "Entregado" ? new Date().toISOString() : "";

    if (API.isCloudMode()) {
      try {
        const resp = await fetch(CONFIG.API_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({
            action: "actualizarEstadoOrden",
            token: localStorage.getItem(CONFIG.TOKEN_KEY),
            data: { ordenId, nuevoEstado, fechaEntrega }
          })
        });
        const json = await resp.json();
        if (json.status === "success") return json.data;
      } catch (e) {
        console.error("Error al actualizar estado en la nube:", e);
      }
    }

    // Local
    const db = getLocalStore();
    const ord = db.ordenes.find(o => o.id === ordenId);
    if (ord) {
      ord.estado = nuevoEstado;
      if (nuevoEstado === "Entregado") {
        ord.fechaEntrega = fechaEntrega || new Date().toISOString();
      } else {
        ord.fechaEntrega = ""; // Limpiar si se revierte estado
      }
      saveLocalStore(db);
    }
    return ord;
  },

  agregarServicioAOrden: async (ordenId, tipo, descripcion, cantidad, precioUnitario) => {
    const cant = Number(cantidad) || 1;
    const precio = Number(precioUnitario) || 0;
    const subtotal = cant * precio;

    if (API.isCloudMode()) {
      try {
        const resp = await fetch(CONFIG.API_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({
            action: "agregarServicioAOrden",
            token: localStorage.getItem(CONFIG.TOKEN_KEY),
            data: { ordenId, tipo, descripcion, cantidad: cant, precioUnitario: precio }
          })
        });
        const json = await resp.json();
        if (json.status === "success") return json.data;
      } catch (e) {
        console.error("Error al agregar ítem en la nube:", e);
      }
    }

    // Local
    const db = getLocalStore();
    const nuevoDetalle = {
      id: `DET-${Date.now()}`,
      ordenId: ordenId,
      tipo: tipo,
      descripcion: descripcion,
      cantidad: cant,
      precioUnitario: precio,
      subtotal: subtotal
    };
    db.detalleServicios.push(nuevoDetalle);

    // Actualizar total orden
    const ord = db.ordenes.find(o => o.id === ordenId);
    if (ord) {
      const items = db.detalleServicios.filter(d => d.ordenId === ordenId);
      ord.montoTotal = items.reduce((acc, curr) => acc + curr.subtotal, 0);
    }

    saveLocalStore(db);
    return nuevoDetalle;
  },

  subirFoto: async (ordenId, base64, nombreArchivo, descripcion) => {
    if (API.isCloudMode()) {
      try {
        const resp = await fetch(CONFIG.API_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({
            action: "subirFoto",
            token: localStorage.getItem(CONFIG.TOKEN_KEY),
            data: { ordenId, base64, nombreArchivo, descripcion }
          })
        });
        const json = await resp.json();
        if (json.status === "success") return json.data;
      } catch (e) {
        console.error("Error al subir foto a Google Drive:", e);
      }
    }

    // Local / Base64 Data URL
    const db = getLocalStore();
    const nuevaFoto = {
      id: `IMG-${Date.now()}`,
      ordenId: ordenId,
      url: base64,
      descripcion: descripcion || "Evidencia fotográfica",
      fechaSubida: new Date().toISOString()
    };
    db.fotos.push(nuevaFoto);
    saveLocalStore(db);
    return nuevaFoto;
  }
};
