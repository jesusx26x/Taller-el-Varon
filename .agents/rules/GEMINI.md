# Reglas de Desarrollo — Proyecto Taller El Varón

## 1. Plan de Implementación como Guía Maestra

- El archivo `implementation_plan.md` es la **fuente de verdad** para el diseño, la estructura y las funcionalidades del sistema.
- Toda nueva funcionalidad, corrección o mejora **debe alinearse** con las fases y especificaciones definidas en el plan de implementación.
- Si se requiere un cambio significativo que desvíe del plan, se debe **actualizar el plan primero** y obtener aprobación del usuario antes de implementar.
- La estructura de archivos del proyecto debe respetar la definida en el plan (index.html, index.css, app.js, api.js, utils.js, print.js, google_apps_script.js, manifest.json).

## 2. Auditoría Obligatoria Post-Fase

Después de completar la implementación de **cada fase** del plan de implementación, se deben desplegar **agentes de auditoría** que validen:

### Criterios de Auditoría por Fase
- **Integridad de código**: Verificar que todos los archivos referenciados existen y no tienen errores de sintaxis JavaScript/CSS/HTML.
- **Completitud funcional**: Cada funcionalidad listada en la fase del plan debe estar implementada. Comparar contra el checklist del `task.md`.
- **Consistencia de datos**: Los campos del esquema de datos (Google Sheets) deben coincidir entre el backend (`google_apps_script.js`) y el frontend (`api.js`).
- **Navegación y routing**: Todas las rutas hash (`#dashboard`, `#ordenes`, `#clientes`, `#vehiculos`, `#orden-detalle/`) deben funcionar sin errores de consola.
- **Responsividad**: Las media queries deben cubrir breakpoints ≤768px (móvil) y >768px (desktop).
- **Estilos de impresión**: Las reglas `@media print` deben aislar correctamente la constancia imprimible.
- **Coherencia de datos del taller**: Nombre ("Taller El Varón"), dirección, teléfono, correo, horario, marcas deben aparecer correctamente en la constancia y donde corresponda.

### Proceso de Auditoría
1. Al terminar una fase, lanzar agentes subagentes de tipo `research` para leer todos los archivos del proyecto y validar contra el plan.
2. Documentar hallazgos (errores, omisiones, inconsistencias) en el `task.md`.
3. Corregir hallazgos antes de avanzar a la siguiente fase.
4. Marcar la auditoría como completada `[x]` en el `task.md`.

## 3. Reglas de Diseño y Estética

- **Tema visual**: Esquema Dominico-Profesional con azul primario (`#002D62`), azul secundario (`#0A4A8F`), rojo acento (`#CE1126`), fondo claro (`#F8F9FA`) y texto gris oscuro (`#343A40`).
- **Tipografía**: Sans para titulares e `Inter` para cuerpo e interfaz (pesos 300, 400, 500, 600, 700). Fallbacks: `Segoe UI`, `Helvetica`, `Arial`.
- **Cifras tabulares**: Los montos y valores numéricos deben usar `font-variant-numeric: tabular-nums` para alineación de cifras.
- **Idioma**: 100% en español dominicano. Todos los textos, labels, placeholders, mensajes y tooltips en español.
- **Moneda**: Siempre mostrar en Peso Dominicano con formato `RD$` usando `Intl.NumberFormat("es-DO")`.
- **Fechas**: Siempre formatear en español con `toLocaleString("es-DO")`.
- **Accesibilidad móvil**: Botones mínimo 44×44px, fuentes legibles (≥14px), formularios con `autocomplete` y `capture` para cámara.

## 4. Reglas de Estructura del Código

- **SPA con hash routing**: La navegación se maneja con `window.location.hash`. No se deben crear páginas HTML adicionales.
- **API dual (Nube/Local)**: El módulo `api.js` debe siempre soportar ambos modos. Si la conexión a Google Apps Script falla, el sistema debe degradar a modo local sin errores.
- **Modales reutilizables**: Todos los formularios de creación/edición se presentan en modales dentro de `index.html`, no en páginas separadas.
- **Estado centralizado**: `STATE.db` en `app.js` es la fuente de datos en memoria. Se actualiza llamando a `cargarDatosYRenderizar()` tras cada operación de escritura.
- **No se usan frameworks JS**: Solo Vanilla JS. No React, no Vue, no Angular.
- **No se usa Tailwind CSS**: Solo CSS vanilla con variables CSS custom properties.

## 5. Datos del Negocio (Constantes del Proyecto)

Estos datos son fijos y deben usarse consistentemente en todo el sistema:

| Dato | Valor |
|:---|:---|
| Nombre del Taller | Taller El Varón |
| Propietario | Pablo Rosario |
| Especialidad | Mecánica en General, Especialidad en Japoneses y Americanos |
| Marcas | Honda, Toyota, Hyundai, Ford |
| Dirección | Calle Faisán, No. 83, Los Americanos II, Los Alcarrizos, Santo Domingo Oeste |
| Horario | 8:30 AM – 7:30 PM |
| WhatsApp | (829)-941-9044 |
| Correo | pablorosario24201626@gmail.com |
| Credenciales | Usuario: `prosario` / Contraseña: `tallerelvaron` |
| Moneda | Peso Dominicano (RD$) |
| Idioma | Español |
