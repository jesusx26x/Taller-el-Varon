/**
 * TALLER EL VARÓN - MÓDULO DE IMPRESIÓN EJECUTIVA (PRINT.JS)
 * Genera una constancia de trabajo profesional para entregar al cliente.
 */

const PRINT_MODULE = {

  _lastReceiptHtml: "",

  printOrder: (ord, cli, veh, detalles, fotos) => {
    const modalContent = document.getElementById("print-modal-content");
    if (!modalContent) return;

    const html = PRINT_MODULE.generateReceiptHtml(ord, cli, veh, detalles, fotos);
    PRINT_MODULE._lastReceiptHtml = html;
    modalContent.innerHTML = html;
    document.getElementById("print-modal").classList.remove("hidden");
  },

  /**
   * Imprime SOLO la constancia usando un iframe aislado.
   * Ventaja: no depende de @media print global ni de que el modal esté abierto,
   * por lo que nunca sale una página en blanco.
   */
  doPrint: () => {
    const receiptHtml = PRINT_MODULE._lastReceiptHtml
      || (document.getElementById("print-modal-content") || {}).innerHTML
      || "";
    if (!receiptHtml.trim()) {
      UTILS.showToast("Primero abre la constancia de una orden para imprimir.", "warning");
      return;
    }

    // Rutas absolutas para que los estilos e íconos carguen dentro del iframe
    const cssHref = new URL("index.css?v=4.0", location.href).href;
    const faHref = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css";

    const doc = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8">
<link rel="stylesheet" href="${faHref}">
<link rel="stylesheet" href="${cssHref}">
<style>
  @page { size: letter; margin: 8mm 10mm; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
</style>
</head><body>${receiptHtml}</body></html>`;

    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
    document.body.appendChild(iframe);

    const cleanup = () => { try { document.body.removeChild(iframe); } catch (e) {} };

    iframe.onload = () => {
      // Pequeña espera para asegurar que la hoja de estilos aplique antes de imprimir
      setTimeout(() => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } catch (e) {
          console.error("Error al imprimir:", e);
          UTILS.showToast("No se pudo abrir el diálogo de impresión.", "error");
        }
        setTimeout(cleanup, 1500);
      }, 350);
    };

    const idoc = iframe.contentWindow.document;
    idoc.open();
    idoc.write(doc);
    idoc.close();
  },

  generateReceiptHtml: (ord, cli, veh, detalles, fotos) => {
    const totalServicios = detalles
      .filter(d => d.tipo === "Servicio" || d.tipo === "Mano de Obra")
      .reduce((sum, d) => sum + (Number(d.subtotal) || 0), 0);

    const totalRepuestos = detalles
      .filter(d => d.tipo === "Repuesto" || d.tipo === "Pieza")
      .reduce((sum, d) => sum + (Number(d.subtotal) || 0), 0);

    const grandTotal = Number(ord.montoTotal) || (totalServicios + totalRepuestos);

    const fechaIngresoFormatted = UTILS.formatDate(ord.fechaIngreso, true);
    const fechaEntregaFormatted = ord.fechaEntrega ? UTILS.formatDate(ord.fechaEntrega, true) : "En Proceso";

    const kmEntrada = ord.kilometrajeEntrada ? Number(ord.kilometrajeEntrada).toLocaleString("es-DO") + " km" : "N/D";

    const itemsRows = detalles.length > 0 ? detalles.map((item, idx) => `
      <tr>
        <td style="text-align: center; font-weight: bold;">${idx + 1}</td>
        <td><strong>${item.descripcion}</strong></td>
        <td style="text-align: center;"><span class="badge ${item.tipo === 'Repuesto' ? 'badge-pending' : 'badge-process'}">${item.tipo}</span></td>
        <td style="text-align: center;" class="tabular-nums">${item.cantidad}</td>
        <td style="text-align: right;" class="tabular-nums">${UTILS.formatMoney(item.precioUnitario)}</td>
        <td style="text-align: right; font-weight: bold;" class="tabular-nums">${UTILS.formatMoney(item.subtotal)}</td>
      </tr>
    `).join("") : `
      <tr>
        <td colspan="6" style="text-align: center; color: #64748b; padding: 1rem;">No se registraron ítems de cobro adicionales.</td>
      </tr>
    `;

    return `
      <div id="printable-receipt" class="receipt-paper print-compact">

        <!-- ENCABEZADO CORPORATIVO -->
        <div class="receipt-header">
          <div>
            <div style="display: flex; align-items: center; gap: 0.8rem;">
              <div style="width: 46px; height: 46px; background: #CE1126; border-radius: 8px; color: white; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 700;">V</div>
              <div>
                <h1 class="receipt-title">TALLER PABLO ROSARIO - EL VARÓN</h1>
                <p class="receipt-subtitle">MECÁNICA EN GENERAL • ESPECIALIDAD EN JAPONESES Y AMERICANOS</p>
              </div>
            </div>
            <div class="brand-chips">
              <span class="brand-chip">HONDA</span>
              <span class="brand-chip">TOYOTA</span>
              <span class="brand-chip">HYUNDAI</span>
              <span class="brand-chip">FORD</span>
            </div>
            <p style="font-size: 0.78rem; color: #475569; margin-top: 0.5rem;">
              <i class="fas fa-location-dot"></i> Calle Faisán, No. 83, Los Americanos II, Los Alcarrizos, Santo Domingo Oeste<br>
              <i class="fas fa-user-gear"></i> Propietario: Pablo Rosario | <i class="fab fa-whatsapp"></i> (829)-941-9044 | <i class="fas fa-clock"></i> 8:30 AM – 7:30 PM
            </p>
          </div>

          <div class="receipt-meta">
            <div style="background: #002D62; color: #FFFFFF; padding: 0.6rem 1.2rem; border-radius: 8px; text-align: center; box-shadow: 0 2px 6px rgba(0,0,0,0.15);">
              <span style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">CONSTANCIA N°</span>
              <div class="ro-id" style="color: #FFFFFF; font-size: 1.3rem;">${ord.id}</div>
            </div>
            <p style="font-size: 0.75rem; color: #64748b; margin-top: 0.4rem;">
              Fecha: <strong>${fechaIngresoFormatted}</strong>
            </p>
          </div>
        </div>

        <div class="receipt-divider"></div>

        <!-- BLOQUE BILATERAL DATOS DEL CLIENTE Y VEHÍCULO -->
        <div class="receipt-grid">
          <div class="receipt-box">
            <h3><i class="fas fa-user"></i> DATOS DEL CLIENTE</h3>
            <p><strong>Nombre:</strong> ${cli.nombre || 'Desconocido'}</p>
            <p><strong>Teléfono / WhatsApp:</strong> ${cli.telefono || 'N/D'}</p>
            <p><strong>Cédula / Identificación:</strong> ${cli.cedula || 'N/D'}</p>
          </div>

          <div class="receipt-box">
            <h3><i class="fas fa-car"></i> DATOS DEL VEHÍCULO</h3>
            <p><strong>Vehículo:</strong> ${veh.marca || ''} ${veh.modelo || ''} ${veh.año ? '(' + veh.año + ')' : ''}</p>
            <p><strong>Placa:</strong> <span class="license-plate-tag">${veh.placa || 'SIN PLACA'}</span> | <strong>Color:</strong> ${veh.color || 'N/D'}</p>
            <p><strong>Km Entrada:</strong> ${kmEntrada} | <strong>Estado:</strong> <strong>${ord.estado}</strong></p>
          </div>
        </div>

        <!-- MOTIVO Y DIAGNÓSTICO -->
        <div class="receipt-section">
          <h4><i class="fas fa-wrench"></i> MOTIVO DE INGRESO & DIAGNÓSTICO TÉCNICO</h4>
          <div class="receipt-text-box">
            <p><strong>Síntomas reportados:</strong> ${ord.motivoVisita || 'Mantenimiento preventivo / Diagnóstico general'}</p>
            ${ord.diagnostico ? `<p style="margin-top: 0.4rem; color: #0A4A8F;"><strong>Diagnóstico Técnico:</strong> ${ord.diagnostico}</p>` : ''}
          </div>
        </div>

        <!-- TABLA DE DESGLOSE CONTABLE -->
        <div class="receipt-section">
          <h4><i class="fas fa-list-check"></i> TRABAJOS REALIZADOS Y PIEZAS UTILIZADAS</h4>
          <table class="receipt-table">
            <thead>
              <tr>
                <th style="width: 40px; text-align: center;">#</th>
                <th>Concepto / Trabajo</th>
                <th style="width: 100px; text-align: center;">Tipo</th>
                <th style="width: 60px; text-align: center;">Cant.</th>
                <th style="width: 110px; text-align: right;">P. Unitario</th>
                <th style="width: 120px; text-align: right;">Subtotal (RD$)</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>
        </div>

        <!-- RESUMEN FINANCIERO -->
        <div class="receipt-totals-container">
          <div class="receipt-notes">
            <p><strong>Términos de Garantía y Condiciones:</strong></p>
            <ul style="padding-left: 1.2rem; margin-top: 0.3rem; line-height: 1.4;">
              <li>Todo trabajo técnico de mecánica cuenta con garantía directa de <strong>Taller Pablo Rosario - El Varón</strong>.</li>
              <li>No nos hacemos responsables por objetos de valor dejados en el vehículo sin previo reporte.</li>
              <li>Gracias por confiar el cuidado de su vehículo en las manos de Pablo Rosario y nuestro equipo.</li>
            </ul>
          </div>

          <div class="receipt-totals-box">
            <div class="total-row">
              <span>Mano de Obra / Servicios:</span>
              <span class="tabular-nums">${UTILS.formatMoney(totalServicios)}</span>
            </div>
            <div class="total-row">
              <span>Repuestos / Piezas:</span>
              <span class="tabular-nums">${UTILS.formatMoney(totalRepuestos)}</span>
            </div>
            <div class="total-row grand-total">
              <span>TOTAL GENERAL:</span>
              <span class="tabular-nums" style="color: #CE1126;">${UTILS.formatMoney(grandTotal)}</span>
            </div>
          </div>
        </div>

        <!-- FIRMAS AUTORIZADAS -->
        <div class="receipt-signatures">
          <div class="sig-line">
            <div class="sig-border"></div>
            <p class="sig-name">Pablo Rosario</p>
            <p class="sig-title">Administrador — Taller Pablo Rosario - El Varón</p>
          </div>
          <div class="sig-line">
            <div class="sig-border"></div>
            <p class="sig-name">Firma del Cliente</p>
            <p class="sig-title">Conforme con Trabajo Recibido</p>
          </div>
        </div>

        <div class="receipt-footer">
          Taller Pablo Rosario - El Varón — Calle Faisán No. 83, Los Alcarrizos • Tel/WhatsApp: (829)-941-9044 • pablorosario24201626@gmail.com
        </div>

      </div>
    `;
  }
};
