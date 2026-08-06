/**
 * TALLER EL VARÓN - BACKEND GOOGLE APPS SCRIPT
 * -------------------------------------------------------------
 * Instrucciones de Despliegue:
 * 1. Crea una Hoja de Cálculo en Google Sheets llamada "Taller El Varon - BD"
 * 2. Crea 5 pestañas exactamente con estos nombres:
 *    - Clientes
 *    - Vehiculos
 *    - Ordenes
 *    - DetalleServicios
 *    - Fotos
 * 3. En cada pestaña, coloca los encabezados en la Fila 1:
 *    - Clientes: id | nombre | telefono | cedula | email | notas | fechaRegistro
 *    - Vehiculos: id | clienteId | marca | modelo | año | color | placa | vin | kilometraje
 *    - Ordenes: id | clienteId | vehiculoId | fechaIngreso | fechaEntrega | estado | motivoVisita | diagnostico | kilometrajeEntrada | montoTotal | notas
 *    - DetalleServicios: id | ordenId | tipo | descripcion | cantidad | precioUnitario | subtotal
 *    - Fotos: id | ordenId | driveFileId | url | descripcion | fechaSubida
 * 4. Ve a Extensiones -> Apps Script.
 * 5. Pega todo este código en el editor `Code.gs`.
 * 6. (Opcional) Crea una carpeta en Google Drive para las fotos y copia su ID en DRIVE_FOLDER_ID abajo.
 * 7. Haz clic en "Desplegar" -> "Nuevo despliegue" -> Selecciona tipo "Aplicación web".
 * 8. Configura:
 *    - Ejecutar como: Yo (tu cuenta)
 *    - Quién tiene acceso: Cualquier persona
 * 9. Copia la URL de la Web App generada y colócala en tu archivo `api.js` del frontend.
 */

const CREDENTIALS = {
  usuario: "prosario",
  clave: "tallerelvaron"
};

const DRIVE_FOLDER_ID = ""; // OPCIONAL: ID de carpeta de Google Drive

function doGet(e) {
  return handleRequest(e, "GET");
}

function doPost(e) {
  return handleRequest(e, "POST");
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

    if (action === "login") {
      if (data.usuario === CREDENTIALS.usuario && data.clave === CREDENTIALS.clave) {
        return jsonResponse({
          status: "success",
          data: {
            token: "TOKEN_PABLO_ROSARIO_2026",
            usuario: "Pablo Rosario",
            taller: "Taller El Varón"
          }
        });
      } else {
        return jsonResponse({ status: "error", message: "Usuario o contraseña incorrectos" });
      }
    }

    let result;

    switch (action) {
      case "obtenerTodo":
        result = obtenerTodoElSistema();
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

      case "subirFoto":
        result = subirFotoDrive(data);
        break;

      case "eliminarRegistro":
        result = eliminarRegistro(data.tabla, data.id);
        break;

      default:
        return jsonResponse({ status: "error", message: "Acción no reconocida: " + action });
    }

    return jsonResponse({ status: "success", data: result });

  } catch (error) {
    return jsonResponse({ status: "error", message: error.toString() });
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function obtenerTodoElSistema() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return {
    clientes: sheetToObjects(ss.getSheetByName("Clientes")),
    vehiculos: sheetToObjects(ss.getSheetByName("Vehiculos")),
    ordenes: sheetToObjects(ss.getSheetByName("Ordenes")),
    detalleServicios: sheetToObjects(ss.getSheetByName("DetalleServicios")),
    fotos: sheetToObjects(ss.getSheetByName("Fotos"))
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
  try {
    return Utilities.formatDate(new Date(), "America/Santo_Domingo", "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
  } catch (e) {
    return new Date().toISOString();
  }
}

function crearRegistro(nombreHoja, data, prefijo) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(nombreHoja);
    const lastCol = sheet.getLastColumn();
    
    if (lastCol === 0) {
      throw new Error("La pestaña " + nombreHoja + " debe contener los encabezados en la Fila 1");
    }

    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const lastRow = sheet.getLastRow();
    const newId = prefijo + "-" + String(lastRow).padStart(4, "0");
    data.id = newId;

    if (nombreHoja === "Clientes" && !data.fechaRegistro) {
      data.fechaRegistro = getDominicanDateISO().split("T")[0];
    }

    const rowToInsert = headers.map(header => data[header] !== undefined ? data[header] : "");
    sheet.appendRow(rowToInsert);

    return data;
  } finally {
    lock.releaseLock();
  }
}

function actualizarRegistro(nombreHoja, data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(nombreHoja);
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
  lock.tryLock(10000);

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetOrdenes = ss.getSheetByName("Ordenes");
    const sheetDetalle = ss.getSheetByName("DetalleServicios");

    const year = new Date().getFullYear();
    const count = sheetOrdenes.getLastRow();
    const ordenId = "ORD-" + year + "-" + String(count).padStart(4, "0");

    const fechaIngreso = new Date().toISOString();
    let montoTotal = 0;

    if (data.servicios && Array.isArray(data.servicios)) {
      data.servicios.forEach((item, index) => {
        const itemSubtotal = (Number(item.cantidad) || 1) * (Number(item.precioUnitario) || 0);
        montoTotal += itemSubtotal;

        const itemId = "DET-" + ordenId + "-" + (index + 1);
        sheetDetalle.appendRow([
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

    sheetOrdenes.appendRow(nuevaOrden);

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
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Ordenes");
  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] == ordenId) {
      sheet.getRange(i + 1, 6).setValue(nuevoEstado);
      if (nuevoEstado === "Entregado" || fechaEntrega) {
        sheet.getRange(i + 1, 5).setValue(fechaEntrega || new Date().toISOString());
      }
      return { id: ordenId, estado: nuevoEstado };
    }
  }
  throw new Error("Orden no encontrada: " + ordenId);
}

function agregarServicioAOrden(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetDetalle = ss.getSheetByName("DetalleServicios");
  const sheetOrdenes = ss.getSheetByName("Ordenes");

  const subtotal = (Number(data.cantidad) || 1) * (Number(data.precioUnitario) || 0);
  const itemId = "DET-" + Date.now();

  sheetDetalle.appendRow([
    itemId,
    data.ordenId,
    data.tipo || "Repuesto",
    data.descripcion,
    data.cantidad || 1,
    data.precioUnitario || 0,
    subtotal
  ]);

  const detalles = sheetToObjects(sheetDetalle).filter(d => d.ordenId === data.ordenId);
  const nuevoTotal = detalles.reduce((sum, item) => sum + (Number(item.subtotal) || 0), 0);

  const ordenes = sheetOrdenes.getDataRange().getValues();
  for (let i = 1; i < ordenes.length; i++) {
    if (ordenes[i][0] == data.ordenId) {
      sheetOrdenes.getRange(i + 1, 10).setValue(nuevoTotal);
      break;
    }
  }

  return { id: itemId, ordenId: data.ordenId, nuevoTotal: nuevoTotal };
}

function subirFotoDrive(data) {
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
  const fileUrl = "https://drive.google.com/uc?export=view&id=" + fileId;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetFotos = ss.getSheetByName("Fotos");
  const fotoId = "IMG-" + Date.now();
  const fecha = new Date().toISOString();

  sheetFotos.appendRow([
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

function eliminarRegistro(nombreHoja, id) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(nombreHoja);
  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] == id) {
      sheet.deleteRow(i + 1);
      return { id: id, eliminado: true };
    }
  }
  throw new Error("No se pudo eliminar el registro con ID: " + id);
}
