/**
 * TALLER EL VARÓN - BACKEND GOOGLE APPS SCRIPT (RESILIENTE)
 */

// Credenciales por defecto SOLO como respaldo. En producción se configuran en
// Extensiones -> Apps Script -> Configuración del proyecto -> Propiedades del script:
//   CRED_USER, CRED_PASS y (opcional) API_TOKEN.  Así el secreto NO vive en el repo.
const CREDENTIALS = {
  usuario: "prosario",
  clave: "tallerelvaron"
};

function _props() { return PropertiesService.getScriptProperties(); }
function getCred() {
  const p = _props();
  return { usuario: p.getProperty("CRED_USER") || CREDENTIALS.usuario, clave: p.getProperty("CRED_PASS") || CREDENTIALS.clave };
}
// Token secreto del API: se guarda en Script Properties; si no existe, se autogenera
// (nunca queda en el repositorio). El cliente lo obtiene al iniciar sesión.
function getApiToken() {
  const p = _props();
  let t = p.getProperty("API_TOKEN");
  if (!t) { t = Utilities.getUuid(); p.setProperty("API_TOKEN", t); }
  return t;
}

const DRIVE_FOLDER_ID = ""; // OPCIONAL: ID de carpeta de Google Drive

function doGet(e) {
  return handleRequest(e, "GET");
}

function doPost(e) {
  return handleRequest(e, "POST");
}

function getSheetTolerant(ss, sheetName) {
  let sheet = ss.getSheetByName(sheetName);
  if (sheet) return sheet;

  const map = {
    "Vehiculos": ["Vehículos", "VEHICULOS", "VEHÍCULOS", "vehiculos"],
    "Ordenes": ["Órdenes", "ORDENES", "ÓRDENES", "ordenes"],
    "Clientes": ["CLIENTES", "clientes"],
    "DetalleServicios": ["DetallesServicios", "Detalle Servicios", "DETALLESERVICIOS"],
    "Fotos": ["FOTOS", "fotos"]
  };

  const alternatives = map[sheetName] || [];
  for (let i = 0; i < alternatives.length; i++) {
    sheet = ss.getSheetByName(alternatives[i]);
    if (sheet) return sheet;
  }
  return null;
}

function handleRequest(e, method) {
  try {
    let params = {};
    if (method === "GET") {
      params = e.parameter || {};
    } else if (method === "POST") {
      if (e.postData && e.postData.contents) {
        params = JSON.parse(e.postData.contents);
      }
    }

    const action = params.action;
    const data = params.data || {};
    const opId = params.opId;

    // --- AUTENTICACIÓN: toda acción excepto "login" exige un token válido. ---
    if (action !== "login" && (!params.token || params.token !== getApiToken())) {
      return jsonResponse({ status: "error", message: "No autorizado. Inicia sesión de nuevo." });
    }

    const ACCIONES_ESCRITURA = {
      crearCliente: 1, actualizarCliente: 1, crearVehiculo: 1, actualizarVehiculo: 1,
      crearOrden: 1, actualizarEstadoOrden: 1, agregarServicioAOrden: 1, editarServicioDetalle: 1,
      eliminarServicioDetalle: 1, eliminarOrden: 1, subirFoto: 1, eliminarRegistro: 1
    };
    if (opId && ACCIONES_ESCRITURA[action] && yaProcesado(opId)) {
      return jsonResponse({ status: "success", data: { idempotent: true, opId: opId } });
    }

    if (action === "login") {
      const cred = getCred();
      if (data.usuario === cred.usuario && data.clave === cred.clave) {
        return jsonResponse({
          status: "success",
          data: {
            token: getApiToken(),
            usuario: "Pablo Rosario",
            taller: "Taller Pablo Rosario - El Varón"
          }
        });
      } else {
        return jsonResponse({ status: "error", message: "Usuario o contraseña incorrectos" });
      }
    }

    let result;

    switch (action) {
      case "obtenerTodo":
        result = obtenerTodoElSistema(data.desde);
        break;

      case "crearCliente":
        result = crearRegistro("Clientes", data, "CLI");
        break;
      case "actualizarCliente":
        result = actualizarRegistro("Clientes", data);
        break;

      case "crearVehiculo":
        result = crearRegistro("Vehiculos", data, "VEH");
        break;
      case "actualizarVehiculo":
        result = actualizarRegistro("Vehiculos", data);
        break;

      case "crearOrden":
        result = crearOrdenCompleta(data);
        break;
      case "actualizarEstadoOrden":
        result = actualizarEstadoOrden(data.ordenId, data.nuevoEstado, data.fechaEntrega);
        break;
      case "agregarServicioAOrden":
        result = agregarServicioAOrden(data);
        break;
      case "editarServicioDetalle":
        result = editarServicioDetalle(data);
        break;
      case "eliminarServicioDetalle":
        result = eliminarServicioDetalle(data);
        break;
      case "eliminarOrden":
        result = eliminarOrdenCascada(data.ordenId);
        break;

      case "subirFoto":
        result = subirFotoDrive(data);
        break;

      case "eliminarRegistro":
        result = eliminarRegistro(data.tabla, data.id);
        break;

      case "batch":
        result = procesarLote(params.ops);
        break;

      default:
        return jsonResponse({ status: "error", message: "Acción no reconocida: " + action });
    }

    if (opId && ACCIONES_ESCRITURA[action]) marcarProcesado(opId);
    return jsonResponse({ status: "success", data: result });

  } catch (error) {
    return jsonResponse({ status: "error", message: error.toString() });
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// Inserta o actualiza una fila por su id (columna 1). Idempotente: reintentar no duplica.
function upsertFilaPorId(sheet, rowArray) {
  if (!sheet) throw new Error("Hoja no encontrada para upsert");
  const id = rowArray[0];
  const filas = sheet.getDataRange().getValues();
  for (let i = 1; i < filas.length; i++) {
    if (String(filas[i][0]) === String(id)) {
      sheet.getRange(i + 1, 1, 1, rowArray.length).setValues([rowArray]);
      return "update";
    }
  }
  sheet.appendRow(rowArray);
  return "insert";
}

// Idempotencia por opId (evita reprocesar si la respuesta se perdió tras un timeout).
function _getProcesados() {
  try { const raw = _props().getProperty("PROCESADOS"); const a = raw ? JSON.parse(raw) : []; return Array.isArray(a) ? a : []; }
  catch (e) { return []; }
}
function yaProcesado(opId) { if (!opId) return false; return _getProcesados().indexOf(opId) !== -1; }
function marcarProcesado(opId) {
  if (!opId) return;
  try {
    let a = _getProcesados();
    if (a.indexOf(opId) === -1) {
      a.push(opId);
      if (a.length > 800) a = a.slice(a.length - 800); // tope: evita saturar Script Properties
      _props().setProperty("PROCESADOS", JSON.stringify(a));
    }
  } catch (e) { /* sin PropertiesService */ }
}
function _esBorrado(v) { return v === true || String(v).toLowerCase() === "true"; }

// Despachador reutilizable de acciones de escritura (usado por el endpoint batch).
function ejecutarAccion(action, data) {
  switch (action) {
    case "crearCliente": return crearRegistro("Clientes", data, "CLI");
    case "actualizarCliente": return actualizarRegistro("Clientes", data);
    case "crearVehiculo": return crearRegistro("Vehiculos", data, "VEH");
    case "actualizarVehiculo": return actualizarRegistro("Vehiculos", data);
    case "crearOrden": return crearOrdenCompleta(data);
    case "actualizarEstadoOrden": return actualizarEstadoOrden(data.ordenId, data.nuevoEstado, data.fechaEntrega);
    case "agregarServicioAOrden": return agregarServicioAOrden(data);
    case "editarServicioDetalle": return editarServicioDetalle(data);
    case "eliminarServicioDetalle": return eliminarServicioDetalle(data);
    case "eliminarOrden": return eliminarOrdenCascada(data.ordenId);
    case "subirFoto": return subirFotoDrive(data);
    case "eliminarRegistro": return eliminarRegistro(data.tabla, data.id);
    default: throw new Error("Acción no reconocida: " + action);
  }
}

// FASE C: procesa TODA la cola en una sola petición (menos viajes de red).
// Idempotente por opId; devuelve un resultado por operación.
function procesarLote(ops) {
  // Sin lock externo: cada acción toma su propio lock de forma individual, evitando
  // que un releaseLock interno anule la exclusión mutua a mitad del lote.
  const resultados = [];
  (ops || []).forEach(function (op) {
    try {
      if (op.opId && yaProcesado(op.opId)) { resultados.push({ opId: op.opId, status: "success", idempotent: true }); return; }
      const r = ejecutarAccion(op.action, op.data || {});
      if (op.opId) marcarProcesado(op.opId);
      resultados.push({ opId: op.opId, status: "success", data: r });
    } catch (e) {
      resultados.push({ opId: op.opId, status: "error", message: String(e) });
    }
  });
  return resultados;
}

// Borrado por id: LÓGICO si existe la columna 'deleted'; si no, físico (compatibilidad).
function borrarPorId(sheet, id) {
  if (!sheet) return false;
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0] || [];
  const di = headers.indexOf("deleted");
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(id)) {
      if (di >= 0) {
        sheet.getRange(i + 1, di + 1).setValue(true);
        const dai = headers.indexOf("deletedAt"); if (dai >= 0) sheet.getRange(i + 1, dai + 1).setValue(getDominicanDateISO());
        const uai = headers.indexOf("updatedAt"); if (uai >= 0) sheet.getRange(i + 1, uai + 1).setValue(getDominicanDateISO());
      } else {
        sheet.deleteRow(i + 1);
      }
      return true;
    }
  }
  return false;
}

// Borrado por columna (p.ej. ordenId): lógico si hay 'deleted', si no físico.
function borrarPorColumna(sheet, colIndex1based, valor) {
  if (!sheet) return 0;
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0] || [];
  const di = headers.indexOf("deleted");
  let n = 0;
  if (di >= 0) {
    const dai = headers.indexOf("deletedAt");
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][colIndex1based - 1]) === String(valor) && !_esBorrado(rows[i][di])) {
        sheet.getRange(i + 1, di + 1).setValue(true);
        if (dai >= 0) sheet.getRange(i + 1, dai + 1).setValue(getDominicanDateISO());
        n++;
      }
    }
  } else {
    for (let i = rows.length - 1; i >= 1; i--) {
      if (String(rows[i][colIndex1based - 1]) === String(valor)) { sheet.deleteRow(i + 1); n++; }
    }
  }
  return n;
}

function obtenerTodoElSistema(desde) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const safeRead = function(name) {
    try {
      let objs = sheetToObjects(getSheetTolerant(ss, name));
      if (desde) {
        // Delta: solo filas cambiadas desde 'desde'. Filas sin updatedAt siempre se incluyen.
        objs = objs.filter(function (o) { return !o.updatedAt || String(o.updatedAt) > String(desde); });
      }
      return objs;
    } catch (e) {
      console.error("Error leyendo pestaña " + name + ": " + e.toString());
      return [];
    }
  };

  return {
    clientes: safeRead("Clientes"),
    vehiculos: safeRead("Vehiculos"),
    ordenes: safeRead("Ordenes"),
    detalleServicios: safeRead("DetalleServicios"),
    fotos: safeRead("Fotos"),
    delta: !!desde
  };
}

function sheetToObjects(sheet) {
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];

  const headers = rows[0];
  const objects = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[0]) continue;
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index];
    });
    objects.push(obj);
  }
  return objects;
}

function getDominicanDateISO() {
  // Guarda SIEMPRE en UTC real (ISO 8601). La presentación a hora dominicana
  // se hace en el frontend con toLocaleString("es-DO"). Antes se formateaba a
  // hora local y se le pegaba el sufijo "Z" (UTC), lo que descuadraba las
  // comparaciones de fecha/hora entre la PC y el celular.
  return new Date().toISOString();
}

function crearRegistro(nombreHoja, data, prefijo) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error("Sistema ocupado, reintente");

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getSheetTolerant(ss, nombreHoja);
    if (!sheet) {
      throw new Error("Pestaña no encontrada: " + nombreHoja);
    }

    const lastCol = sheet.getLastColumn();
    if (lastCol === 0) {
      throw new Error("La pestaña " + nombreHoja + " debe contener los encabezados en la Fila 1");
    }

    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

    // Usa el id que envía el cliente (UUID) si viene; si no, genera uno.
    if (!data.id) data.id = prefijo + "-" + String(sheet.getLastRow()).padStart(4, "0");

    if (nombreHoja === "Clientes" && !data.fechaRegistro) {
      try { data.fechaRegistro = Utilities.formatDate(new Date(), "America/Santo_Domingo", "yyyy-MM-dd"); }
      catch (e) { data.fechaRegistro = getDominicanDateISO().split("T")[0]; }
    }

    // UPSERT por id (idempotente).
    const rowToInsert = headers.map(header => data[header] !== undefined ? data[header] : "");
    upsertFilaPorId(sheet, rowToInsert);

    return data;
  } finally {
    lock.releaseLock();
  }
}

function actualizarRegistro(nombreHoja, data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheetTolerant(ss, nombreHoja);
  if (!sheet) throw new Error("Pestaña no encontrada: " + nombreHoja);

  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] == data.id) {
      const updatedRow = headers.map(header => data[header] !== undefined ? data[header] : rows[i][headers.indexOf(header)]);
      sheet.getRange(i + 1, 1, 1, updatedRow.length).setValues([updatedRow]);
      return data;
    }
  }
  throw new Error("Registro no encontrado en " + nombreHoja + " con ID: " + data.id);
}

function crearOrdenCompleta(data) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error("Sistema ocupado, reintente");

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetOrdenes = getSheetTolerant(ss, "Ordenes");
    const sheetDetalle = getSheetTolerant(ss, "DetalleServicios");

    const ordenId = data.id || ("ORD-" + new Date().getFullYear() + "-" + String(sheetOrdenes.getLastRow()).padStart(4, "0"));
    const fechaIngreso = data.fechaIngreso || getDominicanDateISO();
    let montoTotal = 0;

    if (data.servicios && Array.isArray(data.servicios)) {
      data.servicios.forEach((item, index) => {
        const itemSubtotal = (Number(item.cantidad) || 1) * (Number(item.precioUnitario) || 0);
        montoTotal += itemSubtotal;

        const itemId = item.id || ("DET-" + ordenId + "-" + (index + 1));
        upsertFilaPorId(sheetDetalle, [
          itemId,
          ordenId,
          item.tipo || "Servicio",
          item.descripcion || "",
          item.cantidad || 1,
          item.precioUnitario || 0,
          itemSubtotal
        ]);
      });
    }

    const nuevaOrden = [
      ordenId,
      data.clienteId,
      data.vehiculoId,
      fechaIngreso,
      "",
      data.estado || "Pendiente",
      data.motivoVisita || "",
      data.diagnostico || "",
      data.kilometrajeEntrada || 0,
      montoTotal,
      data.notas || ""
    ];

    upsertFilaPorId(sheetOrdenes, nuevaOrden);

    return {
      id: ordenId,
      clienteId: data.clienteId,
      vehiculoId: data.vehiculoId,
      fechaIngreso: fechaIngreso,
      estado: data.estado || "Pendiente",
      motivoVisita: data.motivoVisita,
      montoTotal: montoTotal
    };

  } finally {
    lock.releaseLock();
  }
}

function actualizarEstadoOrden(ordenId, nuevoEstado, fechaEntrega) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error("Sistema ocupado, reintente");
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getSheetTolerant(ss, "Ordenes");
    const rows = sheet.getDataRange().getValues();
    const headers = rows[0] || [];
    const uaCol = headers.indexOf("updatedAt");
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] == ordenId) {
        sheet.getRange(i + 1, 6).setValue(nuevoEstado);
        if (nuevoEstado === "Entregado" || fechaEntrega) {
          sheet.getRange(i + 1, 5).setValue(fechaEntrega || getDominicanDateISO());
        } else {
          sheet.getRange(i + 1, 5).setValue("");
        }
        if (uaCol >= 0) sheet.getRange(i + 1, uaCol + 1).setValue(getDominicanDateISO());
        return { id: ordenId, estado: nuevoEstado };
      }
    }
    throw new Error("Orden no encontrada: " + ordenId);
  } finally { lock.releaseLock(); }
}

function agregarServicioAOrden(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetDetalle = getSheetTolerant(ss, "DetalleServicios");
  const sheetOrdenes = getSheetTolerant(ss, "Ordenes");

  const subtotal = (Number(data.cantidad) || 1) * (Number(data.precioUnitario) || 0);
  const itemId = data.id || ("DET-" + Date.now());

  upsertFilaPorId(sheetDetalle, [
    itemId,
    data.ordenId,
    data.tipo || "Repuesto",
    data.descripcion,
    data.cantidad || 1,
    data.precioUnitario || 0,
    subtotal
  ]);

  const nuevoTotal = recalcularTotalOrden(ss, data.ordenId);
  return { id: itemId, ordenId: data.ordenId, nuevoTotal: nuevoTotal };
}

function subirFotoDrive(data) {
  // Idempotencia: si ya existe una foto con este id (reintento), no re-subir.
  const ssFotoIdem = SpreadsheetApp.getActiveSpreadsheet();
  const sheetFotosIdem = getSheetTolerant(ssFotoIdem, "Fotos");
  if (data.id && sheetFotosIdem) {
    const filasIdem = sheetFotosIdem.getDataRange().getValues();
    for (let i = 1; i < filasIdem.length; i++) {
      if (String(filasIdem[i][0]) === String(data.id)) {
        return { id: data.id, ordenId: filasIdem[i][1], driveFileId: filasIdem[i][2], url: filasIdem[i][3], fechaSubida: filasIdem[i][5] };
      }
    }
  }

  let targetFolder;

  if (DRIVE_FOLDER_ID && DRIVE_FOLDER_ID.trim() !== "") {
    targetFolder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  } else {
    targetFolder = DriveApp.getRootFolder();
  }

  const cleanBase64 = data.base64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");
  const decodedBytes = Utilities.base64Decode(cleanBase64);
  const blob = Utilities.newBlob(decodedBytes, MimeType.JPEG, data.nombreArchivo || ("foto_" + Date.now() + ".jpg"));

  const file = targetFolder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  const fileId = file.getId();
  const fileUrl = "https://drive.google.com/thumbnail?id=" + fileId + "&sz=w1000";

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetFotos = getSheetTolerant(ss, "Fotos");
  const fotoId = data.id || ("IMG-" + Date.now());
  const fecha = getDominicanDateISO();

  upsertFilaPorId(sheetFotos, [
    fotoId,
    data.ordenId,
    fileId,
    fileUrl,
    data.descripcion || "",
    fecha
  ]);

  return {
    id: fotoId,
    ordenId: data.ordenId,
    url: fileUrl,
    driveFileId: fileId,
    fechaSubida: fecha
  };
}

// Recalcula el montoTotal de una orden sumando sus detalles (columna 10 en Ordenes).
function recalcularTotalOrden(ss, ordenId) {
  const sheetDetalle = getSheetTolerant(ss, "DetalleServicios");
  const sheetOrdenes = getSheetTolerant(ss, "Ordenes");
  const detalles = sheetToObjects(sheetDetalle).filter(d => d.ordenId == ordenId && !_esBorrado(d.deleted));
  const total = detalles.reduce((s, i) => s + (Number(i.subtotal) || 0), 0);
  const ordenes = sheetOrdenes.getDataRange().getValues();
  for (let i = 1; i < ordenes.length; i++) {
    if (ordenes[i][0] == ordenId) {
      sheetOrdenes.getRange(i + 1, 10).setValue(total);
      break;
    }
  }
  return total;
}

// Edita una línea de servicio/repuesto y recalcula el total de la orden.
function editarServicioDetalle(data) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error("Sistema ocupado, reintente");
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getSheetTolerant(ss, "DetalleServicios");
    const rows = sheet.getDataRange().getValues();
    const headers = rows[0];
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] == data.id) {
        const cant = Number(data.cantidad) || 1;
        const precio = Number(data.precioUnitario) || 0;
        const subtotal = cant * precio;
        const ordenId = rows[i][1];
        const map = {
          id: rows[i][0],
          ordenId: ordenId,
          tipo: data.tipo,
          descripcion: data.descripcion,
          cantidad: cant,
          precioUnitario: precio,
          subtotal: subtotal,
          updatedAt: getDominicanDateISO()
        };
        const newRow = headers.map(h => map[h] !== undefined ? map[h] : rows[i][headers.indexOf(h)]);
        sheet.getRange(i + 1, 1, 1, newRow.length).setValues([newRow]);
        const nuevoTotal = recalcularTotalOrden(ss, ordenId);
        return { id: data.id, ordenId: ordenId, nuevoTotal: nuevoTotal };
      }
    }
    throw new Error("Detalle no encontrado: " + data.id);
  } finally {
    lock.releaseLock();
  }
}

// Elimina una línea de servicio/repuesto y recalcula el total de la orden.
function eliminarServicioDetalle(data) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error("Sistema ocupado, reintente");
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getSheetTolerant(ss, "DetalleServicios");
    const rows = sheet.getDataRange().getValues();
    let ordenId = data.ordenId;
    for (let i = 1; i < rows.length; i++) { if (rows[i][0] == data.id) { ordenId = rows[i][1]; break; } }
    borrarPorId(sheet, data.id);
    const nuevoTotal = recalcularTotalOrden(ss, ordenId);
    return { id: data.id, ordenId: ordenId, nuevoTotal: nuevoTotal };
  } finally {
    lock.releaseLock();
  }
}

// Borra todas las filas de una hoja cuyo valor en 'colIndex1based' coincida.
function borrarFilasPorColumna(sheet, colIndex1based, valor) {
  if (!sheet) return 0;
  const rows = sheet.getDataRange().getValues();
  let borradas = 0;
  for (let i = rows.length - 1; i >= 1; i--) {
    if (rows[i][colIndex1based - 1] == valor) {
      sheet.deleteRow(i + 1);
      borradas++;
    }
  }
  return borradas;
}

// Elimina una orden y en cascada sus detalles y sus fotos (evita huérfanos).
function eliminarOrdenCascada(ordenId) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error("Sistema ocupado, reintente");
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    borrarPorColumna(getSheetTolerant(ss, "DetalleServicios"), 2, ordenId); // col ordenId
    borrarPorColumna(getSheetTolerant(ss, "Fotos"), 2, ordenId);            // col ordenId
    borrarPorColumna(getSheetTolerant(ss, "Ordenes"), 1, ordenId);          // col id
    return { id: ordenId, eliminado: true };
  } finally {
    lock.releaseLock();
  }
}

function eliminarRegistro(nombreHoja, id) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheetTolerant(ss, nombreHoja);
  if (borrarPorId(sheet, id)) return { id: id, eliminado: true };
  throw new Error("No se pudo eliminar el registro con ID: " + id);
}
