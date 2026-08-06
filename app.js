/**
 * TALLER EL VARÓN - LÓGICA PRINCIPAL (APP.JS)
 */

let STATE = {
  db: null,
  currentView: "dashboard",
  selectedOrdenId: null
};

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

async function cargarDatosYRenderizar() {
  try {
    STATE.db = await API.obtenerTodo();
    renderCurrentView();
  } catch (err) {
    console.error("Error al cargar datos:", err);
    UTILS.showToast("Error al cargar información", "error");
  }
}

// ROUTER Y NAVEGACIÓN
window.addEventListener("hashchange", handleHashNavigation);

function handleHashNavigation() {
  const hash = window.location.hash.replace("#", "") || "dashboard";
  let targetView = "dashboard";

  if (hash.startsWith("orden-detalle/")) {
    targetView = "orden-detalle";
    STATE.selectedOrdenId = hash.split("/")[1];
  } else if (["dashboard", "ordenes", "clientes", "vehiculos"].includes(hash)) {
    targetView = hash;
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
  const enTaller = ordenes.filter(o => o.estado === "Pendiente" || o.estado === "En Proceso").length;

  // 2. Ingresados Hoy
  const ingresadosHoy = ordenes.filter(o => {
    return o.fechaIngreso && o.fechaIngreso.startsWith(todayStr);
  }).length;

  // 3. Total Cobrado Hoy
  const cobradoHoy = ordenes
    .filter(o => o.fechaIngreso && o.fechaIngreso.startsWith(todayStr))
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
    const cli = clientes.find(c => c.id === ord.clienteId) || { nombre: "Desconocido" };
    const veh = vehiculos.find(v => v.id === ord.vehiculoId) || { marca: "", modelo: "", placa: "" };

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
    (c.nombre && c.nombre.toLowerCase().includes(query)) ||
    (c.telefono && c.telefono.toLowerCase().includes(query)) ||
    (c.cedula && c.cedula.toLowerCase().includes(query))
  );

  const matchVehiculos = vehiculos.filter(v =>
    (v.placa && v.placa.toLowerCase().includes(query)) ||
    (v.marca && v.marca.toLowerCase().includes(query)) ||
    (v.modelo && v.modelo.toLowerCase().includes(query)) ||
    (v.vin && v.vin.toLowerCase().includes(query))
  );

  const matchOrdenes = ordenes.filter(o =>
    o.id.toLowerCase().includes(query) ||
    (o.motivoVisita && o.motivoVisita.toLowerCase().includes(query))
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
          <a href="#clientes" onclick="document.getElementById('search-clientes').value='${c.nombre}'; renderListaClientes();" class="btn btn-secondary btn-sm">Ver Cliente</a>
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
          <span><strong>Órden ${o.id}</strong> [${o.estado}] - ${o.motivoVisita}</span>
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
    const cli = clientes.find(c => c.id === ord.clienteId) || {};
    const veh = vehiculos.find(v => v.id === ord.vehiculoId) || {};

    const matchState = estadoFilter === "TODOS" || ord.estado === estadoFilter;
    const matchSearch = !query || 
      ord.id.toLowerCase().includes(query) ||
      (cli.nombre && cli.nombre.toLowerCase().includes(query)) ||
      (veh.placa && veh.placa.toLowerCase().includes(query)) ||
      (veh.marca && veh.marca.toLowerCase().includes(query)) ||
      (veh.modelo && veh.modelo.toLowerCase().includes(query));

    return matchState && matchSearch;
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
    const cli = clientes.find(c => c.id === ord.clienteId) || { nombre: "N/A" };
    const veh = vehiculos.find(v => v.id === ord.vehiculoId) || { marca: "", modelo: "", placa: "" };

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
}

// -------------------------------------------------------------
// VISTA: CLIENTES
// -------------------------------------------------------------
function renderListaClientes() {
  const tbody = document.getElementById("tbl-lista-clientes");
  if (!tbody) return;

  const clientes = STATE.db.clientes || [];
  const vehiculos = STATE.db.vehiculos || [];
  const query = (document.getElementById("search-clientes").value || "").toLowerCase();

  const filtrados = clientes.filter(c => {
    return !query ||
      (c.nombre && c.nombre.toLowerCase().includes(query)) ||
      (c.telefono && c.telefono.toLowerCase().includes(query)) ||
      (c.cedula && c.cedula.toLowerCase().includes(query));
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
    const vehs = vehiculos.filter(v => v.clienteId === c.id);
    const listaVehsHtml = vehs.length > 0 
      ? vehs.map(v => `<span class="badge badge-process" style="margin-right: 0.3rem;">${v.marca} ${v.modelo} (${v.placa || 'S/P'})</span>`).join(" ")
      : `<span style="color: var(--text-muted); font-size: 0.8rem;">Sin vehículos</span>`;

    return `
      <tr>
        <td><strong>${c.id}</strong></td>
        <td><strong>${c.nombre}</strong></td>
        <td><a href="https://wa.me/${(c.telefono || '').replace(/\D/g, '')}" target="_blank" style="color: #10B981; font-weight: 600;"><i class="fab fa-whatsapp"></i> ${c.telefono}</a></td>
        <td>${c.cedula || 'N/A'}</td>
        <td>${listaVehsHtml}</td>
        <td>${UTILS.formatDate(c.fechaRegistro)}</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="abrirModalNuevoVehiculoParaCliente('${c.id}')"><i class="fas fa-plus"></i> Añadir Vehículo</button>
        </td>
      </tr>
    `;
  }).join("");
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
    const cli = clientes.find(c => c.id === v.clienteId) || {};
    return !query ||
      (v.placa && v.placa.toLowerCase().includes(query)) ||
      (v.marca && v.marca.toLowerCase().includes(query)) ||
      (v.modelo && v.modelo.toLowerCase().includes(query)) ||
      (cli.nombre && cli.nombre.toLowerCase().includes(query));
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
    const cli = clientes.find(c => c.id === v.clienteId) || { nombre: "N/A" };
    const historialOrdenes = ordenes.filter(o => o.vehiculoId === v.id);

    return `
      <tr>
        <td><span class="license-plate-tag">${v.placa || 'SIN PLACA'}</span></td>
        <td><strong>${v.marca} ${v.modelo}</strong></td>
        <td>${v.año}</td>
        <td>${v.color}</td>
        <td>${cli.nombre}</td>
        <td><span class="badge badge-pending">${historialOrdenes.length} visita(s)</span></td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="verHistorialVehiculo('${v.id}')"><i class="fas fa-history"></i> Ver Historial</button>
        </td>
      </tr>
    `;
  }).join("");
}

function verHistorialVehiculo(vehiculoId) {
  const veh = (STATE.db.vehiculos || []).find(v => v.id === vehiculoId);
  if (!veh) return;

  window.location.hash = "ordenes";
  setTimeout(() => {
    const searchInput = document.getElementById("search-ordenes");
    if (searchInput) {
      searchInput.value = veh.placa || veh.marca + " " + veh.modelo;
      renderListaOrdenes();
      UTILS.showToast(`Mostrando historial de ${veh.marca} ${veh.modelo} (${veh.placa || 'S/P'})`, "info");
    }
  }, 100);
}

// -------------------------------------------------------------
// VISTA: DETALLE DE ÓRDEN
// -------------------------------------------------------------
function renderOrdenDetalle(ordenId) {
  const container = document.getElementById("orden-detalle-container");
  if (!container) return;

  const backBtn = document.getElementById("btn-back-ordenes");
  if (backBtn) backBtn.onclick = () => { window.location.hash = "ordenes"; };

  const ord = (STATE.db.ordenes || []).find(o => o.id === ordenId);
  if (!ord) {
    container.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--color-accent-red);">Órden no encontrada (ID: ${ordenId})</div>`;
    return;
  }

  const cli = (STATE.db.clientes || []).find(c => c.id === ord.clienteId) || { nombre: "Desconocido", telefono: "N/A" };
  const veh = (STATE.db.vehiculos || []).find(v => v.id === ord.vehiculoId) || { marca: "", modelo: "", año: "", color: "", placa: "" };
  const detalles = (STATE.db.detalleServicios || []).filter(d => d.ordenId === ord.id);
  const fotos = (STATE.db.fotos || []).filter(f => f.ordenId === ord.id);

  const fotosHtml = fotos.length > 0
    ? fotos.map(f => `
        <div style="position: relative; display: inline-block; margin: 0.4rem;">
          <img src="${f.url}" style="width: 140px; height: 100px; object-fit: cover; border-radius: 8px; border: 1px solid var(--border-color);" title="${f.descripcion}">
          <p style="font-size: 0.7rem; color: var(--text-muted); width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${f.descripcion || 'Sin nota'}</p>
        </div>
      `).join("")
    : `<p style="font-size: 0.85rem; color: var(--text-muted); font-style: italic;">No hay fotos registradas para esta orden.</p>`;

  const detallesHtml = detalles.map((item, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td><span class="badge ${item.tipo === 'Repuesto' ? 'badge-pending' : 'badge-process'}">${item.tipo}</span></td>
      <td>${item.descripcion}</td>
      <td style="text-align: center;">${item.cantidad}</td>
      <td style="text-align: right;">${UTILS.formatMoney(item.precioUnitario)}</td>
      <td style="text-align: right; font-weight: bold; color: var(--color-accent-red);">${UTILS.formatMoney(item.subtotal)}</td>
    </tr>
  `).join("");

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 340px; gap: 1.5rem; margin-top: 1rem;">

      <!-- COLUMNA PRINCIPAL -->
      <div>
        <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: var(--shadow-card);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
            <div>
              <h2 style="color: var(--color-primary);">ÓRDEN N° ${ord.id}</h2>
              <p style="color: var(--text-muted); font-size: 0.85rem;">Ingreso: ${UTILS.formatDate(ord.fechaIngreso, true)}</p>
            </div>
            <div>
              ${UTILS.getStatusBadgeHtml(ord.estado)}
            </div>
          </div>

          <div style="background: #F8F9FA; padding: 1rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color); margin-bottom: 1rem;">
            <p style="font-size: 0.9rem;"><strong>Motivo de Ingreso:</strong></p>
            <p style="color: var(--text-main); font-size: 1rem; margin-top: 0.2rem;">${ord.motivoVisita}</p>
            ${ord.diagnostico ? `<p style="font-size: 0.85rem; color: var(--color-secondary); margin-top: 0.5rem;"><strong>Diagnóstico Técnico:</strong> ${ord.diagnostico}</p>` : ''}
          </div>

          <!-- BOTONES DE CAMBIO DE ESTADO -->
          <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1.5rem; align-items: center;">
            <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">Cambiar Estado:</span>
            <button class="btn btn-secondary btn-sm" onclick="cambiarEstadoOrden('${ord.id}', 'Pendiente')">🟡 Pendiente</button>
            <button class="btn btn-secondary btn-sm" onclick="cambiarEstadoOrden('${ord.id}', 'En Proceso')">🔵 En Proceso</button>
            <button class="btn btn-secondary btn-sm" onclick="cambiarEstadoOrden('${ord.id}', 'Listo')">🟢 Listo</button>
            <button class="btn btn-success btn-sm" onclick="cambiarEstadoOrden('${ord.id}', 'Entregado')">🏁 Entregado al Cliente</button>
          </div>

          <!-- TABLA DE TRABAJOS Y REPUESTOS -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.8rem;">
            <h3>Trabajos y Piezas Utilizadas</h3>
            <button class="btn btn-primary btn-sm" onclick="abrirModalAgregarItem('${ord.id}')"><i class="fas fa-plus"></i> Añadir Ítem / Cobro</button>
          </div>

          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Tipo</th>
                  <th>Descripción</th>
                  <th style="text-align: center;">Cant</th>
                  <th style="text-align: right;">P. Unit</th>
                  <th style="text-align: right;">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${detalles.length > 0 ? detallesHtml : '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">Aún no se han agregado ítems o costos.</td></tr>'}
              </tbody>
              <tfoot>
                <tr style="background: rgba(206, 17, 38, 0.06); font-size: 1.1rem; font-weight: 700;">
                  <td colspan="5" style="text-align: right;">TOTAL GENERAL:</td>
                  <td style="text-align: right; color: var(--color-accent-red);">${UTILS.formatMoney(ord.montoTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

        </div>

        <!-- FOTOS -->
        <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.5rem; box-shadow: var(--shadow-card);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h3>Evidencia Fotográfica (${fotos.length})</h3>
            <button class="btn btn-secondary btn-sm" onclick="abrirModalSubirFoto('${ord.id}')"><i class="fas fa-camera"></i> Subir Foto</button>
          </div>
          <div>
            ${fotosHtml}
          </div>
        </div>
      </div>

      <!-- COLUMNA LATERAL (INFO CLIENTE Y VEHÍCULO) -->
      <div>
        <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.25rem; margin-bottom: 1.25rem; box-shadow: var(--shadow-card);">
          <h3 style="font-size: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; margin-bottom: 0.8rem; color: var(--color-primary);">
            <i class="fas fa-user"></i> Cliente
          </h3>
          <p><strong>${cli.nombre}</strong></p>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.3rem;"><i class="fas fa-phone"></i> ${cli.telefono}</p>
          <a href="https://wa.me/${(cli.telefono || '').replace(/\D/g, '')}" target="_blank" class="btn btn-success btn-sm" style="margin-top: 0.8rem; width: 100%;">
            <i class="fab fa-whatsapp"></i> Contactar WhatsApp
          </a>
        </div>

        <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.25rem; box-shadow: var(--shadow-card);">
          <h3 style="font-size: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; margin-bottom: 0.8rem; color: var(--color-primary);">
            <i class="fas fa-car"></i> Vehículo
          </h3>
          <p><strong>${veh.marca} ${veh.modelo}</strong> (${veh.año})</p>
          <p style="margin-top: 0.5rem;"><span class="license-plate-tag">${veh.placa || 'SIN PLACA'}</span></p>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.5rem;">Color: ${veh.color || 'N/D'}</p>
          <p style="font-size: 0.85rem; color: var(--text-muted);">Km Entrada: ${ord.kilometrajeEntrada ? ord.kilometrajeEntrada.toLocaleString() + ' km' : 'N/D'}</p>
        </div>
      </div>

    </div>
  `;

  document.getElementById("btn-subir-foto-orden").onclick = () => abrirModalSubirFoto(ord.id);
  document.getElementById("btn-imprimir-constancia").onclick = () => PRINT_MODULE.printOrder(ord, cli, veh, detalles, fotos);
}

async function cambiarEstadoOrden(ordenId, nuevoEstado) {
  try {
    await API.actualizarEstadoOrden(ordenId, nuevoEstado);
    UTILS.showToast(`Estado actualizado a: ${nuevoEstado}`);
    await cargarDatosYRenderizar();
  } catch (err) {
    UTILS.showToast("Error al actualizar estado", "error");
  }
}

// -------------------------------------------------------------
// EVENT LISTENERS & FORM HANDLERS
// -------------------------------------------------------------
function initEventListeners() {

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

  // Abrir Modal Nueva Orden
  document.querySelectorAll(".btn-open-nueva-orden").forEach(btn => {
    btn.onclick = () => {
      const clientes = STATE.db.clientes || [];
      if (clientes.length === 0) {
        UTILS.showToast("Debes registrar un cliente primero antes de crear una orden", "info");
        document.getElementById("modal-nuevo-cliente").classList.remove("hidden");
        return;
      }

      poblarSelectClientes();
      document.getElementById("modal-nueva-orden").classList.remove("hidden");
    };
  });

  // Cambio en select cliente dentro de Nueva Orden
  document.getElementById("select-orden-cliente").onchange = (e) => {
    poblarSelectVehiculosParaCliente(e.target.value);
  };

  // Quick crear cliente/vehículo desde modal orden
  document.getElementById("btn-quick-crear-cliente").onclick = () => {
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

    const nuevaOrden = {
      clienteId: document.getElementById("select-orden-cliente").value,
      vehiculoId: document.getElementById("select-orden-vehiculo").value,
      motivoVisita: document.getElementById("input-orden-motivo").value,
      kilometrajeEntrada: document.getElementById("input-orden-km").value,
      diagnostico: document.getElementById("input-orden-diagnostico").value,
      estado: "Pendiente"
    };

    try {
      const creada = await API.crearOrden(nuevaOrden);
      UTILS.showToast("¡Órden de ingreso creada con éxito!");
      document.getElementById("modal-nueva-orden").classList.add("hidden");
      document.getElementById("form-nueva-orden").reset();
      await cargarDatosYRenderizar();
      window.location.hash = `#orden-detalle/${creada.id}`;
    } catch (err) {
      UTILS.showToast("Error al crear la orden", "error");
    }
  });

  // Modal Nuevo Cliente Submit
  document.getElementById("btn-modal-nuevo-cliente").onclick = () => {
    document.getElementById("modal-nuevo-cliente").classList.remove("hidden");
  };

  document.getElementById("form-nuevo-cliente").addEventListener("submit", async (e) => {
    e.preventDefault();

    const cli = {
      nombre: document.getElementById("cli-nombre").value,
      telefono: document.getElementById("cli-telefono").value,
      cedula: document.getElementById("cli-cedula").value,
      email: document.getElementById("cli-email").value,
      notas: document.getElementById("cli-notas").value
    };

    try {
      const nuevo = await API.crearCliente(cli);
      UTILS.showToast("Cliente registrado correctamente");
      document.getElementById("modal-nuevo-cliente").classList.add("hidden");
      document.getElementById("form-nuevo-cliente").reset();
      await cargarDatosYRenderizar();
      poblarSelectClientes();
      document.getElementById("select-orden-cliente").value = nuevo.id;
      poblarSelectVehiculosParaCliente(nuevo.id);
    } catch (err) {
      UTILS.showToast("Error al guardar cliente", "error");
    }
  });

  // Modal Nuevo Vehículo Submit
  document.getElementById("btn-modal-nuevo-vehiculo").onclick = () => {
    const clientes = STATE.db.clientes || [];
    if (clientes.length === 0) {
      UTILS.showToast("Registra un cliente primero para asignarle un vehículo", "info");
      document.getElementById("modal-nuevo-cliente").classList.remove("hidden");
      return;
    }
    poblarSelectClientesModalVehiculo();
    document.getElementById("modal-nuevo-vehiculo").classList.remove("hidden");
  };

  document.getElementById("form-nuevo-vehiculo").addEventListener("submit", async (e) => {
    e.preventDefault();

    const veh = {
      clienteId: document.getElementById("veh-cliente").value,
      marca: document.getElementById("veh-marca").value,
      modelo: document.getElementById("veh-modelo").value,
      año: document.getElementById("veh-ano").value,
      color: document.getElementById("veh-color").value,
      placa: document.getElementById("veh-placa").value,
      vin: document.getElementById("veh-vin").value
    };

    try {
      const nuevoVeh = await API.crearVehiculo(veh);
      UTILS.showToast("Vehículo guardado en el sistema");
      document.getElementById("modal-nuevo-vehiculo").classList.add("hidden");
      document.getElementById("form-nuevo-vehiculo").reset();
      await cargarDatosYRenderizar();
      poblarSelectVehiculosParaCliente(veh.clienteId);
      document.getElementById("select-orden-vehiculo").value = nuevoVeh.id;
    } catch (err) {
      UTILS.showToast("Error al guardar vehículo", "error");
    }
  });

  // Formulario Agregar Ítem a Orden
  document.getElementById("form-agregar-item").addEventListener("submit", async (e) => {
    e.preventDefault();
    const ordenId = document.getElementById("item-orden-id").value;
    const tipo = document.getElementById("item-tipo").value;
    const desc = document.getElementById("item-descripcion").value;
    const cant = document.getElementById("item-cantidad").value;
    const precio = document.getElementById("item-precio").value;

    try {
      await API.agregarServicioAOrden(ordenId, tipo, desc, cant, precio);
      UTILS.showToast("Ítem agregado a la orden");
      document.getElementById("modal-agregar-item").classList.add("hidden");
      document.getElementById("form-agregar-item").reset();
      await cargarDatosYRenderizar();
    } catch (err) {
      UTILS.showToast("Error al agregar ítem", "error");
    }
  });

  // Foto Preview
  document.getElementById("foto-input").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (file) {
      const base64 = await UTILS.compressAndConvertImage(file);
      document.getElementById("foto-preview-img").src = base64;
      document.getElementById("foto-preview-container").style.display = "block";
    }
  });

  // Formulario Subir Foto
  document.getElementById("form-subir-foto").addEventListener("submit", async (e) => {
    e.preventDefault();
    const ordenId = document.getElementById("foto-orden-id").value;
    const file = document.getElementById("foto-input").files[0];
    const desc = document.getElementById("foto-descripcion").value;

    if (!file) return;

    try {
      const base64 = await UTILS.compressAndConvertImage(file);
      await API.subirFoto(ordenId, base64, file.name, desc);
      UTILS.showToast("Foto de evidencia guardada");
      document.getElementById("modal-subir-foto").classList.add("hidden");
      document.getElementById("form-subir-foto").reset();
      document.getElementById("foto-preview-container").style.display = "none";
      await cargarDatosYRenderizar();
    } catch (err) {
      UTILS.showToast("Error al subir foto", "error");
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

  // Búsquedas en vivo
  ["search-ordenes", "filter-estado-orden"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.oninput = renderListaOrdenes;
  });

  const sc = document.getElementById("search-clientes");
  if (sc) sc.oninput = renderListaClientes;

  const sv = document.getElementById("search-vehiculos");
  if (sv) sv.oninput = renderListaVehiculos;
}

// AYUDANTES DE MODALES Y SELECTS
function poblarSelectClientes() {
  const select = document.getElementById("select-orden-cliente");
  if (!select) return;

  const clientes = STATE.db.clientes || [];
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

  const vehiculos = (STATE.db.vehiculos || []).filter(v => v.clienteId === clienteId);
  if (vehiculos.length === 0) {
    select.innerHTML = `<option value="">-- Este cliente no tiene vehículos registrados --</option>`;
    select.disabled = true;
    return;
  }

  select.innerHTML = `<option value="">-- Selecciona el vehículo --</option>` +
    vehiculos.map(v => `<option value="${v.id}">${v.marca} ${v.modelo} ${v.año} (Placa: ${v.placa || 'S/P'})</option>`).join("");
  select.disabled = false;
}

function poblarSelectClientesModalVehiculo() {
  const select = document.getElementById("veh-cliente");
  if (!select) return;
  const clientes = STATE.db.clientes || [];
  select.innerHTML = `<option value="">-- Selecciona el cliente --</option>` +
    clientes.map(c => `<option value="${c.id}">${c.nombre}</option>`).join("");
}

function abrirModalNuevoVehiculoParaCliente(clienteId) {
  poblarSelectClientesModalVehiculo();
  if (clienteId) {
    document.getElementById("veh-cliente").value = clienteId;
  }
  document.getElementById("modal-nuevo-vehiculo").classList.remove("hidden");
}

function abrirModalAgregarItem(ordenId) {
  document.getElementById("item-orden-id").value = ordenId;
  document.getElementById("modal-agregar-item").classList.remove("hidden");
}

function abrirModalSubirFoto(ordenId) {
  document.getElementById("foto-orden-id").value = ordenId;
  document.getElementById("modal-subir-foto").classList.remove("hidden");
}
