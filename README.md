# 🔧 Taller El Varón — Sistema de Gestión de Taller Mecánico

Sistema web responsivo para **Pablo Rosario** (Taller El Varón, Los Alcarrizos, Santo Domingo).

🔗 **Enlace Público (GitHub Pages)**: [https://jesusx26x.github.io/Taller-el-Varon/](https://jesusx26x.github.io/Taller-el-Varon/)

---

## 🔑 Credenciales de Acceso

- **Usuario**: `prosario`
- **Contraseña**: `tallerelvaron`

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
   - Inicia sesión con `prosario` / `tallerelvaron`.
   - En la barra superior, haz clic en **Conexión / Cloud**.
   - Pega la URL de Apps Script y haz clic en **Guardar Conexión**.

¡Listo! Todo quedará sincronizado automáticamente entre la PC y el celular de Pablo.
