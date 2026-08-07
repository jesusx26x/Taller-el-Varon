/**
 * TALLER EL VARÓN - LÓGICA PRINCIPAL (APP.JS)
 */

let STATE = {
  db: null,
  currentView: "dashboard",
  selectedOrdenId: null,
  filterVehiculoId: null   // filtro de historial por vehículo (por ID, no por texto)
};

// Catálogo de Marcas y Modelos del mercado dominicano (sugiere opciones manteniendo libertad de escritura manual)
const CAR_CATALOG = {
  "Honda": ["Civic", "Accord", "CR-V", "HR-V", "Pilot", "Fit", "Odyssey", "Ridgeline", "City", "WR-V"],
  "Toyota": ["Corolla", "Camry", "RAV4", "Hilux", "Yaris", "Highlander", "Fortuner", "Tacoma", "Land Cruiser", "Runner", "Rush", "Sienna", "Prado", "Corolla Cross"],
  "Hyundai": ["Elantra", "Sonata", "Tucson", "Santa Fe", "Accent", "Grand i10", "H-1", "Kona", "Venue", "Palisade", "Creta"],
  "Ford": ["Explorer", "Escape", "Focus", "F-150", "Ranger", "Edge", "Mustang", "EcoSport", "Expedition", "Bronco", "Maverick"],
  "Kia": ["Picanto", "Rio", "Forte", "Optima", "K5", "Sportage", "Sorento", "Telluride", "Soul", "Seltos", "Carnival"],
  "Nissan": ["Sentra", "Altima", "Frontier", "X-Trail", "Qashqai", "Kicks", "Versa", "Pathfinder", "Patrol", "March", "Murano"],
  "Chevrolet": ["Spark", "Aveo", "Cruze", "Tracker", "Captiva", "Tahoe", "Silverado", "Equinox", "Suburban", "Colorado"],
  "Jeep": ["Grand Cherokee", "Wrangler", "Cherokee", "Compass", "Renegade", "Gladiator"],
  "Mitsubishi": ["Lancer", "Outlander", "Montero", "ASX", "L200", "Mirage", "Eclipse Cross"],
  "Mazda": ["Mazda 2", "Mazda 3", "Mazda 6", "CX-3", "CX-30", "CX-5", "CX-9", "BT-50"],
  "Mercedes-Benz": ["C200", "E300", "GLA", "GLC", "GLE", "GLS", "ML350", "Sprinter"],
  "BMW": ["320i", "528i", "740i", "X1", "X3", "X5", "X6", "X7"],
  "Lexus": ["IS250", "ES350", "RX350", "GX460", "LX570", "NX300"],
  "Suzuki": ["Vitara", "Grand Vitara", "Jimny", "Swift", "Baleno", "Ertiga"],
  "Subaru": ["Impreza", "XV", "Forester", "Outback", "WRX"]
};

function normalizeOrderId(id) {
  if (!id) return "";
  return decodeURIComponent(String(id)).trim().replace(/[\s_]+/g, "-").toUpperCase();
}

// INICIALIZACIÓN
document.addEventListener("DOMContentLoaded", async () => {
  initEventListeners();
  checkAuthStatus();
});

function checkAuthStatus() {
  const loginScreen = document.getElementById("login-screen");
  const appContainer = document.getElementById("app-container");

  if (API.isAuthenticated()) {
    loginScreen.style.display = "none";
    appContainer.style.display = "flex";
    cargarDatosYRenderizar();
    handleHashNavigation();
  } else {
    loginScreen.style.display = "flex";
    appContainer.style.display = "none";
  }
}

// FASE 3-4: indicador de estado de sincronización en el header (badge existente).
function actualizarBadgeSync(detail) {
  const badge = document.getElementById("cloud-status-badge");
  if (!badge) return;
  const d = detail || {};
  badge.style.cursor = "pointer";
  let html, title;
  if (!d.cloud) {
    html = '<i class="fas fa-hard-drive" style="color:#64748B;"></i> Modo local';
    title = "Trabajando solo en este dispositivo (sin nube configurada).";
  } else if (!d.online) {
    html = '<i class="fas fa-wifi-slash" style="color:#EF4444;"></i> Sin conexión' + (d.pending ? ' (' + d.pending + ')' : '');
    title = "Sin internet. Tus cambios se guardan y se subirán solos al reconectar.";
  } else if (d.syncing) {
    html = '<i class="fas fa-rotate fa-spin" style="color:#F59E0B;"></i> Sincronizando…';
    title = "Subiendo cambios pendientes…";
  } else if (d.pending > 0) {
    html = '<i class="fas fa-cloud-arrow-up" style="color:#F59E0B;"></i> ' + d.pending + ' por subir';
    title = "Hay cambios pendientes de subir. Toca para sincronizar ahora.";
  } else {
    html = '<i class="fas fa-wifi" style="color:#10B981;"></i> Nube sincronizada';
    title = "Todo sincronizado" + (d.ms ? " · última sync " + d.ms + " ms" : "") + ". Toca para volver a sincronizar.";
  }
  badge.innerHTML = html;
  badge.title = title;
  badge.onclick = () => { if (window.API && API.sync) { API.sync(); reconciliarPronto(0); } };
}

let _primeraCarga = true;

// FASE 5: overlay de carga (solo en la primera carga, para no parpadear en cada refresco).
function mostrarCargando(v) {
  let el = document.getElementById("app-loading-overlay");
  if (v) {
    if (!el) {
      el = document.createElement("div");
      el.id = "app-loading-overlay";
      el.style.cssText = "position:fixed;inset:0;z-index:9998;display:flex;align-items:center;justify-content:center;background:rgba(248,249,250,0.75);";
      el.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;gap:0.6rem;color:var(--color-primary);font-weight:600;"><i class="fas fa-spinner fa-spin" style="font-size:1.9rem;"></i><span>Cargando…</span></div>';
      document.body.appendChild(el);
    }
    el.style.display = "flex";
  } else if (el) {
    el.style.display = "none";
  }
}

// FASE A: pinta al instante desde el estado local (sin esperar la red).
function pintarLocal() {
  try { STATE.db = API.getLocalStore(); renderCurrentView(); } catch (e) { /* noop */ }
}

// FASE A: reconciliación con la nube en segundo plano (no bloquea la UI). Con debounce.
let _reconcileTimer = null;
function reconciliarPronto(delay) {
  clearTimeout(_reconcileTimer);
  _reconcileTimer = setTimeout(async () => {
    try { STATE.db = await API.obtenerTodo(); renderCurrentView(); }
    catch (e) { /* sin conexión: se conserva lo local */ }
  }, delay === undefined ? 700 : delay);
}

// FASE A: tras una escritura, refresca al instante desde local y sincroniza en segundo plano.
function trasEscritura() {
  pintarLocal();
  reconciliarPronto();
}

async function cargarDatosYRenderizar() {
  const first = _primeraCarga;
  // 1) Pinta al instante desde el caché local si hay datos (percepción de velocidad).
  const local = API.getLocalStore();
  const hayLocal = local && ((local.clientes && local.clientes.length) || (local.ordenes && local.ordenes.length) || (local.vehiculos && local.vehiculos.length));
  if (hayLocal) { STATE.db = local; renderCurrentView(); }
  else if (first) mostrarCargando(true);
  // 2) Reconcilia con la nube en segundo plano (la UI ya está pintada).
  try {
    STATE.db = await API.obtenerTodo();
    if (!STATE.db) STATE.db = { clientes: [], vehiculos: [], ordenes: [], detalleServicios: [], fotos: [] };
    renderCurrentView();
  } catch (err) {
    console.error("Error al cargar datos:", err);
    if (!STATE.db) { STATE.db = API.getLocalStore(); renderCurrentView(); }
  } finally {
    if (first) { mostrarCargando(false); _primeraCarga = false; }
  }
}

// ROUTER Y NAVEGACIÓN
window.addEventListener("hashchange", handleHashNavigation);

function handleHashNavigation() {
  const rawHash = window.location.hash.replace("#", "") || "dashboard";
  let targetView = "dashboard";

  if (rawHash.startsWith("orden-detalle/") || rawHash.startsWith("orden_detalle/")) {
    targetView = "orden-detalle";
    const parts = rawHash.split("/");
    STATE.selectedOrdenId = parts.slice(1).join("/");
  } else if (["dashboard", "ordenes", "clientes", "vehiculos"].includes(rawHash)) {
    targetView = rawHash;
  }

  STATE.currentView = targetView;

  // Actualizar botones nav activos
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.classList.remove("active");
    if (btn.getAttribute("href") === `#${targetView}`) {
      btn.classList.add("active");
    }
  });

  // Mostrar sección activa
  document.querySelectorAll(".view-section").forEach(sec => {
    sec.classList.remove("active-view");
  });
  const activeSec = document.getElementById(`view-${targetView}`);
  if (activeSec) {
    activeSec.classList.add("active-view");
  }

  renderCurrentView();
}

function renderCurrentView() {
  if (!STATE.db) return;

  try {
    switch (STATE.currentView) {
      case "dashboard":
        renderDashboard();
        break;
      case "ordenes":
        renderListaOrdenes();
        break;
      case "clientes":
        renderListaClientes();
        break;
      case "vehiculos":
        renderListaVehiculos();
        break;
      case "orden-detalle":
        renderOrdenDetalle(STATE.selectedOrdenId);
        break;
    }
  } catch (err) {
    console.error("Error al renderizar vista:", err);
  }
}

// -------------------------------------------------------------
// VISTA: DASHBOARD & REPORTERÍA
// -------------------------------------------------------------
function renderDashboard() {
  const ordenes = STATE.db.ordenes || [];
  const clientes = STATE.db.clientes || [];
  const vehiculos = STATE.db.vehiculos || [];

  const todayStr = new Date().toISOString().split("T")[0];
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  // 1. Vehículos en taller hoy (Pendiente o En Proceso)
  const enTaller = ordenes.filter(o => o.estado === UTILS.ESTADOS_ORDEN.PENDIENTE || o.estado === UTILS.ESTADOS_ORDEN.EN_PROCESO).length;

  // 2. Ingresados Hoy
  const ingresadosHoy = ordenes.filter(o => {
    const dateStr = String(o.fechaIngreso || '');
    return dateStr.startsWith(todayStr);
  }).length;

  // 3. Total Cobrado Hoy
  const cobradoHoy = ordenes
    .filter(o => String(o.fechaIngreso || '').startsWith(todayStr))
    .reduce((sum, o) => sum + (Number(o.montoTotal) || 0), 0);

  // 4. Total Cobrado Mes
  const cobradoMes = ordenes
    .filter(o => {
      if (!o.fechaIngreso) return false;
      const d = new Date(o.fechaIngreso);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
    .reduce((sum, o) => sum + (Number(o.montoTotal) || 0), 0);

  document.getElementById("stat-en-taller").textContent = enTaller;
  document.getElementById("stat-vehiculos-hoy").textContent = ingresadosHoy;
  document.getElementById("stat-cobrado-hoy").textContent = UTILS.formatMoney(cobradoHoy);
  document.getElementById("stat-cobrado-mes").textContent = UTILS.formatMoney(cobradoMes);

  // Tabla últimas órdenes
  const tbody = document.getElementById("tbl-dashboard-ordenes");
  if (!tbody) return;

  const ultimas = [...ordenes].reverse().slice(0, 5);

  if (ultimas.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2.5rem 1rem;">
          <i class="fas fa-folder-open" style="font-size: 2rem; color: var(--border-color); margin-bottom: 0.5rem; display: block;"></i>
          <strong>No hay órdenes de trabajo registradas.</strong><br>
          <span style="font-size: 0.85rem;">Presiona <strong>"+ NUEVO INGRESO DE VEHÍCULO"</strong> para registrar el primer vehículo en el taller.</span>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = ultimas.map(ord => {
    const cli = clientes.find(c => String(c.id) === String(ord.clienteId)) || { nombre: "Desconocido" };
    const veh = vehiculos.find(v => String(v.id) === String(ord.vehiculoId)) || { marca: "", modelo: "", placa: "" };

    return `
      <tr>
        <td><strong>${ord.id}</strong></td>
        <td>${UTILS.formatDate(ord.fechaIngreso)}</td>
        <td>${cli.nombre}</td>
        <td>${veh.marca} ${veh.modelo}</td>
        <td><span class="license-plate-tag">${veh.placa || 'S/P'}</span></td>
        <td>${UTILS.getStatusBadgeHtml(ord.estado)}</td>
        <td style="font-weight: 700; color: var(--color-accent-red);">${UTILS.formatMoney(ord.montoTotal)}</td>
        <td>
          <a href="#orden-detalle/${ord.id}" class="btn btn-secondary btn-sm"><i class="fas fa-eye"></i> Ver</a>
        </td>
      </tr>
    `;
  }).join("");

  const mobileContainer = document.getElementById("mobile-dashboard-ordenes");
  if (mobileContainer) {
    if (ultimas.length === 0) {
      mobileContainer.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 2rem;">No hay órdenes registradas.</div>`;
    } else {
      mobileContainer.innerHTML = ultimas.map(ord => {
        const cli = clientes.find(c => String(c.id) === String(ord.clienteId)) || { nombre: "Desconocido" };
        const veh = vehiculos.find(v => String(v.id) === String(ord.vehiculoId)) || { marca: "", modelo: "", placa: "" };
        return `
          <div class="mobile-card-item">
            <div class="mobile-card-header">
              <div>
                <strong>${ord.id}</strong>
                <div style="font-size: 0.78rem; color: var(--text-muted);">${UTILS.formatDate(ord.fechaIngreso)}</div>
              </div>
              ${UTILS.getStatusBadgeHtml(ord.estado)}
            </div>
            <div class="mobile-card-body">
              <div><span class="card-label">Cliente:</span> ${cli.nombre}</div>
              <div><span class="card-label">Vehículo:</span> ${veh.marca} ${veh.modelo}</div>
              <div><span class="card-label">Placa:</span> <span class="license-plate-tag">${veh.placa || 'S/P'}</span></div>
            </div>
            <div class="mobile-card-footer">
              <span class="money">${UTILS.formatMoney(ord.montoTotal)}</span>
              <a href="#orden-detalle/${ord.id}" class="btn btn-secondary btn-sm"><i class="fas fa-eye"></i> Ver Detalle</a>
            </div>
          </div>
        `;
      }).join("");
    }
  }
}

// BÚSQUEDA GLOBAL UNIFICADA (DASHBOARD)
function ejecutarBusquedaGlobal() {
  const input = document.getElementById("global-search-input");
  const container = document.getElementById("global-search-results");
  if (!input || !container) return;

  const query = (input.value || "").trim().toLowerCase();
  if (!query || query.length < 2) {
    container.style.display = "none";
    container.innerHTML = "";
    return;
  }

  const clientes = STATE.db.clientes || [];
  const vehiculos = STATE.db.vehiculos || [];
  const ordenes = STATE.db.ordenes || [];

  const matchClientes = clientes.filter(c =>
    String(c.nombre || '').toLowerCase().includes(query) ||
    String(c.telefono || '').toLowerCase().includes(query) ||
    String(c.cedula || '').toLowerCase().includes(query)
  );

  const matchVehiculos = vehiculos.filter(v =>
    String(v.placa || '').toLowerCase().includes(query) ||
    String(v.marca || '').toLowerCase().includes(query) ||
    String(v.modelo || '').toLowerCase().includes(query) ||
    String(v.vin || '').toLowerCase().includes(query)
  );

  const matchOrdenes = ordenes.filter(o =>
    String(o.id || '').toLowerCase().includes(query) ||
    String(o.motivoVisita || '').toLowerCase().includes(query)
  );

  let html = `<div style="background: white; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1rem; box-shadow: var(--shadow-card);">`;

  if (matchClientes.length === 0 && matchVehiculos.length === 0 && matchOrdenes.length === 0) {
    html += `<p style="color: var(--text-muted); font-size: 0.9rem;">Sin resultados para "${query}".</p>`;
  } else {
    if (matchClientes.length > 0) {
      html += `<h4 style="font-size: 0.85rem; color: var(--color-primary); margin-bottom: 0.5rem;"><i class="fas fa-users"></i> Clientes (${matchClientes.length}):</h4>`;
      html += matchClientes.map(c => `
        <div style="padding: 0.4rem 0.6rem; border-bottom: 1px solid #f0f0f0; font-size: 0.88rem; display: flex; justify-content: space-between; align-items: center;">
          <span><strong>${c.nombre}</strong> (${c.telefono || 'Sin tel'})</span>
          <button class="btn btn-secondary btn-sm" onclick="irACliente('${c.id}')">Ver Cliente</button>
        </div>
      `).join("");
    }

    if (matchVehiculos.length > 0) {
      html += `<h4 style="font-size: 0.85rem; color: var(--color-primary); margin-top: 0.8rem; margin-bottom: 0.5rem;"><i class="fas fa-car"></i> Vehículos (${matchVehiculos.length}):</h4>`;
      html += matchVehiculos.map(v => `
        <div style="padding: 0.4rem 0.6rem; border-bottom: 1px solid #f0f0f0; font-size: 0.88rem; display: flex; justify-content: space-between; align-items: center;">
          <span><strong>${v.marca} ${v.modelo}</strong> (${v.placa || 'S/P'})</span>
          <button class="btn btn-secondary btn-sm" onclick="verHistorialVehiculo('${v.id}')">Ver Historial</button>
        </div>
      `).join("");
    }

    if (matchOrdenes.length > 0) {
      html += `<h4 style="font-size: 0.85rem; color: var(--color-primary); margin-top: 0.8rem; margin-bottom: 0.5rem;"><i class="fas fa-file-invoice"></i> Órdenes (${matchOrdenes.length}):</h4>`;
      html += matchOrdenes.map(o => `
        <div style="padding: 0.4rem 0.6rem; border-bottom: 1px solid #f0f0f0; font-size: 0.88rem; display: flex; justify-content: space-between; align-items: center;">
          <span><strong>Orden ${o.id}</strong> [${o.estado}] - ${o.motivoVisita}</span>
          <a href="#orden-detalle/${o.id}" class="btn btn-secondary btn-sm">Abrir Orden</a>
        </div>
      `).join("");
    }
  }

  html += `</div>`;
  container.innerHTML = html;
  container.style.display = "block";
}

// -------------------------------------------------------------
// VISTA: ÓRDENES
// -------------------------------------------------------------
function renderListaOrdenes() {
  const tbody = document.getElementById("tbl-lista-ordenes");
  if (!tbody) return;

  const ordenes = STATE.db.ordenes || [];
  const clientes = STATE.db.clientes || [];
  const vehiculos = STATE.db.vehiculos || [];

  const query = (document.getElementById("search-ordenes").value || "").toLowerCase();
  const estadoFilter = document.getElementById("filter-estado-orden").value;

  const filtradas = ordenes.filter(ord => {
    const cli = clientes.find(c => String(c.id) === String(ord.clienteId)) || {};
    const veh = vehiculos.find(v => String(v.id) === String(ord.vehiculoId)) || {};

    const matchVeh = !STATE.filterVehiculoId || String(ord.vehiculoId) === String(STATE.filterVehiculoId);
    const matchState = estadoFilter === "TODOS" || ord.estado === estadoFilter;
    const matchSearch = !query ||
      String(ord.id || '').toLowerCase().includes(query) ||
      String(cli.nombre || '').toLowerCase().includes(query) ||
      String(veh.placa || '').toLowerCase().includes(query) ||
      String(veh.marca || '').toLowerCase().includes(query) ||
      String(veh.modelo || '').toLowerCase().includes(query);

    return matchVeh && matchState && matchSearch;
  });

  if (filtradas.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2.5rem 1rem;">
          No se encontraron órdenes de trabajo.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = [...filtradas].reverse().map(ord => {
    const cli = clientes.find(c => String(c.id) === String(ord.clienteId)) || { nombre: "N/A" };
    const veh = vehiculos.find(v => String(v.id) === String(ord.vehiculoId)) || { marca: "", modelo: "", placa: "" };

    return `
      <tr>
        <td><strong>${ord.id}</strong></td>
        <td>${UTILS.formatDate(ord.fechaIngreso, true)}</td>
        <td>${cli.nombre}</td>
        <td>${veh.marca} ${veh.modelo} ${veh.año || ''}</td>
        <td><span class="license-plate-tag">${veh.placa || 'S/P'}</span></td>
        <td>${UTILS.getStatusBadgeHtml(ord.estado)}</td>
        <td style="font-weight: 700; color: var(--color-accent-red);">${UTILS.formatMoney(ord.montoTotal)}</td>
        <td>
          <a href="#orden-detalle/${ord.id}" class="btn btn-secondary btn-sm"><i class="fas fa-folder-open"></i> Abrir</a>
        </td>
      </tr>
    `;
  }).join("");

  const mobileContainer = document.getElementById("mobile-lista-ordenes");
  if (mobileContainer) {
    if (filtradas.length === 0) {
      mobileContainer.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 2rem;">No se encontraron órdenes.</div>`;
    } else {
      mobileContainer.innerHTML = [...filtradas].reverse().map(ord => {
        const cli = clientes.find(c => String(c.id) === String(ord.clienteId)) || { nombre: "N/A" };
        const veh = vehiculos.find(v => String(v.id) === String(ord.vehiculoId)) || { marca: "", modelo: "", placa: "" };
        return `
          <div class="mobile-card-item">
            <div class="mobile-card-header">
              <div>
                <strong>${ord.id}</strong>
                <div style="font-size: 0.78rem; color: var(--text-muted);">${UTILS.formatDate(ord.fechaIngreso, true)}</div>
              </div>
              ${UTILS.getStatusBadgeHtml(ord.estado)}
            </div>
            <div class="mobile-card-body">
              <div><span class="card-label">Cliente:</span> ${cli.nombre}</div>
              <div><span class="card-label">Vehículo:</span> ${veh.marca} ${veh.modelo} ${veh.año || ''}</div>
              <div><span class="card-label">Placa:</span> <span class="license-plate-tag">${veh.placa || 'S/P'}</span></div>
            </div>
            <div class="mobile-card-footer">
              <span class="money">${UTILS.formatMoney(ord.montoTotal)}</span>
              <a href="#orden-detalle/${ord.id}" class="btn btn-secondary btn-sm"><i class="fas fa-folder-open"></i> Abrir</a>
            </div>
          </div>
        `;
      }).join("");
    }
  }
}

// -------------------------------------------------------------
// VISTA: CLIENTES
// -------------------------------------------------------------
function renderListaClientes() {
  const tbody = document.getElementById("tbl-lista-clientes");
  if (!tbody) return;

  const clientes = STATE.db.clientes || [];
  const vehiculos = STATE.db.vehiculos || [];
  const queryInput = document.getElementById("search-clientes");
  const query = (queryInput ? queryInput.value || "" : "").toLowerCase();

  const filtrados = clientes.filter(c => {
    return !query ||
      String(c.nombre || '').toLowerCase().includes(query) ||
      String(c.telefono || '').toLowerCase().includes(query) ||
      String(c.cedula || '').toLowerCase().includes(query);
  });

  if (filtrados.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2.5rem 1rem;">
          No hay clientes registrados en el sistema. Presiona <strong>"+ NUEVO CLIENTE"</strong> para agregar el primero.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtrados.map(c => {
    const vehs = vehiculos.filter(v => String(v.clienteId) === String(c.id));
    const listaVehsHtml = vehs.length > 0 
      ? vehs.map(v => `<span class="badge badge-process" style="margin-right: 0.3rem;">${v.marca} ${v.modelo} (${v.placa || 'S/P'})</span>`).join(" ")
      : `<span style="color: var(--text-muted); font-size: 0.8rem;">Sin vehículos</span>`;

    const telClean = UTILS.formatWhatsApp(c.telefono);

    return `
      <tr>
        <td><strong>${c.id}</strong></td>
        <td><strong>${c.nombre}</strong></td>
        <td><a href="https://wa.me/${telClean}" target="_blank" style="color: #10B981; font-weight: 600;"><i class="fab fa-whatsapp"></i> ${c.telefono}</a></td>
        <td>${c.cedula || 'N/A'}</td>
        <td>${listaVehsHtml}</td>
        <td>${UTILS.formatDate(c.fechaRegistro)}</td>
        <td style="white-space: nowrap;">
          <button class="btn btn-secondary btn-sm" title="Añadir vehículo" onclick="abrirModalNuevoVehiculoParaCliente('${c.id}')"><i class="fas fa-plus"></i></button>
          <button class="btn btn-secondary btn-sm" title="Editar cliente" onclick="abrirModalEditarCliente('${c.id}')"><i class="fas fa-pen"></i></button>
          <button class="btn btn-sm" title="Eliminar cliente" style="background: var(--color-accent-red); color: #fff;" onclick="eliminarClienteUI('${c.id}')"><i class="fas fa-trash"></i></button>
        </td>
      </tr>
    `;
  }).join("");

  const mobileContainer = document.getElementById("mobile-lista-clientes");
  if (mobileContainer) {
    if (filtrados.length === 0) {
      mobileContainer.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 2rem;">No hay clientes registrados.</div>`;
    } else {
      mobileContainer.innerHTML = filtrados.map(c => {
        const vehs = vehiculos.filter(v => String(v.clienteId) === String(c.id));
        const listaVehsHtml = vehs.length > 0 
          ? vehs.map(v => `<span class="badge badge-process" style="margin-right: 0.3rem;">${v.marca} ${v.modelo} (${v.placa || 'S/P'})</span>`).join(" ")
          : `<span style="color: var(--text-muted); font-size: 0.8rem;">Sin vehículos</span>`;
        const telClean = UTILS.formatWhatsApp(c.telefono);

        return `
          <div class="mobile-card-item">
            <div class="mobile-card-header">
              <strong>${c.nombre}</strong>
              <span class="badge badge-pending">${c.id}</span>
            </div>
            <div class="mobile-card-body" style="grid-template-columns: 1fr;">
              <div><span class="card-label">Teléfono:</span> <a href="https://wa.me/${telClean}" target="_blank" style="color: #10B981; font-weight: 600;"><i class="fab fa-whatsapp"></i> ${c.telefono}</a></div>
              ${c.cedula ? `<div><span class="card-label">Cédula:</span> ${c.cedula}</div>` : ''}
              <div><span class="card-label">Vehículos:</span> ${listaVehsHtml}</div>
            </div>
            <div class="mobile-card-footer" style="gap: 0.4rem; flex-wrap: wrap;">
              <button class="btn btn-secondary btn-sm" onclick="abrirModalNuevoVehiculoParaCliente('${c.id}')"><i class="fas fa-plus"></i> Vehículo</button>
              <button class="btn btn-secondary btn-sm" onclick="abrirModalEditarCliente('${c.id}')"><i class="fas fa-pen"></i> Editar</button>
              <button class="btn btn-sm" style="background: var(--color-accent-red); color: #fff;" onclick="eliminarClienteUI('${c.id}')"><i class="fas fa-trash"></i></button>
            </div>
          </div>
        `;
      }).join("");
    }
  }
}

// -------------------------------------------------------------
// VISTA: VEHÍCULOS
// -------------------------------------------------------------
function renderListaVehiculos() {
  const tbody = document.getElementById("tbl-lista-vehiculos");
  if (!tbody) return;

  const vehiculos = STATE.db.vehiculos || [];
  const clientes = STATE.db.clientes || [];
  const ordenes = STATE.db.ordenes || [];
  const query = (document.getElementById("search-vehiculos").value || "").toLowerCase();

  const filtrados = vehiculos.filter(v => {
    const cli = clientes.find(c => String(c.id) === String(v.clienteId)) || {};
    return !query ||
      String(v.placa || '').toLowerCase().includes(query) ||
      String(v.marca || '').toLowerCase().includes(query) ||
      String(v.modelo || '').toLowerCase().includes(query) ||
      String(cli.nombre || '').toLowerCase().includes(query);
  });

  if (filtrados.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2.5rem 1rem;">
          No hay vehículos registrados. Presiona <strong>"+ NUEVO VEHÍCULO"</strong> para agregar el primero.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtrados.map(v => {
    const cli = clientes.find(c => String(c.id) === String(v.clienteId)) || { nombre: "N/A" };
    const historialOrdenes = ordenes.filter(o => String(o.vehiculoId) === String(v.id));

    return `
      <tr>
        <td><span class="license-plate-tag">${v.placa || 'SIN PLACA'}</span></td>
        <td><strong>${v.marca} ${v.modelo}</strong></td>
        <td>${v.año}</td>
        <td>${v.color}</td>
        <td>${cli.nombre}</td>
        <td><span class="badge badge-pending">${historialOrdenes.length} visita(s)</span></td>
        <td style="white-space: nowrap;">
          <button class="btn btn-secondary btn-sm" title="Ver historial" onclick="verHistorialVehiculo('${v.id}')"><i class="fas fa-history"></i></button>
          <button class="btn btn-secondary btn-sm" title="Editar vehículo" onclick="abrirModalEditarVehiculo('${v.id}')"><i class="fas fa-pen"></i></button>
          <button class="btn btn-sm" title="Eliminar vehículo" style="background: var(--color-accent-red); color: #fff;" onclick="eliminarVehiculoUI('${v.id}')"><i class="fas fa-trash"></i></button>
        </td>
      </tr>
    `;
  }).join("");

  const mobileContainer = document.getElementById("mobile-lista-vehiculos");
  if (mobileContainer) {
    if (filtrados.length === 0) {
      mobileContainer.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 2rem;">No hay vehículos registrados.</div>`;
    } else {
      mobileContainer.innerHTML = filtrados.map(v => {
        const cli = clientes.find(c => String(c.id) === String(v.clienteId)) || { nombre: "N/A" };
        const historialOrdenes = ordenes.filter(o => String(o.vehiculoId) === String(v.id));

        return `
          <div class="mobile-card-item">
            <div class="mobile-card-header">
              <div>
                <strong>${v.marca} ${v.modelo} ${v.año ? '(' + v.año + ')' : ''}</strong>
                <div style="margin-top: 0.2rem;"><span class="license-plate-tag">${v.placa || 'SIN PLACA'}</span></div>
              </div>
              <span class="badge badge-pending">${historialOrdenes.length} visita(s)</span>
            </div>
            <div class="mobile-card-body">
              <div><span class="card-label">Propietario:</span> ${cli.nombre}</div>
              <div><span class="card-label">Color:</span> ${v.color || 'N/D'}</div>
            </div>
            <div class="mobile-card-footer" style="gap: 0.4rem; flex-wrap: wrap;">
              <button class="btn btn-secondary btn-sm" onclick="verHistorialVehiculo('${v.id}')"><i class="fas fa-history"></i> Historial</button>
              <button class="btn btn-secondary btn-sm" onclick="abrirModalEditarVehiculo('${v.id}')"><i class="fas fa-pen"></i> Editar</button>
              <button class="btn btn-sm" style="background: var(--color-accent-red); color: #fff;" onclick="eliminarVehiculoUI('${v.id}')"><i class="fas fa-trash"></i></button>
            </div>
          </div>
        `;
      }).join("");
    }
  }
}

function verHistorialVehiculo(vehiculoId) {
  const veh = (STATE.db.vehiculos || []).find(v => String(v.id) === String(vehiculoId));
  if (!veh) return;

  // Filtra por ID de vehículo (no por texto): evita traer órdenes de otros
  // vehículos con la misma marca/modelo o sin placa.
  STATE.filterVehiculoId = vehiculoId;
  const searchInput = document.getElementById("search-ordenes");
  if (searchInput) searchInput.value = "";
  ocultarBusquedaGlobal();
  window.location.hash = "ordenes";
  renderListaOrdenes();
  UTILS.showToast(`Mostrando historial de ${veh.marca} ${veh.modelo} (${veh.placa || 'S/P'})`, "info");
}

// Navega a la ficha del cliente desde la búsqueda global, sin inyectar el
// nombre en HTML (evita que apóstrofos como en "D'Oleo" rompan el botón).
function irACliente(clienteId) {
  const cli = (STATE.db.clientes || []).find(c => String(c.id) === String(clienteId));
  ocultarBusquedaGlobal();
  window.location.hash = "clientes";
  const searchInput = document.getElementById("search-clientes");
  if (searchInput) searchInput.value = cli ? (cli.nombre || "") : "";
  renderListaClientes();
}

// Oculta y limpia el panel de resultados de la búsqueda global.
function ocultarBusquedaGlobal() {
  const container = document.getElementById("global-search-results");
  const input = document.getElementById("global-search-input");
  if (container) { container.style.display = "none"; container.innerHTML = ""; }
  if (input) input.value = "";
}

// Valida que el archivo sea una imagen y no exceda el tamaño máximo.
function validarArchivoImagen(file, maxMB = 12) {
  if (!file.type || !file.type.startsWith("image/")) {
    UTILS.showToast("El archivo debe ser una imagen (JPG, PNG o WebP).", "warning");
    return false;
  }
  if (file.size > maxMB * 1024 * 1024) {
    UTILS.showToast(`La imagen supera el máximo de ${maxMB} MB.`, "warning");
    return false;
  }
  return true;
}

// -------------------------------------------------------------
// VISTA: DETALLE DE ORDEN
// -------------------------------------------------------------
function renderOrdenDetalle(ordenId) {
  const container = document.getElementById("orden-detalle-container");
  if (!container) return;

  const backBtn = document.getElementById("btn-back-ordenes");
  if (backBtn) backBtn.onclick = () => { window.location.hash = "ordenes"; };

  const targetClean = normalizeOrderId(ordenId);
  const ordenes = STATE.db ? (STATE.db.ordenes || []) : [];

  const ord = ordenes.find(o => {
    if (!o || !o.id) return false;
    const rawId = String(o.id).trim();
    const norm = normalizeOrderId(rawId);
    return norm === targetClean || rawId === ordenId || norm.endsWith(targetClean) || targetClean.endsWith(norm);
  });

  if (!ord) {
    container.innerHTML = `
      <div style="background: white; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 3rem 1.5rem; text-align: center; margin-top: 1rem; box-shadow: var(--shadow-card);">
        <i class="fas fa-triangle-exclamation" style="font-size: 2.5rem; color: var(--color-accent-red); margin-bottom: 1rem;"></i>
        <h3 style="color: var(--color-primary); margin-bottom: 0.5rem;">Orden no encontrada (ID: ${ordenId || 'N/D'})</h3>
        <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1.5rem;">La orden requerida no existe o fue eliminada.</p>
        <a href="#ordenes" class="btn btn-primary btn-sm"><i class="fas fa-arrow-left"></i> Ir a Lista de Órdenes</a>
      </div>
    `;
    return;
  }

  const cliRaw = (STATE.db.clientes || []).find(c => String(c.id) === String(ord.clienteId)) || {};
  const vehRaw = (STATE.db.vehiculos || []).find(v => String(v.id) === String(ord.vehiculoId)) || {};

  const cli = {
    nombre: String(cliRaw.nombre || "Cliente Desconocido"),
    telefono: String(cliRaw.telefono || "N/A"),
    cedula: String(cliRaw.cedula || "N/D")
  };

  const veh = {
    marca: String(vehRaw.marca || ""),
    modelo: String(vehRaw.modelo || ""),
    año: String(vehRaw.año || ""),
    color: String(vehRaw.color || ""),
    placa: String(vehRaw.placa || "")
  };

  const detalles = (STATE.db.detalleServicios || []).filter(d => String(d.ordenId) === String(ord.id));
  const fotos = (STATE.db.fotos || []).filter(f => String(f.ordenId) === String(ord.id));

  const telClean = UTILS.formatWhatsApp(cli.telefono);
  const kmVal = Number(ord.kilometrajeEntrada) || 0;
  const kmText = kmVal > 0 ? kmVal.toLocaleString("es-DO") + " km" : "N/D";

  // DEFINICIÓN DE ESTADOS Y TRACKER VISUAL DE AVANCE
  const estadosList = [
    { key: UTILS.ESTADOS_ORDEN.PENDIENTE, icon: "fa-clock", label: "1. Pendiente" },
    { key: UTILS.ESTADOS_ORDEN.EN_PROCESO, icon: "fa-wrench", label: "2. En Proceso" },
    { key: UTILS.ESTADOS_ORDEN.LISTO, icon: "fa-check-circle", label: "3. Listo" },
    { key: UTILS.ESTADOS_ORDEN.ENTREGADO, icon: "fa-flag-checkered", label: "4. Entregado" }
  ];

  const currentIdx = estadosList.findIndex(e => e.key === ord.estado);

  const trackerHtml = `
    <div class="status-tracker-container">
      <div class="status-tracker-title">
        <span><i class="fas fa-route"></i> Flujo de Avance del Vehículo</span>
        <span>Estado Actual: <strong style="color: var(--color-primary);">${ord.estado}</strong></span>
      </div>
      <div class="status-tracker-steps">
        ${estadosList.map((st, i) => {
          let stepClass = "";
          if (i === currentIdx) stepClass = "active";
          else if (i < currentIdx) stepClass = "completed";
          return `
            <button class="status-step-item ${stepClass}" onclick="cambiarEstadoOrden('${ord.id}', '${st.key}')" title="Haga clic para cambiar a estado ${st.key}">
              <div class="status-step-icon"><i class="fas ${st.icon}"></i></div>
              <div class="status-step-label">${st.label}</div>
            </button>
          `;
        }).join("")}
      </div>
    </div>
  `;

  const fotosHtml = fotos.length > 0
    ? fotos.map(f => {
        const displayUrl = UTILS.getFotoDisplayUrl(f);
        return `
          <div style="position: relative; display: inline-block; margin: 0.4rem; cursor: pointer;" onclick="abrirFotoAmpliada('${f.id}')" title="Clic para ver foto ampliada">
            <img src="${displayUrl}" style="width: 130px; height: 95px; object-fit: cover; border-radius: 8px; border: 1px solid var(--border-color); transition: transform 0.2s;" alt="${f.descripcion || 'Evidencia fotográfica'}">
            <p style="font-size: 0.72rem; color: var(--text-muted); width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 0.2rem;">${f.descripcion || 'Sin nota'}</p>
          </div>
        `;
      }).join("")
    : `<p style="font-size: 0.85rem; color: var(--text-muted); font-style: italic;">No hay fotos registradas para esta orden.</p>`;

  const detallesHtml = detalles.map((item, idx) => `
    <tr>
      <td style="text-align: center; font-weight: bold;">${idx + 1}</td>
      <td><span class="badge ${item.tipo === 'Repuesto' ? 'badge-pending' : 'badge-process'}">${item.tipo}</span></td>
      <td><strong>${item.descripcion}</strong></td>
      <td style="text-align: center;" class="tabular-nums">${item.cantidad}</td>
      <td style="text-align: right;" class="tabular-nums">${UTILS.formatMoney(item.precioUnitario)}</td>
      <td style="text-align: right; font-weight: bold; color: var(--color-accent-red);" class="tabular-nums">${UTILS.formatMoney(item.subtotal)}</td>
      <td style="text-align: center; white-space: nowrap;" class="no-print">
        <button class="btn btn-secondary btn-sm" title="Editar ítem" onclick="abrirModalEditarItem('${item.id}')"><i class="fas fa-pen"></i></button>
        <button class="btn btn-sm" title="Eliminar ítem" style="background: var(--color-accent-red); color: #fff;" onclick="eliminarItemUI('${ord.id}','${item.id}')"><i class="fas fa-trash"></i></button>
      </td>
    </tr>
  `).join("");

  container.innerHTML = `
    <!-- TRACKER DE AVANCE FLUIDO -->
    ${trackerHtml}

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem;">

      <!-- COLUMNA PRINCIPAL (INFORMACIÓN Y TRABAJOS) -->
      <div>
        <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: var(--shadow-card);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <h2 style="color: var(--color-primary); font-size: 1.4rem;">ORDEN DE TRABAJO #${ord.id}</h2>
              <p style="color: var(--text-muted); font-size: 0.85rem;">Fecha Ingreso: ${UTILS.formatDate(ord.fechaIngreso, true)}</p>
            </div>
            <div style="text-align: right;">
              ${UTILS.getStatusBadgeHtml(ord.estado)}
              <div style="margin-top: 0.5rem;">
                <button class="btn btn-sm" style="background: var(--color-accent-red); color: #fff;" onclick="eliminarOrdenUI('${ord.id}')"><i class="fas fa-trash"></i> Eliminar orden</button>
              </div>
            </div>
          </div>

          <div style="background: #F8F9FA; padding: 1.1rem; border-radius: var(--radius-md); border: 1px solid var(--border-color); margin-bottom: 1.25rem;">
            <p style="font-size: 0.85rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700; letter-spacing: 0.5px;">Motivo de Ingreso / Síntomas:</p>
            <p style="color: var(--text-main); font-size: 1.05rem; font-weight: 500; margin-top: 0.3rem;">${ord.motivoVisita || 'N/D'}</p>
            ${ord.diagnostico ? `<div style="margin-top: 0.8rem; padding-top: 0.6rem; border-top: 1px dashed #CBD5E1;"><p style="font-size: 0.85rem; color: var(--color-secondary); font-weight: 600;"><i class="fas fa-stethoscope"></i> Diagnóstico Técnico:</p><p style="color: var(--text-main); font-size: 0.95rem; margin-top: 0.2rem;">${ord.diagnostico}</p></div>` : ''}
          </div>

          <!-- ENCABEZADO Y BOTÓN AÑADIR ÍTEM -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.8rem; flex-wrap: wrap; gap: 0.5rem;">
            <h3 style="font-size: 1.05rem; color: var(--color-primary);"><i class="fas fa-list-check"></i> Trabajos y Repuestos</h3>
            <button class="btn btn-primary btn-sm" onclick="abrirModalAgregarItem('${ord.id}')"><i class="fas fa-plus"></i> Añadir Trabajo / Pieza</button>
          </div>

          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width: 40px; text-align: center;">#</th>
                  <th>Tipo</th>
                  <th>Descripción</th>
                  <th style="text-align: center;">Cant</th>
                  <th style="text-align: right;">P. Unit</th>
                  <th style="text-align: right;">Subtotal</th>
                  <th style="text-align: center; width: 90px;" class="no-print">Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${detalles.length > 0 ? detallesHtml : '<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem 1rem;">No se han agregado trabajos o repuestos a esta orden. Presione "+ Añadir Trabajo / Pieza".</td></tr>'}
              </tbody>
              <tfoot>
                <tr style="background: rgba(206, 17, 38, 0.06); font-size: 1.1rem; font-weight: 700;">
                  <td colspan="5" style="text-align: right;">TOTAL A COBRAR (RD$):</td>
                  <td style="text-align: right; color: var(--color-accent-red);" class="tabular-nums">${UTILS.formatMoney(ord.montoTotal)}</td>
                  <td class="no-print"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <!-- EVIDENCIA FOTOGRÁFICA -->
        <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.5rem; box-shadow: var(--shadow-card);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
            <h3 style="font-size: 1.05rem; color: var(--color-primary);"><i class="fas fa-camera"></i> Fotos de Evidencia (${fotos.length})</h3>
            <button class="btn btn-secondary btn-sm" onclick="abrirModalSubirFoto('${ord.id}')"><i class="fas fa-camera"></i> Subir Foto</button>
          </div>
          <div>${fotosHtml}</div>
        </div>
      </div>

      <!-- COLUMNA LATERAL (RESUMEN CLIENTE & VEHÍCULO) -->
      <div>
        <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.25rem; margin-bottom: 1.25rem; box-shadow: var(--shadow-card);">
          <h3 style="font-size: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; margin-bottom: 0.8rem; color: var(--color-primary); display: flex; justify-content: space-between; align-items: center;">
            <span><i class="fas fa-user"></i> Propietario</span>
            <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 400;">Cliente ID: ${ord.clienteId}</span>
          </h3>
          <p style="font-size: 1.1rem; font-weight: 700; color: var(--text-main);">${cli.nombre}</p>
          <p style="font-size: 0.88rem; color: var(--text-muted); margin-top: 0.3rem;"><i class="fas fa-phone"></i> Tel: ${cli.telefono}</p>
          ${telClean ? `<a href="https://wa.me/${telClean}" target="_blank" class="btn btn-success btn-sm" style="margin-top: 0.8rem; width: 100%; display: flex; align-items: center; justify-content: center;"><i class="fab fa-whatsapp"></i> Contactar por WhatsApp</a>` : ''}
        </div>

        <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.25rem; box-shadow: var(--shadow-card);">
          <h3 style="font-size: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; margin-bottom: 0.8rem; color: var(--color-primary); display: flex; justify-content: space-between; align-items: center;">
            <span><i class="fas fa-car"></i> Vehículo</span>
            <span class="license-plate-tag">${veh.placa || 'SIN PLACA'}</span>
          </h3>
          <p style="font-size: 1.1rem; font-weight: 700; color: var(--color-primary);">${veh.marca} ${veh.modelo}</p>
          <p style="font-size: 0.88rem; color: var(--text-muted); margin-top: 0.3rem;"><strong>Año:</strong> ${veh.año || 'N/D'} | <strong>Color:</strong> ${veh.color || 'N/D'}</p>
          <p style="font-size: 0.88rem; color: var(--text-muted); margin-top: 0.3rem;"><strong>Km Entrada:</strong> <span class="tabular-nums" style="font-weight: 600;">${kmText}</span></p>
        </div>
      </div>

    </div>
  `;

  const btnFoto = document.getElementById("btn-subir-foto-orden");
  if (btnFoto) btnFoto.onclick = () => abrirModalSubirFoto(ord.id);

  const btnPrint = document.getElementById("btn-imprimir-constancia");
  if (btnPrint) btnPrint.onclick = () => PRINT_MODULE.printOrder(ord, cli, veh, detalles, fotos);
}

async function cambiarEstadoOrden(ordenId, nuevoEstado) {
  // Confirmar el paso a "Entregado": registra fecha de entrega y cierra la orden.
  if (nuevoEstado === UTILS.ESTADOS_ORDEN.ENTREGADO) {
    const ok = await UTILS.confirmDialog({
      title: "Marcar como Entregado",
      message: "Se registrará la fecha y hora de entrega y la orden quedará cerrada. ¿Deseas continuar?",
      confirmText: "Sí, entregar"
    });
    if (!ok) return;
  }
  try {
    await API.actualizarEstadoOrden(ordenId, nuevoEstado);
    UTILS.showToast(`Estado actualizado a: ${nuevoEstado}`);
    trasEscritura();
  } catch (err) {
    UTILS.showToast("Error al actualizar estado", "error");
  }
}

// -------------------------------------------------------------
// EVENT LISTENERS & FORM HANDLERS
// -------------------------------------------------------------
function initEventListeners() {

  // Indicador de sincronización (Fase 3-4)
  window.addEventListener("taller-sync", (e) => actualizarBadgeSync(e.detail));

  // FASE 5: cerrar los resultados de la búsqueda global al hacer clic fuera.
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#global-search-input") && !e.target.closest("#global-search-results")) {
      const c = document.getElementById("global-search-results");
      if (c) c.style.display = "none";
    }
  });
  try {
    actualizarBadgeSync({
      cloud: API.isCloudMode(),
      online: (typeof navigator !== "undefined") ? navigator.onLine : true,
      pending: API.getPendingCount ? API.getPendingCount() : 0,
      syncing: false
    });
  } catch (e) { /* noop */ }

  // Login
  document.getElementById("form-login").addEventListener("submit", async (e) => {
    e.preventDefault();
    const user = document.getElementById("login-user").value;
    const pass = document.getElementById("login-pass").value;

    try {
      await API.login(user, pass);
      UTILS.showToast("¡Bienvenido Pablo!");
      checkAuthStatus();
    } catch (err) {
      UTILS.showToast(err.message, "error");
    }
  });

  // Logout
  document.getElementById("btn-logout").onclick = () => {
    API.logout();
    checkAuthStatus();
  };

  // Close welcome banner
  const closeWelcomeBtn = document.getElementById("btn-close-welcome");
  if (closeWelcomeBtn) {
    closeWelcomeBtn.onclick = () => {
      document.getElementById("welcome-banner").style.display = "none";
    };
  }

  // Global search
  const globalSearchInput = document.getElementById("global-search-input");
  if (globalSearchInput) {
    globalSearchInput.oninput = ejecutarBusquedaGlobal;
  }

  // Autocompletar modelos al cambiar marca en modal vehículo
  const vehMarcaInput = document.getElementById("veh-marca");
  if (vehMarcaInput) {
    vehMarcaInput.addEventListener("input", (e) => {
      actualizarModelosSegunMarca(e.target.value);
    });
  }

  // Abrir Modal Nueva Orden
  document.querySelectorAll(".btn-open-nueva-orden").forEach(btn => {
    btn.onclick = () => {
      const clientes = STATE.db ? (STATE.db.clientes || []) : [];
      if (clientes.length === 0) {
        UTILS.showToast("Debes registrar un cliente primero antes de crear una orden", "info");
        document.getElementById("modal-nuevo-cliente").classList.remove("hidden");
        return;
      }

      poblarSelectClientes();
      document.getElementById("modal-nueva-orden").classList.remove("hidden");
    };
  });

  // Cambio en select cliente dentro de Nueva Orden -> Carga vehículos asignados a ese cliente
  document.getElementById("select-orden-cliente").onchange = (e) => {
    poblarSelectVehiculosParaCliente(e.target.value);
  };

  // Quick crear cliente/vehículo desde modal orden
  document.getElementById("btn-quick-crear-cliente").onclick = () => {
    prepararCrearCliente();
    document.getElementById("modal-nuevo-cliente").classList.remove("hidden");
  };

  document.getElementById("btn-quick-crear-vehiculo").onclick = () => {
    const cliId = document.getElementById("select-orden-cliente").value;
    if (!cliId) {
      UTILS.showToast("Selecciona el cliente primero", "info");
      return;
    }
    abrirModalNuevoVehiculoParaCliente(cliId);
  };

  // Formulario Nueva Orden Submit
  document.getElementById("form-nueva-orden").addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector("button[type='submit']");
    const originalText = submitBtn ? submitBtn.innerHTML : "";

    const clienteId = document.getElementById("select-orden-cliente").value;
    const vehiculoId = document.getElementById("select-orden-vehiculo").value;

    if (!clienteId) {
      UTILS.showToast("Debes seleccionar un cliente", "warning");
      return;
    }
    if (!vehiculoId) {
      UTILS.showToast("Debes seleccionar o agregar un vehículo para este cliente", "warning");
      return;
    }

    const nuevaOrden = {
      clienteId: clienteId,
      vehiculoId: vehiculoId,
      motivoVisita: document.getElementById("input-orden-motivo").value,
      kilometrajeEntrada: Math.max(0, Number(document.getElementById("input-orden-km").value) || 0),
      diagnostico: document.getElementById("input-orden-diagnostico").value,
      estado: "Pendiente"
    };

    try {
      if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Guardando...`; }
      const creada = await API.crearOrden(nuevaOrden);
      
      // Actualizar estado local inmediatamente
      if (STATE.db && STATE.db.ordenes) {
        if (!STATE.db.ordenes.find(o => o.id === creada.id)) {
          STATE.db.ordenes.push(creada);
        }
      }

      UTILS.showToast("¡Orden de ingreso creada con éxito!");
      document.getElementById("modal-nueva-orden").classList.add("hidden");
      document.getElementById("form-nueva-orden").reset();
      trasEscritura();
      window.location.hash = `#orden-detalle/${creada.id}`;
    } catch (err) {
      UTILS.showToast("Error al crear la orden", "error");
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = originalText; }
    }
  });

  // Modal Nuevo Cliente Submit
  document.getElementById("btn-modal-nuevo-cliente").onclick = () => {
    prepararCrearCliente();
    document.getElementById("modal-nuevo-cliente").classList.remove("hidden");
  };

  document.getElementById("form-nuevo-cliente").addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector("button[type='submit']");
    const originalText = submitBtn ? submitBtn.innerHTML : "";

    const cli = {
      nombre: document.getElementById("cli-nombre").value,
      telefono: document.getElementById("cli-telefono").value,
      cedula: document.getElementById("cli-cedula").value,
      email: document.getElementById("cli-email").value,
      notas: document.getElementById("cli-notas").value
    };

    const editClienteId = document.getElementById("cli-edit-id").value;
    try {
      if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Guardando...`; }
      let nuevo;
      if (editClienteId) {
        cli.id = editClienteId;
        nuevo = await API.actualizarCliente(cli);
      } else {
        nuevo = await API.crearCliente(cli);
      }

      // Actualización inmediata en memoria local
      if (STATE.db) {
        if (!STATE.db.clientes) STATE.db.clientes = [];
        const idx = STATE.db.clientes.findIndex(c => String(c.id) === String(nuevo.id));
        if (idx >= 0) STATE.db.clientes[idx] = Object.assign({}, STATE.db.clientes[idx], nuevo);
        else STATE.db.clientes.push(nuevo);
      }

      UTILS.showToast(editClienteId ? "Cliente actualizado" : "Cliente registrado correctamente");
      document.getElementById("modal-nuevo-cliente").classList.add("hidden");
      document.getElementById("form-nuevo-cliente").reset();

      // Limpiar filtro de búsqueda si existía
      const searchCliInput = document.getElementById("search-clientes");
      if (searchCliInput) searchCliInput.value = "";

      renderListaClientes(); // Render inmediato
      poblarSelectClientes();
      
      const selectOrdenCli = document.getElementById("select-orden-cliente");
      if (selectOrdenCli) selectOrdenCli.value = nuevo.id;
      poblarSelectVehiculosParaCliente(nuevo.id);

      // Sincronización en segundo plano (no bloquea)
      trasEscritura();
    } catch (err) {
      UTILS.showToast("Error al guardar cliente", "error");
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = originalText; }
    }
  });

  // Modal Nuevo Vehículo Submit
  document.getElementById("btn-modal-nuevo-vehiculo").onclick = () => {
    const clientes = STATE.db ? (STATE.db.clientes || []) : [];
    if (clientes.length === 0) {
      UTILS.showToast("Registra un cliente primero para asignarle un vehículo", "info");
      prepararCrearCliente();
      document.getElementById("modal-nuevo-cliente").classList.remove("hidden");
      return;
    }
    prepararCrearVehiculo();
    poblarSelectClientesModalVehiculo();
    document.getElementById("modal-nuevo-vehiculo").classList.remove("hidden");
  };

  document.getElementById("form-nuevo-vehiculo").addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector("button[type='submit']");
    const originalText = submitBtn ? submitBtn.innerHTML : "";

    const veh = {
      clienteId: document.getElementById("veh-cliente").value,
      marca: document.getElementById("veh-marca").value,
      modelo: document.getElementById("veh-modelo").value,
      año: document.getElementById("veh-ano").value,
      color: document.getElementById("veh-color").value,
      placa: document.getElementById("veh-placa").value,
      vin: document.getElementById("veh-vin").value
    };

    const editVehId = document.getElementById("veh-edit-id").value;
    try {
      if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Guardando...`; }
      let nuevoVeh;
      if (editVehId) {
        veh.id = editVehId;
        nuevoVeh = await API.actualizarVehiculo(veh);
      } else {
        nuevoVeh = await API.crearVehiculo(veh);
      }

      // Actualización inmediata local
      if (STATE.db) {
        if (!STATE.db.vehiculos) STATE.db.vehiculos = [];
        const idx = STATE.db.vehiculos.findIndex(v => String(v.id) === String(nuevoVeh.id));
        if (idx >= 0) STATE.db.vehiculos[idx] = Object.assign({}, STATE.db.vehiculos[idx], nuevoVeh);
        else STATE.db.vehiculos.push(nuevoVeh);
      }

      UTILS.showToast(editVehId ? "Vehículo actualizado" : "Vehículo guardado en el sistema");
      document.getElementById("modal-nuevo-vehiculo").classList.add("hidden");
      document.getElementById("form-nuevo-vehiculo").reset();

      renderListaVehiculos(); // Render inmediato
      poblarSelectVehiculosParaCliente(veh.clienteId);
      
      const selectVehOrden = document.getElementById("select-orden-vehiculo");
      if (selectVehOrden) selectVehOrden.value = nuevoVeh.id;

      trasEscritura();
    } catch (err) {
      UTILS.showToast("Error al guardar vehículo", "error");
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = originalText; }
    }
  });

  // Formulario Agregar Ítem a Orden
  document.getElementById("form-agregar-item").addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector("button[type='submit']");
    const originalText = submitBtn ? submitBtn.innerHTML : "";

    const ordenId = document.getElementById("item-orden-id").value;
    const detalleId = document.getElementById("item-detalle-id").value;
    const tipo = document.getElementById("item-tipo").value;
    const desc = document.getElementById("item-descripcion").value;
    const cant = Math.max(1, Number(document.getElementById("item-cantidad").value) || 1);
    const precio = Math.max(0, Number(document.getElementById("item-precio").value) || 0);

    try {
      if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Guardando...`; }
      if (detalleId) {
        await API.editarServicio({ id: detalleId, ordenId: ordenId, tipo: tipo, descripcion: desc, cantidad: cant, precioUnitario: precio });
        UTILS.showToast("Ítem actualizado");
      } else {
        await API.agregarServicioAOrden(ordenId, tipo, desc, cant, precio);
        UTILS.showToast("Ítem agregado a la orden");
      }
      document.getElementById("modal-agregar-item").classList.add("hidden");
      document.getElementById("form-agregar-item").reset();
      trasEscritura();
    } catch (err) {
      UTILS.showToast("Error al agregar ítem", "error");
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = originalText; }
    }
  });

  // Foto Preview
  document.getElementById("foto-input").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!validarArchivoImagen(file)) { e.target.value = ""; return; }
    try {
      const base64 = await UTILS.compressAndConvertImage(file);
      document.getElementById("foto-preview-img").src = base64;
      document.getElementById("foto-preview-container").style.display = "block";
    } catch (err) {
      console.error("Error al procesar la imagen:", err);
      UTILS.showToast("No se pudo procesar la imagen. Intenta con otra foto.", "error");
      e.target.value = "";
      document.getElementById("foto-preview-container").style.display = "none";
    }
  });

  // Formulario Subir Foto
  document.getElementById("form-subir-foto").addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector("button[type='submit']");
    const originalText = submitBtn ? submitBtn.innerHTML : "";

    const ordenId = document.getElementById("foto-orden-id").value;
    const file = document.getElementById("foto-input").files[0];
    const desc = document.getElementById("foto-descripcion").value;

    if (!file) return;
    if (!validarArchivoImagen(file)) return;

    try {
      if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Subiendo...`; }
      const base64 = await UTILS.compressAndConvertImage(file);
      await API.subirFoto(ordenId, base64, file.name, desc);
      UTILS.showToast("Foto de evidencia guardada");
      document.getElementById("modal-subir-foto").classList.add("hidden");
      document.getElementById("form-subir-foto").reset();
      document.getElementById("foto-preview-container").style.display = "none";
      trasEscritura();
    } catch (err) {
      UTILS.showToast("Error al subir foto", "error");
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = originalText; }
    }
  });

  // Cierre de Modales (clic en X o backdrop o Escape)
  document.querySelectorAll(".modal-close").forEach(btn => {
    btn.onclick = (e) => {
      const modal = e.target.closest(".modal-overlay");
      if (modal) modal.classList.add("hidden");
    };
  });

  document.querySelectorAll(".modal-overlay").forEach(overlay => {
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        overlay.classList.add("hidden");
      }
    };
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.querySelectorAll(".modal-overlay").forEach(m => m.classList.add("hidden"));
    }
  });

  // Búsquedas en vivo (al escribir/filtrar se limpia el filtro de historial por vehículo)
  const onFiltroOrdenes = () => { STATE.filterVehiculoId = null; renderListaOrdenes(); };
  ["search-ordenes", "filter-estado-orden"].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.oninput = onFiltroOrdenes; el.onchange = onFiltroOrdenes; }
  });

  const sc = document.getElementById("search-clientes");
  if (sc) sc.oninput = renderListaClientes;

  const sv = document.getElementById("search-vehiculos");
  if (sv) sv.oninput = renderListaVehiculos;
}

// AYUDANTES DE MODALES Y SELECTS
function actualizarModelosSegunMarca(marcaNombre) {
  const datalistModelos = document.getElementById("list-modelos");
  if (!datalistModelos) return;

  const marcaL = (marcaNombre || '').trim().toLowerCase();
  let matchedBrandKey = Object.keys(CAR_CATALOG).find(k => k.toLowerCase() === marcaL || k.toLowerCase().startsWith(marcaL));
  
  let modelos = [];
  if (matchedBrandKey) {
    modelos = CAR_CATALOG[matchedBrandKey];
  } else {
    Object.values(CAR_CATALOG).forEach(arr => modelos.push(...arr));
  }

  datalistModelos.innerHTML = [...new Set(modelos)].map(m => `<option value="${m}">`).join("");
}

function poblarSelectClientes() {
  const select = document.getElementById("select-orden-cliente");
  if (!select) return;

  const clientes = STATE.db ? (STATE.db.clientes || []) : [];
  select.innerHTML = `<option value="">-- Selecciona el cliente --</option>` +
    clientes.map(c => `<option value="${c.id}">${c.nombre} (${c.telefono || 'Sin tel'})</option>`).join("");
}

function poblarSelectVehiculosParaCliente(clienteId) {
  const select = document.getElementById("select-orden-vehiculo");
  if (!select) return;

  if (!clienteId) {
    select.innerHTML = `<option value="">-- Primero selecciona un cliente --</option>`;
    select.disabled = true;
    return;
  }

  const vehiculos = STATE.db ? (STATE.db.vehiculos || []).filter(v => String(v.clienteId) === String(clienteId)) : [];
  if (vehiculos.length === 0) {
    select.innerHTML = `<option value="">-- Este cliente no tiene vehículos registrados --</option>`;
    select.disabled = true;
    return;
  }

  select.innerHTML = `<option value="">-- Selecciona el vehículo --</option>` +
    vehiculos.map(v => `<option value="${v.id}">${v.marca} ${v.modelo} ${v.año || ''} (Placa: ${v.placa || 'S/P'})</option>`).join("");
  select.disabled = false;

  if (vehiculos.length === 1) {
    select.value = vehiculos[0].id;
  }
}

function poblarSelectClientesModalVehiculo() {
  const select = document.getElementById("veh-cliente");
  if (!select) return;
  const clientes = STATE.db ? (STATE.db.clientes || []) : [];
  select.innerHTML = `<option value="">-- Selecciona el cliente --</option>` +
    clientes.map(c => `<option value="${c.id}">${c.nombre}</option>`).join("");
}

function abrirModalNuevoVehiculoParaCliente(clienteId) {
  prepararCrearVehiculo();
  poblarSelectClientesModalVehiculo();
  if (clienteId) {
    document.getElementById("veh-cliente").value = clienteId;
  }
  document.getElementById("modal-nuevo-vehiculo").classList.remove("hidden");
}

function abrirModalAgregarItem(ordenId) {
  prepararCrearItem();
  document.getElementById("item-orden-id").value = ordenId;
  document.getElementById("modal-agregar-item").classList.remove("hidden");
}

function abrirModalSubirFoto(ordenId) {
  document.getElementById("foto-orden-id").value = ordenId;
  document.getElementById("modal-subir-foto").classList.remove("hidden");
}

function abrirFotoAmpliada(fotoId) {
  const foto = (STATE.db.fotos || []).find(f => UTILS.eq(f.id, fotoId));
  if (!foto) {
    UTILS.showToast("No se encontró la foto especificada", "error");
    return;
  }
  const displayUrl = UTILS.getFotoDisplayUrl(foto);
  const imgEl = document.getElementById("modal-ver-foto-img");
  const descEl = document.getElementById("modal-ver-foto-desc");
  const btnExterno = document.getElementById("btn-modal-abrir-externo");

  if (imgEl) imgEl.src = displayUrl;
  if (descEl) descEl.textContent = foto.descripcion || "Evidencia fotográfica de la reparación";

  if (btnExterno) {
    btnExterno.onclick = () => UTILS.openFotoInNewTab(foto);
  }

  const modal = document.getElementById("modal-ver-foto");
  if (modal) modal.classList.remove("hidden");
}

// -------------------------------------------------------------
// FASE 2: EDICIÓN Y ELIMINACIÓN
// -------------------------------------------------------------

// Cambia el título y el botón de un modal según el modo (crear vs editar).
function _setModalTexto(modalId, formId, titleHtml, submitHtml) {
  const h3 = document.querySelector(`#${modalId} .modal-header h3`);
  const btn = document.querySelector(`#${formId} button[type='submit']`);
  if (h3 && titleHtml) h3.innerHTML = titleHtml;
  if (btn && submitHtml) btn.innerHTML = submitHtml;
}

// Preparadores de "modo crear" (limpian el id de edición y restauran textos).
function prepararCrearCliente() {
  document.getElementById("form-nuevo-cliente").reset();
  document.getElementById("cli-edit-id").value = "";
  _setModalTexto("modal-nuevo-cliente", "form-nuevo-cliente",
    '<i class="fas fa-user-plus" style="color: var(--color-primary);"></i> Registrar Nuevo Cliente',
    '<i class="fas fa-check"></i> GUARDAR CLIENTE');
}
function prepararCrearVehiculo() {
  document.getElementById("form-nuevo-vehiculo").reset();
  document.getElementById("veh-edit-id").value = "";
  _setModalTexto("modal-nuevo-vehiculo", "form-nuevo-vehiculo",
    '<i class="fas fa-car" style="color: var(--color-primary);"></i> Registrar Nuevo Vehículo',
    '<i class="fas fa-check"></i> GUARDAR VEHÍCULO');
}
function prepararCrearItem() {
  document.getElementById("form-agregar-item").reset();
  document.getElementById("item-detalle-id").value = "";
  _setModalTexto("modal-agregar-item", "form-agregar-item",
    '<i class="fas fa-plus-circle"></i> Agregar Servicio o Repuesto a la Orden',
    '<i class="fas fa-plus"></i> AGREGAR A ORDEN');
}

function abrirModalEditarCliente(id) {
  const c = (STATE.db.clientes || []).find(x => String(x.id) === String(id));
  if (!c) return;
  document.getElementById("form-nuevo-cliente").reset();
  document.getElementById("cli-edit-id").value = c.id;
  document.getElementById("cli-nombre").value = c.nombre || "";
  document.getElementById("cli-telefono").value = c.telefono || "";
  document.getElementById("cli-cedula").value = c.cedula || "";
  document.getElementById("cli-email").value = c.email || "";
  document.getElementById("cli-notas").value = c.notas || "";
  _setModalTexto("modal-nuevo-cliente", "form-nuevo-cliente",
    '<i class="fas fa-user-pen" style="color: var(--color-primary);"></i> Editar Cliente',
    '<i class="fas fa-check"></i> GUARDAR CAMBIOS');
  document.getElementById("modal-nuevo-cliente").classList.remove("hidden");
}

function abrirModalEditarVehiculo(id) {
  const v = (STATE.db.vehiculos || []).find(x => String(x.id) === String(id));
  if (!v) return;
  document.getElementById("form-nuevo-vehiculo").reset();
  poblarSelectClientesModalVehiculo();
  document.getElementById("veh-edit-id").value = v.id;
  document.getElementById("veh-cliente").value = v.clienteId || "";
  document.getElementById("veh-marca").value = v.marca || "";
  actualizarModelosSegunMarca(v.marca || "");
  document.getElementById("veh-modelo").value = v.modelo || "";
  document.getElementById("veh-ano").value = v.año || "";
  document.getElementById("veh-color").value = v.color || "";
  document.getElementById("veh-placa").value = v.placa || "";
  document.getElementById("veh-vin").value = v.vin || "";
  _setModalTexto("modal-nuevo-vehiculo", "form-nuevo-vehiculo",
    '<i class="fas fa-car" style="color: var(--color-primary);"></i> Editar Vehículo',
    '<i class="fas fa-check"></i> GUARDAR CAMBIOS');
  document.getElementById("modal-nuevo-vehiculo").classList.remove("hidden");
}

function abrirModalEditarItem(detalleId) {
  const d = (STATE.db.detalleServicios || []).find(x => String(x.id) === String(detalleId));
  if (!d) return;
  document.getElementById("form-agregar-item").reset();
  document.getElementById("item-detalle-id").value = d.id;
  document.getElementById("item-orden-id").value = d.ordenId;
  document.getElementById("item-tipo").value = d.tipo || "Mano de Obra";
  document.getElementById("item-descripcion").value = d.descripcion || "";
  document.getElementById("item-cantidad").value = d.cantidad || 1;
  document.getElementById("item-precio").value = d.precioUnitario || 0;
  _setModalTexto("modal-agregar-item", "form-agregar-item",
    '<i class="fas fa-pen"></i> Editar Servicio o Repuesto',
    '<i class="fas fa-check"></i> GUARDAR CAMBIOS');
  document.getElementById("modal-agregar-item").classList.remove("hidden");
}

async function eliminarClienteUI(id) {
  const db = STATE.db || {};
  const tieneVeh = (db.vehiculos || []).some(v => String(v.clienteId) === String(id));
  const tieneOrd = (db.ordenes || []).some(o => String(o.clienteId) === String(id));
  if (tieneVeh || tieneOrd) {
    await UTILS.confirmDialog({
      title: "No se puede eliminar",
      message: "Este cliente tiene vehículos u órdenes asociadas. Elimina o reasigna esos registros primero.",
      confirmText: "Entendido", cancelText: "Cerrar"
    });
    return;
  }
  const ok = await UTILS.confirmDialog({
    title: "Eliminar cliente",
    message: "Se eliminará el cliente de forma permanente. ¿Deseas continuar?",
    confirmText: "Sí, eliminar", danger: true
  });
  if (!ok) return;
  try {
    await API.eliminarCliente(id);
    UTILS.showToast("Cliente eliminado");
    trasEscritura();
  } catch (e) { UTILS.showToast("Error al eliminar cliente", "error"); }
}

async function eliminarVehiculoUI(id) {
  const db = STATE.db || {};
  const tieneOrd = (db.ordenes || []).some(o => String(o.vehiculoId) === String(id));
  if (tieneOrd) {
    await UTILS.confirmDialog({
      title: "No se puede eliminar",
      message: "Este vehículo tiene órdenes asociadas. Elimina esas órdenes primero.",
      confirmText: "Entendido", cancelText: "Cerrar"
    });
    return;
  }
  const ok = await UTILS.confirmDialog({
    title: "Eliminar vehículo",
    message: "Se eliminará el vehículo de forma permanente. ¿Deseas continuar?",
    confirmText: "Sí, eliminar", danger: true
  });
  if (!ok) return;
  try {
    await API.eliminarVehiculo(id);
    UTILS.showToast("Vehículo eliminado");
    trasEscritura();
  } catch (e) { UTILS.showToast("Error al eliminar vehículo", "error"); }
}

async function eliminarItemUI(ordenId, detalleId) {
  const ok = await UTILS.confirmDialog({
    title: "Eliminar ítem",
    message: "Se quitará este trabajo/repuesto de la orden y se recalculará el total. ¿Continuar?",
    confirmText: "Sí, eliminar", danger: true
  });
  if (!ok) return;
  try {
    await API.eliminarServicio(ordenId, detalleId);
    UTILS.showToast("Ítem eliminado");
    trasEscritura();
  } catch (e) { UTILS.showToast("Error al eliminar ítem", "error"); }
}

async function eliminarOrdenUI(ordenId) {
  const ok = await UTILS.confirmDialog({
    title: "Eliminar orden",
    message: "Se eliminará la orden junto con sus trabajos, repuestos y fotos. Esta acción no se puede deshacer. ¿Continuar?",
    confirmText: "Sí, eliminar", danger: true
  });
  if (!ok) return;
  try {
    await API.eliminarOrden(ordenId);
    UTILS.showToast("Orden eliminada");
    STATE.filterVehiculoId = null;
    window.location.hash = "ordenes";
    trasEscritura();
  } catch (e) { UTILS.showToast("Error al eliminar la orden", "error"); }
}
