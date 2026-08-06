/**
 * TALLER EL VARÓN - UTILIDADES Y FORMATEADORES
 */

const UTILS = {
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
   * Badge HTML según estado de orden
   */
  getStatusBadgeHtml: (status) => {
    let colorClass = "badge-pending";
    let icon = "fa-clock";

    switch (status) {
      case "En Proceso":
        colorClass = "badge-process";
        icon = "fa-wrench";
        break;
      case "Listo":
        colorClass = "badge-ready";
        icon = "fa-check-circle";
        break;
      case "Entregado":
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
  }
};
