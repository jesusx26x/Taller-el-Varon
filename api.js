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

// Datos iniciales de demostración para primera carga en localStorage
const DEMO_DATABASE = {
  clientes: [
    {
      id: "CLI-0001",
      nombre: "Carlos Mendoza",
      telefono: "809-555-0192",
      cedula: "001-9876543-2",
      email: "carlos.mendoza@email.com",
      notas: "Cliente preferente. Siempre prefiere piezas originales.",
      fechaRegistro: "2026-07-15"
    },
    {
      id: "CLI-0002",
      nombre: "María Rodríguez",
      telefono: "829-555-4810",
      cedula: "002-1234567-8",
      email: "mrodriguez@email.com",
      notas: "Atender en las mañanas.",
      fechaRegistro: "2026-08-01"
    }
  ],
  vehiculos: [
    {
      id: "VEH-0001",
      clienteId: "CLI-0001",
      marca: "Honda",
      modelo: "Civic EX",
      año: 2017,
      color: "Gris Platino",
      placa: "A982341",
      vin: "1HGCR2F83HA091234",
      kilometraje: 84500
    },
    {
      id: "VEH-0002",
      clienteId: "CLI-0002",
      marca: "Toyota",
      modelo: "RAV4 XLE",
      año: 2020,
      color: "Azul Marino",
      placa: "G451209",
      vin: "2T3C1RFV5LW876543",
      kilometraje: 42100
    }
  ],
  ordenes: [
    {
      id: "ORD-2026-0001",
      clienteId: "CLI-0001",
      vehiculoId: "VEH-0001",
      fechaIngreso: "2026-08-01T09:30:00.000Z",
      fechaEntrega: "2026-08-01T17:00:00.000Z",
      estado: "Entregado",
      motivoVisita: "Mantenimiento preventivo de 80,000km, cambio de bujías y revisión de frenos.",
      diagnostico: "Bujías desgastadas por tiempo. Pastillas de freno delanteras al 25% de vida útil.",
      kilometrajeEntrada: 84500,
      montoTotal: 12500,
      notas: "Se entregó constancia impresa al cliente."
    },
    {
      id: "ORD-2026-0002",
      clienteId: "CLI-0002",
      vehiculoId: "VEH-0002",
      fechaIngreso: "2026-08-05T14:15:00.000Z",
      fechaEntrega: "",
      estado: "En Proceso",
      motivoVisita: "Ruido metálico en rueda delantera derecha al frenar y aire acondicionado no enfría suficiente.",
      diagnostico: "Pastillas rozando con el disco. Fuga leve en manguera de freón.",
      kilometrajeEntrada: 42100,
      montoTotal: 8400,
      notas: "Esperando repuesto de manguera A/C."
    }
  ],
  detalleServicios: [
    {
      id: "DET-ORD-2026-0001-1",
      ordenId: "ORD-2026-0001",
      tipo: "Repuesto",
      descripcion: "Juego de Bujías Iridium Honda Original",
      cantidad: 4,
      precioUnitario: 1500,
      subtotal: 6000
    },
    {
      id: "DET-ORD-2026-0001-2",
      ordenId: "ORD-2026-0001",
      tipo: "Mano de Obra",
      descripcion: "Mantenimiento general e instalación de bujías",
      cantidad: 1,
      precioUnitario: 3500,
      subtotal: 3500
    },
    {
      id: "DET-ORD-2026-0001-3",
      ordenId: "ORD-2026-0001",
      tipo: "Repuesto",
      descripcion: "Filtro de Aire de Motor y Gabina",
      cantidad: 2,
      precioUnitario: 1500,
      subtotal: 3000
    },
    {
      id: "DET-ORD-2026-0002-1",
      ordenId: "ORD-2026-0002",
      tipo: "Repuesto",
      descripcion: "Juego Pastillas Frenos Delanteras Ceramic",
      cantidad: 1,
      precioUnitario: 3200,
      subtotal: 3200
    },
    {
      id: "DET-ORD-2026-0002-2",
      ordenId: "ORD-2026-0002",
      tipo: "Mano de Obra",
      descripcion: "Rectificación de discos delanteros y limpieza",
      cantidad: 1,
      precioUnitario: 2800,
      subtotal: 2800
    },
    {
      id: "DET-ORD-2026-0002-3",
      ordenId: "ORD-2026-0002",
      tipo: "Mano de Obra",
      descripcion: "Recarga de Gas Refrigerante R134a",
      cantidad: 1,
      precioUnitario: 2400,
      subtotal: 2400
    }
  ],
  fotos: [
    {
      id: "IMG-1001",
      ordenId: "ORD-2026-0002",
      url: "https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=600&q=80",
      descripcion: "Estado de freno delantero derecho al desmontar",
      fechaSubida: "2026-08-05T14:30:00.000Z"
    }
  ]
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
