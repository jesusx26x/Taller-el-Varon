/**
 * TALLER EL VARÓN - MÓDULO DE IMPRESIÓN DE CONSTANCIAS
 */

const PRINT_MODULE = {
  /**
   * Genera el HTML formateado para la Constancia de Trabajo
   */
  generateReceiptHtml: (orden, cliente, vehiculo, detalles = [], fotos = []) => {
    const totalServicios = detalles.filter(d => d.tipo === "Mano de Obra").reduce((a, b) => a + Number(b.subtotal), 0);
    const totalRepuestos = detalles.filter(d => d.tipo === "Repuesto").reduce((a, b) => a + Number(b.subtotal), 0);
    const totalGeneral = Number(orden.montoTotal) || (totalServicios + totalRepuestos);

    const lineasHtml = detalles.map((item, index) => `
      <tr>
        <td style="text-align: center;">${index + 1}</td>
        <td>
          <strong>${item.descripcion}</strong>
          <span style="font-size: 0.8em; color: #555; display: block;">Tipo: ${item.tipo}</span>
        </td>
        <td style="text-align: center;">${item.cantidad}</td>
        <td style="text-align: right;">${UTILS.formatMoney(item.precioUnitario)}</td>
        <td style="text-align: right; font-weight: bold;">${UTILS.formatMoney(item.subtotal)}</td>
      </tr>
    `).join("");

    return `
      <div class="receipt-paper" id="printable-receipt">
        <!-- ENCABEZADO -->
        <div class="receipt-header">
          <div class="receipt-brand">
            <h1 class="receipt-title">TALLER EL VARÓN</h1>
            <p class="receipt-subtitle">MECÁNICA EN GENERAL • ESPECIALIDAD EN JAPONESES Y AMERICANOS</p>
            <div class="brand-chips">
              <span class="brand-chip">HONDA</span>
              <span class="brand-chip">TOYOTA</span>
              <span class="brand-chip">HYUNDAI</span>
              <span class="brand-chip">FORD</span>
            </div>
          </div>
          <div class="receipt-meta">
            <div class="ro-number">CONSTANCIA N°</div>
            <div class="ro-id">${orden.id}</div>
            <div class="ro-date"><strong>Fecha:</strong> ${UTILS.formatDate(orden.fechaIngreso, true)}</div>
            <div class="ro-status"><strong>Estado:</strong> ${orden.estado}</div>
          </div>
        </div>

        <div class="receipt-divider"></div>

        <!-- DATOS TALLER Y CLIENTE -->
        <div class="receipt-grid">
          <div class="receipt-box">
            <h3><i class="fas fa-store"></i> DATOS DEL TALLER</h3>
            <p><strong>Propietario:</strong> Pablo Rosario</p>
            <p><strong>Dirección:</strong> Calle Faisán No. 83, Los Alcarrizos Los Americanos II, Santo Domingo Oeste</p>
            <p><strong>Tel / WhatsApp:</strong> (829) 941-9044</p>
            <p><strong>Correo:</strong> pablorosario24201626@gmail.com</p>
            <p><strong>Horario:</strong> 8:30 AM – 7:30 PM</p>
          </div>

          <div class="receipt-box">
            <h3><i class="fas fa-user"></i> CLIENTE & VEHÍCULO</h3>
            <p><strong>Cliente:</strong> ${cliente.nombre}</p>
            <p><strong>Teléfono:</strong> ${cliente.telefono || 'N/A'}</p>
            <p><strong>Vehículo:</strong> ${vehiculo.marca} ${vehiculo.modelo} ${vehiculo.año} (${vehiculo.color})</p>
            <p><strong>Placa:</strong> <span class="license-plate-tag">${vehiculo.placa || 'SIN PLACA'}</span></p>
            <p><strong>Kilometraje:</strong> ${orden.kilometrajeEntrada ? orden.kilometrajeEntrada.toLocaleString() + ' km' : 'N/D'}</p>
          </div>
        </div>

        <!-- MOTIVO Y DIAGNÓSTICO -->
        <div class="receipt-section">
          <h4>MOTIVO DE VISITA & MOTIVO DE TRABAJO</h4>
          <p class="receipt-text-box"><strong>Reportado por cliente:</strong> ${orden.motivoVisita || 'Mantenimiento general'}</p>
          ${orden.diagnostico ? `<p class="receipt-text-box"><strong>Diagnóstico técnico / Trabajo efectuado:</strong> ${orden.diagnostico}</p>` : ''}
        </div>

        <!-- TABLA DE DETALLES -->
        <div class="receipt-section">
          <h4>DESGLOSE DE SERVICIOS Y REPUESTOS</h4>
          <table class="receipt-table">
            <thead>
              <tr>
                <th style="width: 40px; text-align: center;">#</th>
                <th>Descripción del Trabajo / Repuesto</th>
                <th style="width: 60px; text-align: center;">Cant.</th>
                <th style="width: 110px; text-align: right;">P. Unitario</th>
                <th style="width: 110px; text-align: right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${lineasHtml.length > 0 ? lineasHtml : '<tr><td colspan="5" style="text-align: center; color: #777;">Sin detalles especificados</td></tr>'}
            </tbody>
          </table>
        </div>

        <!-- TOTALES -->
        <div class="receipt-totals-container">
          <div class="receipt-notes">
            <p><strong>Notas adicionales:</strong> ${orden.notas || 'Garantía por trabajos realizados. Conservar este comprobante.'}</p>
          </div>
          <div class="receipt-totals-box">
            <div class="total-row"><span>Mano de Obra:</span> <span>${UTILS.formatMoney(totalServicios)}</span></div>
            <div class="total-row"><span>Repuestos:</span> <span>${UTILS.formatMoney(totalRepuestos)}</span></div>
            <div class="total-row grand-total"><span>TOTAL COBRADO:</span> <span>${UTILS.formatMoney(totalGeneral)}</span></div>
          </div>
        </div>

        <!-- FIRMAS -->
        <div class="receipt-signatures">
          <div class="sig-line">
            <div class="sig-border"></div>
            <p>Firma Taller (Pablo Rosario)</p>
          </div>
          <div class="sig-line">
            <div class="sig-border"></div>
            <p>Conforme Cliente</p>
          </div>
        </div>

        <!-- PIE DE PÁGINA -->
        <div class="receipt-footer">
          <p>¡Gracias por su preferencia en <strong>TALLER EL VARÓN</strong>! Tu vehículo en manos expertas.</p>
        </div>
      </div>
    `;
  },

  /**
   * Ejecutar la impresión abriendo el modal y ejecutando window.print()
   */
  printOrder: (orden, cliente, vehiculo, detalles, fotos) => {
    const modalContainer = document.getElementById("print-modal");
    const printContent = document.getElementById("print-modal-content");

    if (modalContainer && printContent) {
      printContent.innerHTML = PRINT_MODULE.generateReceiptHtml(orden, cliente, vehiculo, detalles, fotos);
      modalContainer.classList.remove("hidden");
    }
  }
};
