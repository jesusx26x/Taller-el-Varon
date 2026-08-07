# 🔧 Taller Pablo Rosario - El Varón — Sistema de Gestión de Taller Mecánico

Sistema web responsivo para **Pablo Rosario** (Taller Pablo Rosario - El Varón, Los Alcarrizos, Santo Domingo).

🔗 **Enlace Público (GitHub Pages)**: [https://jesusx26x.github.io/Taller-el-Varon/](https://jesusx26x.github.io/Taller-el-Varon/)

---

## 🔑 Credenciales de Acceso

- El usuario y la contraseña se configuran en el backend (Google Apps Script) mediante
  **Propiedades del script** (`CRED_USER`, `CRED_PASS`). No se publican aquí por seguridad.
  Por defecto (si no se configuran) el sistema usa credenciales de respaldo que **debes cambiar**
  antes de entregar (ver "Seguridad" más abajo).

---

## 📱 Funcionalidades Incluidas

- **Fichas de Vehículo & Historial Completo**: Busca por placa, cliente o marca y ve qué reparaciones se le hicieron en el pasado.
- **Formulario de Registro de Trabajo**: Agrega mano de obra, piezas utilizadas y calcula totales automáticamente en Peso Dominicano (`RD$`).
- **Constancia Imprimible Elegante**: Módulo de impresión con el nombre del taller, dirección (*Calle Faisán No. 83, Los Alcarrizos*), WhatsApp (*829-941-9044*), marcas (*Honda, Toyota, Hyundai, Ford*), desglose de trabajos/piezas y firmas.
- **Evidencia Fotográfica**: Carga y vista previa de fotos de reparaciones directamente a Google Drive.
- **Acceso PWA**: Se puede instalar como aplicación web en la pantalla de inicio del celular.

---

## 📊 Configuración de Base de Datos en Google Sheets (Paso a Paso)

Para sincronizar datos en tiempo real entre la PC y el teléfono de Pablo:

1. **Crear el Google Sheet**:
   - Entra a [Google Sheets](https://sheets.google.com) y crea un libro nuevo.
   - Nómbralo: `Taller El Varon - BD`.
   - Crea exactamente **5 pestañas** (hojas) abajo con estos nombres:
     - `Clientes`
     - `Vehiculos`
     - `Ordenes`
     - `DetalleServicios`
     - `Fotos`

2. **Agregar Encabezados (Fila 1 de cada pestaña)**:
   - **Pestaña `Clientes`**:
     `id` | `nombre` | `telefono` | `cedula` | `email` | `notas` | `fechaRegistro`
   - **Pestaña `Vehiculos`**:
     `id` | `clienteId` | `marca` | `modelo` | `año` | `color` | `placa` | `vin` | `kilometraje`
   - **Pestaña `Ordenes`**:
     `id` | `clienteId` | `vehiculoId` | `fechaIngreso` | `fechaEntrega` | `estado` | `motivoVisita` | `diagnostico` | `kilometrajeEntrada` | `montoTotal` | `notas`
   - **Pestaña `DetalleServicios`**:
     `id` | `ordenId` | `tipo` | `descripcion` | `cantidad` | `precioUnitario` | `subtotal`
   - **Pestaña `Fotos`**:
     `id` | `ordenId` | `driveFileId` | `url` | `descripcion` | `fechaSubida`

3. **Copiar Código Backend**:
   - En la parte superior del Google Sheet, ve al menú **Extensiones** ➔ **Apps Script**.
   - Borra cualquier código existente en `Code.gs` y pega todo el contenido del archivo `google_apps_script.js`.
   - Presiona `Ctrl + S` para guardar.

4. **Desplegar la Web App**:
   - Haz clic en el botón azul **Desplegar** (arriba a la derecha) ➔ **Nuevo despliegue**.
   - Haz clic en el engranaje ⚙️ ➔ Selecciona **Aplicación web**.
   - Rellena las opciones:
     - **Descripción**: API Taller El Varón
     - **Ejecutar como**: *Yo (tu cuenta)*
     - **Quién tiene acceso**: *Cualquier persona* (Anyone)
   - Haz clic en **Desplegar**.
   - Si Google pide autorizar permisos, da clic en *Revisar permisos* ➔ Elige tu cuenta ➔ *Avanzado* ➔ *Ir a proyecto (no seguro)* ➔ *Permitir*.
   - Copia la **URL de la aplicación web** generada (`https://script.google.com/macros/s/.../exec`).

5. **Conectar en el Sistema**:
   - Abre la web pública: [https://jesusx26x.github.io/Taller-el-Varon/](https://jesusx26x.github.io/Taller-el-Varon/)
   - Inicia sesión con el usuario y la contraseña que configuraste en Propiedades del script.
   - En la barra superior, haz clic en **Conexión / Cloud**.
   - Pega la URL de Apps Script y haz clic en **Guardar Conexión**.

¡Listo! Todo quedará sincronizado automáticamente entre la PC y el celular de Pablo.

---

## 🔄 Columnas para el modo offline (Fases 3-4)

Para que el guardado sin conexión y la sincronización sin duplicados funcionen al 100%
(incluyendo borrados que no "reviven" y resolución de conflictos entre dispositivos),
añade estas columnas **al final de la Fila 1** de las **5 hojas** (Clientes, Vehiculos,
Ordenes, DetalleServicios, Fotos):

`uuid` | `createdAt` | `updatedAt` | `deleted` | `deletedAt`

- El backend es **tolerante**: si NO agregas estas columnas, la app sigue funcionando
  (los borrados serán físicos y no habrá timestamps en la nube).
- Si SÍ las agregas: los borrados se vuelven **lógicos** (tombstones) y se guardan las
  marcas de tiempo, habilitando la sincronización segura multi-dispositivo.

Recuerda: tras cambiar el código del backend, vuelve a pegar `google_apps_script.js` en
Apps Script y crea un **despliegue (versión) nuevo**.


---

## 🔒 Seguridad (obligatorio antes de entregar a producción)

Este sistema es una página pública (GitHub Pages) que habla con un backend de Google Apps Script.
Para que sea seguro:

1. **Token del API (protege el backend):** el backend exige un token en cada operación. Se genera
   solo la primera vez y se guarda en **Propiedades del script**. El cliente lo obtiene al iniciar
   sesión. Así, aunque alguien conozca la URL `/exec`, **no puede leer ni escribir sin iniciar sesión**.
2. **Credenciales fuera del código:** define `CRED_USER` y `CRED_PASS` en
   **Apps Script → Configuración del proyecto → Propiedades del script**. Cambia la contraseña por
   una robusta. (Si no las defines, se usan unas de respaldo que NO debes dejar en producción.)
3. **Conexión del cliente:** la app **no** trae ninguna URL por defecto. En el primer uso, toca el
   indicador del encabezado ("Configurar conexión") y pega la URL de **tu** despliegue de Apps Script.
   Hazlo en cada dispositivo (PC y celular).
4. **Rotar despliegues de prueba:** si usaste un despliegue anterior, crea uno nuevo (nueva versión) y
   descarta el viejo.
5. **Fotos en Drive:** configura `DRIVE_FOLDER_ID` (una carpeta dedicada) en `google_apps_script.js`.
   Las fotos se comparten como "cualquiera con el enlace" para poder mostrarse; tenlo en cuenta.
6. **Datos personales:** el sistema guarda nombre/teléfono/cédula de clientes. El acceso queda
   protegido por el token; aun así, cuida quién tiene la contraseña y el token.

### Columnas recomendadas en las 5 hojas (para sincronización robusta)
`uuid, createdAt, updatedAt, deleted, deletedAt` — habilitan borrado lógico (tombstones) y descarga
incremental (delta). El backend funciona con o sin ellas.
