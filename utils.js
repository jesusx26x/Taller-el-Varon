/**
 * TALLER EL VARÓN - UTILIDADES Y FORMATEADORES
 */

const UTILS = {
  /**
   * Constantes de Estados de Órdenes
   */
  ESTADOS_ORDEN: Object.freeze({
    PENDIENTE: "Pendiente",
    EN_PROCESO: "En Proceso",
    LISTO: "Listo",
    ENTREGADO: "Entregado"
  }),

  /**
   * Formatear moneda en Peso Dominicano (RD$)
   */
  formatMoney: (amount) => {
    const num = Number(amount) || 0;
    return new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency: "DOP",
      minimumFractionDigits: 2
    }).format(num).replace("DOP", "RD$");
  },

  /**
   * Formatear fecha bonita en español (ej: 6 de Agosto, 2026 10:30 AM)
   */
  formatDate: (dateString, includeTime = false) => {
    if (!dateString) return "N/A";
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;

    const options = {
      year: "numeric",
      month: "short",
      day: "numeric"
    };

    if (includeTime) {
      options.hour = "2-digit";
      options.minute = "2-digit";
    }

    return d.toLocaleString("es-DO", options);
  },

  /**
   * Normaliza un teléfono dominicano al formato internacional que exige WhatsApp
   * (código de país "1" + 10 dígitos). Devuelve solo dígitos, o "" si no es válido.
   * Ej: "829-941-9044" -> "18299419044"
   */
  formatWhatsApp: (telefono) => {
    let d = String(telefono || "").replace(/\D/g, "");
    if (!d) return "";
    // Quita un "00" o "+" internacional inicial si viene así
    if (d.startsWith("00")) d = d.slice(2);
    if (d.length === 10) return "1" + d;              // 809/829/849 + 7 dígitos
    if (d.length === 11 && d.startsWith("1")) return d; // ya trae el código de país
    return d; // otro formato: se envía tal cual (mejor esfuerzo)
  },

  /**
   * Badge HTML según estado de orden
   */
  getStatusBadgeHtml: (status) => {
    let colorClass = "badge-pending";
    let icon = "fa-clock";

    switch (status) {
      case UTILS.ESTADOS_ORDEN.EN_PROCESO:
        colorClass = "badge-process";
        icon = "fa-wrench";
        break;
      case UTILS.ESTADOS_ORDEN.LISTO:
        colorClass = "badge-ready";
        icon = "fa-check-circle";
        break;
      case UTILS.ESTADOS_ORDEN.ENTREGADO:
        colorClass = "badge-delivered";
        icon = "fa-flag-checkered";
        break;
      default:
        colorClass = "badge-pending";
        icon = "fa-clock";
        break;
    }

    return `<span class="badge ${colorClass}"><i class="fas ${icon}"></i> ${status}</span>`;
  },

  /**
   * Mostrar notificación Toast en pantalla
   */
  showToast: (message, type = "success") => {
    let container = document.getElementById("toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      container.className = "toast-container";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `toast toast-${type} animate-slide-in`;
    
    const iconMap = {
      success: "fa-check-circle",
      error: "fa-exclamation-circle",
      info: "fa-info-circle",
      warning: "fa-triangle-exclamation"
    };

    toast.innerHTML = `
      <i class="fas ${iconMap[type] || 'fa-info-circle'}"></i>
      <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add("fade-out");
      setTimeout(() => toast.remove(), 400);
    }, 3500);
  },

  /**
   * Diálogo de confirmación reutilizable. Devuelve Promise<boolean>.
   * Los textos los define el código (no el usuario), por lo que no hay inyección.
   */
  confirmDialog: (opts) => {
    opts = opts || {};
    const title = opts.title || "Confirmar";
    const message = opts.message || "¿Deseas continuar?";
    const confirmText = opts.confirmText || "Confirmar";
    const cancelText = opts.cancelText || "Cancelar";
    const danger = !!opts.danger;

    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "modal-overlay";
      overlay.style.zIndex = "9999";
      const dangerStyle = danger
        ? "background: var(--color-accent-red); border-color: var(--color-accent-red); color: #fff;"
        : "";
      overlay.innerHTML = `
        <div class="modal-container" style="max-width: 440px;">
          <div class="modal-header"><h3>${title}</h3></div>
          <div class="modal-body"><p style="font-size: 0.95rem; color: var(--text-main); line-height: 1.5;">${message}</p></div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-act="cancel">${cancelText}</button>
            <button type="button" class="btn ${danger ? '' : 'btn-primary'}" data-act="ok" style="${dangerStyle}">${confirmText}</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);

      const close = (val) => {
        document.removeEventListener("keydown", onKey);
        overlay.remove();
        resolve(val);
      };
      const onKey = (e) => {
        if (e.key === "Escape") close(false);
        else if (e.key === "Enter") close(true);
      };
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) return close(false);
        const b = e.target.closest("[data-act]");
        if (b) close(b.getAttribute("data-act") === "ok");
      });
      document.addEventListener("keydown", onKey);
    });
  },

  /**
   * Convertir archivo input de imagen a Base64 optimizado
   */
  compressAndConvertImage: (file, maxWidth = 1000, quality = 0.75) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target.result;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);

          const base64 = canvas.toDataURL("image/jpeg", quality);
          resolve(base64);
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  },

  /**
   * Obtener URL limpia y segura para mostrar imagen en <img> o thumbnail de Drive
   */
  getFotoDisplayUrl: (fotoOrUrl) => {
    if (!fotoOrUrl) return "";
    let url = typeof fotoOrUrl === "object" ? (fotoOrUrl.url || fotoOrUrl.base64 || "") : String(fotoOrUrl);
    let driveId = typeof fotoOrUrl === "object" ? fotoOrUrl.driveFileId : null;

    if (url.startsWith("data:image/")) return url;

    if (!driveId && url.includes("drive.google.com")) {
      const match = url.match(/[?&]id=([^&]+)/) || url.match(/\/d\/([^/]+)/);
      if (match) driveId = match[1];
    }

    if (driveId) {
      return `https://drive.google.com/thumbnail?id=${driveId}&sz=w1000`;
    }
    return url;
  },

  /**
   * Abrir foto en pestaña nueva de forma segura (evita bloqueo de data: URL en Chrome y redirecciones en Drive)
   */
  openFotoInNewTab: (fotoOrUrl) => {
    const displayUrl = UTILS.getFotoDisplayUrl(fotoOrUrl);
    let driveId = typeof fotoOrUrl === "object" ? fotoOrUrl.driveFileId : null;
    let urlStr = typeof fotoOrUrl === "object" ? (fotoOrUrl.url || "") : String(fotoOrUrl);

    if (!driveId && urlStr.includes("drive.google.com")) {
      const match = urlStr.match(/[?&]id=([^&]+)/) || urlStr.match(/\/d\/([^/]+)/);
      if (match) driveId = match[1];
    }

    if (driveId) {
      window.open(`https://drive.google.com/file/d/${driveId}/view`, "_blank");
      return;
    }

    if (displayUrl.startsWith("data:image/")) {
      try {
        const parts = displayUrl.split(",");
        const mime = (parts[0].match(/:(.*?);/) || [])[1] || "image/jpeg";
        const bstr = atob(parts[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        const blob = new Blob([u8arr], { type: mime });
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, "_blank");
        return;
      } catch (e) {
        console.error("Error al abrir blob url", e);
      }
    }

    window.open(displayUrl, "_blank");
  },

  /**
   * Comparador flexible de IDs
   */
  eq: (a, b) => String(a || "").toLowerCase() === String(b || "").toLowerCase()
};


/* =========================================================
 * FASE 3: Identificadores únicos generados en el cliente
 * (evitan duplicados al crear registros sin conexión).
 * ========================================================= */
UTILS.uuid = function () {
  try {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    if (window.crypto && crypto.getRandomValues) {
      const b = crypto.getRandomValues(new Uint8Array(16));
      b[6] = (b[6] & 0x0f) | 0x40;
      b[8] = (b[8] & 0x3f) | 0x80;
      const h = [...b].map(x => x.toString(16).padStart(2, "0"));
      return `${h[0]}${h[1]}${h[2]}${h[3]}-${h[4]}${h[5]}-${h[6]}${h[7]}-${h[8]}${h[9]}-${h[10]}${h[11]}${h[12]}${h[13]}${h[14]}${h[15]}`;
    }
  } catch (e) { /* fallback abajo */ }
  return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
};

// Folio de orden legible y único por dispositivo (para no mostrar un UUID feo al taller).
UTILS.folioOrden = function () {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  const rand = (Math.random().toString(36).slice(2, 7) + Math.random().toString(36).slice(2, 4)).toUpperCase();
  return `ORD-${stamp}-${rand}`;
};

// Escapa texto del usuario antes de interpolarlo en HTML (evita romper el marcado / XSS).
UTILS.escapeHtml = function (s) {
  if (s === undefined || s === null) return "";
  return String(s).replace(/[&<>"']/g, function (c) {
    return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
  });
};
