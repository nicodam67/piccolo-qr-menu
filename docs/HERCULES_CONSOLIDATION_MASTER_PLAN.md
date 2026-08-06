# Plan maestro de consolidación de Hercules en Piccolo QR Menu

## 1. Decisión, propósito y límites

Este documento convierte en un plan ejecutable la decisión de detener la
migración técnica de la aplicación Vite + Convex y consolidar el QR Menu
definitivo en `piccolo-qr-menu`.

El destino será la aplicación Next.js existente, con PostgreSQL como
persistencia del QR Menu y el TPV Piccolo como autoridad futura del catálogo.
Hercules seguirá operativo únicamente como referencia funcional y mecanismo de
rollback hasta superar los criterios de retirada definidos al final.

Este plan:

- parte del código actual de `piccolo-qr-menu`;
- usa el inventario funcional conocido de Hercules;
- amplía lo que ya existe en lugar de reconstruirlo;
- evita mantener Convex como segundo catálogo;
- define un modelo mínimo, no una plataforma genérica;
- no presupone que todos los módulos secundarios deban estar terminados para el
  corte;
- no contiene migraciones ni cambios de base de datos.

Quedan expresamente fuera de esta planificación:

- continuar la migración técnica de Hercules;
- escribir en Convex o modificar sus deployments;
- sincronización bidireccional con el TPV;
- pedidos, comandas, pagos, extras, combos o variantes no necesarios para la
  paridad conocida;
- multi-restaurante o multi-tenant;
- reconstruir componentes que el proyecto Next.js ya resuelve;
- reproducir dependencias `@usehercules/*`, OIDC Hercules o
  `HERCULES_API_KEY`.

## 2. Base técnica existente que debe conservarse

### 2.1 Arquitectura

`piccolo-qr-menu` ya es una aplicación full-stack Next.js 16 con App Router,
React, TypeScript, PostgreSQL, Drizzle, Server Actions y una organización por
features. No necesita un backend paralelo para alcanzar la paridad.

La conexión PostgreSQL está centralizada en `src/db/index.ts`. El esquema vive
en `src/db/schema.ts`; las mutaciones administrativas se dividen entre Server
Actions autenticadas y repositorios `server-only`.

### 2.2 Modelo PostgreSQL actual

El modelo actual ya cubre:

- `restaurant_settings` y `restaurant_translations`;
- `opening_hours`;
- `categories` y `category_translations`;
- `products` y `product_translations`;
- `tags`, `tag_translations` y `product_tags`;
- `allergens`, `allergen_translations` y `product_allergens`;
- `admins` y `admin_login_attempts`.

Los precios se almacenan en céntimos. Categorías y productos tienen UUID local,
orden y visibilidad. Los productos incluyen precio completo, media ración,
agotado e imagen remota. Estas estructuras se deben ampliar de forma
compatible, no sustituir.

### 2.3 Repositorios y Server Actions

Ya existen repositorios separados para:

- lectura de la carta pública;
- dashboard administrativo;
- CRUD y ordenación de categorías;
- CRUD, relaciones y ordenación de productos;
- estado de administradores.

Las mutaciones de categorías y productos ya:

- requieren sesión administrativa;
- validan entrada en servidor;
- usan transacciones;
- protegen la ordenación mediante advisory locks;
- revalidan las vistas afectadas.

Los nuevos módulos deben seguir este patrón. No se introducirá una API REST
interna solo para reemplazar Server Actions existentes. Sí podrán existir Route
Handlers específicos para webhooks o sincronización TPV cuando el contrato del
TPV lo exija.

### 2.4 Menú público

La ruta `/es` ya ofrece:

- hero del restaurante;
- categorías y productos desde PostgreSQL;
- búsqueda por nombre, descripción, etiquetas y alérgenos;
- navegación sticky por categorías;
- precio completo y media ración;
- estado agotado;
- horarios y cálculo abierto/cerrado con zona horaria;
- botón de llamada;
- diseño responsive y accesibilidad básica.

No se reconstruirá esta página desde cero. Se convertirá en una experiencia
multilingüe, configurable y alimentada por los datos importados/sincronizados.

### 2.5 Panel administrativo

El panel ya dispone de:

- login;
- dashboard;
- gestión de categorías;
- gestión de productos;
- asignación de etiquetas y alérgenos existentes;
- ordenación drag-and-drop;
- visibilidad y agotado.

Se añadirán pantallas operativas únicamente para las brechas cerradas en este
plan. El dashboard de actividad actual es un placeholder y podrá convertirse
en una vista de auditoría después de que exista el registro de eventos.

### 2.6 Traducciones

Las tablas de traducciones ya usan claves compuestas por entidad y locale. Los
formularios administrativos pueden seleccionar locales existentes, pero:

- la ruta pública solo admite `es`;
- el selector público solo presenta `ES`;
- no existe gestión de idiomas;
- el repositorio público exige que el locale sea el predeterminado.

La solución debe aprovechar las tablas existentes, añadir un catálogo mínimo
de locales y eliminar los hardcodes, no introducir una segunda biblioteca o
estructura de traducciones salvo que una prueba técnica demuestre que es
necesario.

### 2.7 Imágenes

El proyecto guarda una URL por producto y una URL hero. No sube archivos y
`next/image` solo autoriza actualmente `images.unsplash.com`.

La consolidación necesita storage estable y metadatos de assets, pero debe
mantener temporalmente compatibilidad con `image_url` para evitar una
migración simultánea de todas las vistas.

### 2.8 Integración TPV

No existe código de integración TPV, SDK, webhook ni identificador externo en
el esquema actual. La integración será nueva, unidireccional y limitada al
catálogo. No se asumirá ningún endpoint o campo hasta disponer del contrato
real del TPV.

### 2.9 Autenticación

La autenticación local existente usa Argon2id, JWT firmado, cookie `httpOnly`,
rate limit persistido, `is_active` y `session_version`. Se conserva.

No se importarán contraseñas, sesiones, tokens ni secretos de Hercules. Los
usuarios que deban continuar se provisionarán como administradores locales o
mediante un proveedor futuro distinto, fuera del camino crítico.

### 2.10 Pruebas

Existe una suite E2E Playwright que cubre carta pública móvil, dashboard,
categorías, productos, login, logout, revocación y rate limit. No hay pruebas
unitarias, regresión visual, CI ni pruebas de importación/TPV.

Cada entrega debe extender las pruebas en proporción al riesgo. Las pruebas
contra importaciones usarán una base aislada y fixtures anonimizados; nunca el
deployment Convex ni la base PostgreSQL de producción.

## 3. Lista cerrada y clasificación de brechas

Las clasificaciones significan:

- **Obligatoria antes del corte:** su ausencia impide sustituir Hercules sin
  pérdida material o contradice la decisión de autoridad.
- **Recomendable antes del corte:** reduce riesgo, pero dispone de una
  alternativa operacional temporal.
- **Puede hacerse después:** no bloquea el servicio esencial de carta.
- **No debe reproducirse:** dependencia o arquitectura que contradice el
  destino.

| Brecha | Clasificación | Alcance mínimo |
| --- | --- | --- |
| Ocho idiomas públicos | Obligatoria antes del corte | Ocho locales confirmados, rutas públicas, contenido importado y fallback controlado |
| Selector de idiomas | Obligatoria antes del corte | Selector accesible que navega y conserva contexto |
| Branding completo | Obligatoria antes del corte | Identidad visual, logo, hero, colores y textos sin etiquetas demo |
| Imágenes importadas | Obligatoria antes del corte | Todos los binarios referenciados, URL estable y checksum |
| Vídeos importados | Obligatoria antes del corte | Importar únicamente vídeos realmente publicados; los no referenciados quedan en el archivo histórico |
| Filtros públicos | Obligatoria antes del corte | Solo filtros existentes en Hercules y usados por la carta |
| Horarios administrables | Obligatoria antes del corte | Semana, dos franjas, cierres y excepciones |
| Etiquetas administrables | Recomendable antes del corte | CRUD mínimo y traducciones; la importación completa permite aplazarlo brevemente |
| Alérgenos administrables | Recomendable antes del corte | CRUD mínimo, código, icono/nombre y traducciones |
| Impresión | Obligatoria antes del corte | Plantilla y contenido equivalente validados por el propietario, no un sistema genérico |
| Generación QR | Recomendable antes del corte | Generar/descargar la URL canónica; los QR existentes pueden servir durante la transición |
| Compartir | Recomendable antes del corte | Web Share API con copia de enlace como fallback |
| Exportación | Puede hacerse después | Exportación concreta acordada; no crear múltiples formatos sin consumidor |
| PWA | Puede hacerse después | Manifest, iconos y actualización; offline solo si se confirma necesario |
| Paridad visual | Obligatoria antes del corte | Identidad y flujos clave aprobados; no se exige reproducción pixel-perfect |
| Botón de llamada | Obligatoria antes del corte | Reutilizar lo existente, retirar texto/número demo y conservar `tel:` |
| Importación del backup | Obligatoria antes del corte | Repetible, idempotente, verificada y reversible |
| TPV como autoridad | Obligatoria antes del corte | Lectura unidireccional del catálogo y reglas de precedencia |
| Auditoría de import/sync | Obligatoria antes del corte | Runs, resultado, conteos, errores y hashes |
| Auditoría administrativa completa | Puede hacerse después | Historial consultable de cambios humanos |
| Hercules OIDC y `@usehercules/auth` | No debe reproducirse | Usar autenticación local existente |
| Convex como catálogo activo | No debe reproducirse | Solo snapshot histórico de entrada |
| Sincronización bidireccional TPV | No debe reproducirse | TPV → QR Menu; sin escrituras de retorno en la primera versión |
| Separación de catálogos dev/prod sin promoción controlada | No debe reproducirse | Entornos aislados con importaciones identificadas y reproducibles |
| Pantallas o módulos Hercules sin uso confirmado | No debe reproducirse | Exigir evidencia de uso antes de añadirlos |

## 4. Modelo destino mínimo propuesto

Esta sección define cambios conceptuales. No autoriza crear migraciones todavía.

### 4.1 Principios

1. Mantener las tablas de dominio existentes.
2. No usar IDs Convex o TPV como claves primarias PostgreSQL.
3. Centralizar IDs externos en una tabla de correspondencia.
4. Mantener la propiedad de campos explícita.
5. Hacer importaciones y sincronizaciones idempotentes mediante claves,
   versiones y hashes.
6. Separar binarios de sus relaciones de uso.
7. Registrar cada ejecución que pueda alterar catálogo o configuración.

### 4.2 Catálogo de locales

Nueva entidad conceptual `locales`:

| Campo | Propósito |
| --- | --- |
| `code` | Código BCP 47 corto usado por las traducciones |
| `label` | Nombre administrativo |
| `native_label` | Nombre mostrado en el selector |
| `is_active` | Publicación |
| `is_default` | Un único locale predeterminado |
| `sort_order` | Orden del selector |

Las tablas `*_translations` existentes se conservan. Debe definirse una FK o
validación equivalente cuando se diseñe la migración.

El fallback mínimo será:

1. traducción solicitada;
2. locale predeterminado;
3. no publicar la entidad si falta también el locale predeterminado.

No se mezclará silenciosamente texto de diferentes idiomas en una misma
tarjeta.

### 4.3 IDs externos

Nueva entidad conceptual `external_entity_mappings`:

| Campo | Propósito |
| --- | --- |
| `id` | UUID local del mapping |
| `source_system` | `hercules_convex` o `piccolo_tpv` |
| `entity_type` | `restaurant`, `category`, `product`, `tag`, `allergen`, `asset`, etc. |
| `external_id` | ID original inmutable |
| `local_entity_id` | UUID de la entidad PostgreSQL |
| `source_created_at` | `_creationTime` u origen equivalente |
| `source_updated_at` | Versión/fecha del origen si existe |
| `payload_hash` | SHA-256 de la representación canónica importada |
| `last_seen_run_id` | Última importación/sync donde apareció |
| `created_at`, `updated_at` | Trazabilidad local |

Restricciones mínimas:

- unique `(source_system, entity_type, external_id)`;
- unique según corresponda para evitar que un ID externo se asocie a dos UUID;
- la resolución de FK se hace siempre mediante este mapping;
- nunca se reutiliza un mapping para otro tipo de entidad.

No es necesario añadir columnas `convex_id` y `tpv_id` a cada tabla si esta
entidad cubre la consulta e indexación necesarias.

### 4.4 Assets de imágenes y vídeos

Nueva entidad conceptual `assets`:

| Campo | Propósito |
| --- | --- |
| `id` | UUID local |
| `kind` | `image` o `video` |
| `storage_provider` | Proveedor aprobado |
| `storage_key` | Clave estable, no URL firmada |
| `public_url` | URL pública o derivable |
| `original_filename` | Inventario y soporte |
| `content_type` | MIME verificado |
| `byte_size` | Control de integridad |
| `sha256` | Deduplicación y verificación |
| `width`, `height` | Opcional para imágenes/vídeos |
| `duration_ms` | Opcional para vídeos |
| `status` | `pending`, `ready`, `failed`, `quarantined` |
| `created_at`, `updated_at` | Trazabilidad |

Relaciones mínimas:

- `product_assets(product_id, asset_id, role, sort_order)`;
- referencias de branding a assets por rol;
- mapping Convex `_storage` → `assets.id`.

`products.image_url` se mantiene durante la transición como fallback o URL
materializada de la imagen principal. Solo se evaluará hacerlo nullable cuando
todas las lecturas usen assets.

No se crea un DAM, editor de vídeo ni transformación multimedia avanzada.

### 4.5 Branding

Nueva entidad conceptual `restaurant_branding`, uno a uno con
`restaurant_settings`:

| Campo | Propósito |
| --- | --- |
| `restaurant_id` | Identidad del restaurante |
| `logo_asset_id` | Logo principal |
| `hero_asset_id` | Hero |
| `favicon_asset_id` | Icono web/PWA futuro |
| `primary_color` | Color de marca |
| `secondary_color` | Color secundario |
| `accent_color` | Acento |
| `surface_color` | Fondo |
| `text_color` | Contraste |
| `font_heading` | Opción de una lista aprobada |
| `font_body` | Opción de una lista aprobada |
| `updated_at` | Trazabilidad |

Los nombres, slogans y descripciones siguen en
`restaurant_translations`. Teléfono, dirección, zona horaria y moneda siguen en
`restaurant_settings`.

No se almacenará CSS arbitrario procedente de Hercules.

### 4.6 Horarios y excepciones

`opening_hours` se conserva para la semana habitual. Su capacidad de dos
franjas y cierre nocturno ya cubre el comportamiento actual.

Nueva entidad conceptual `opening_hour_exceptions`:

| Campo | Propósito |
| --- | --- |
| `id` | UUID |
| `restaurant_id` | Restaurante |
| `date` | Fecha local afectada |
| `is_closed` | Cierre completo |
| `first_opens_at`, `first_closes_at` | Primera franja |
| `second_opens_at`, `second_closes_at` | Segunda franja |
| `label` | Nota administrativa opcional |
| `created_at`, `updated_at` | Trazabilidad |

Unique `(restaurant_id, date)`. La excepción prevalece sobre la semana
habitual. No se implementan calendarios recurrentes complejos sin un caso real.

### 4.7 Importaciones idempotentes

Nueva entidad conceptual `import_runs`:

| Campo | Propósito |
| --- | --- |
| `id` | UUID |
| `source_system` | `hercules_convex` |
| `source_snapshot_id` | Nombre/fecha/checksum del ZIP |
| `mode` | `dry_run` o `apply` |
| `status` | `pending`, `running`, `succeeded`, `failed`, `rolled_back` |
| `started_at`, `completed_at` | Duración |
| `manifest_sha256` | Identidad de entrada |
| `counts_json` | Esperado, insertado, actualizado, omitido y fallido |
| `error_summary` | Resumen no sensible |
| `initiated_by_admin_id` | Actor cuando aplique |

Nueva entidad conceptual `import_run_items` solo para errores, advertencias y
trazabilidad necesaria:

- `run_id`;
- tipo de entidad;
- external ID;
- acción;
- estado;
- código de error;
- detalle sanitizado.

No se almacenará el payload completo si contiene información sensible o duplica
innecesariamente el backup.

### 4.8 Sincronización TPV

Nueva entidad conceptual `sync_runs`, separada de importaciones históricas:

| Campo | Propósito |
| --- | --- |
| `id` | UUID |
| `source_system` | `piccolo_tpv` |
| `trigger` | manual, programado o webhook |
| `cursor_in`, `cursor_out` | Paginación/versionado si el TPV lo ofrece |
| `status` | Estado de ejecución |
| `started_at`, `completed_at` | Trazabilidad |
| `counts_json` | Recibido, aplicado, omitido, conflicto, error |
| `error_summary` | Diagnóstico sanitizado |

`external_entity_mappings` conserva `payload_hash`, `source_updated_at`,
`last_seen_run_id` y permite omitir payloads sin cambios.

No se diseñará polling, webhook o cursor definitivo hasta disponer de la API
real. Solo uno será el mecanismo principal; los demás serán recuperación.

### 4.9 Auditoría

Nueva entidad conceptual `audit_events`:

| Campo | Propósito |
| --- | --- |
| `id` | UUID |
| `occurred_at` | Fecha |
| `actor_type` | `admin`, `import`, `tpv_sync`, `system` |
| `actor_id` | Admin o run |
| `entity_type`, `entity_id` | Objeto afectado |
| `action` | create, update, deactivate, relate, etc. |
| `changed_fields` | Lista de campos, no secretos |
| `before_json`, `after_json` | Opcional y limitado |
| `correlation_id` | Agrupa una operación |

Antes del corte es obligatorio registrar importaciones y syncs. La captura
completa de todas las acciones administrativas y su UI de consulta puede
completarse después.

## 5. Estrategia de importación repetible

### 5.1 Entrada inmutable

La única entrada aceptable será un snapshot de **producción** Convex:

- ZIP completo;
- generado con file storage incluido;
- conservado sin modificar;
- acompañado por SHA-256 del ZIP;
- identificado con deployment, fecha y responsable;
- separado de cualquier snapshot de desarrollo.

El backup no sustituye al código Hercules: el propietario debe aportar también
el repositorio/commit desplegado para interpretar campos y referencias.

### 5.2 Inventario previo

Un comando futuro de inventario, sin escribir en PostgreSQL ni storage, deberá
producir:

- tablas y cantidad de documentos;
- campos observados, tipos y porcentaje de presencia;
- locales encontrados;
- IDs duplicados o referencias huérfanas;
- 26 categorías y 195 productos esperados, o explicación de cualquier
  diferencia;
- relaciones producto-categoría, tags y alérgenos;
- documentos de branding y horarios;
- referencias a `_storage`;
- archivos presentes y ausentes;
- tamaño, MIME y SHA-256 de cada binario;
- vídeos e imágenes realmente referenciados;
- usuarios/identidades sin secretos;
- un manifiesto JSON determinista y un informe legible.

El inventario es un gate: no comienza la transformación hasta que el propietario
acepte cantidades y anomalías.

### 5.3 Transformación

El extractor debe leer el ZIP sin modificarlo y producir un modelo intermedio
versionado:

- strings normalizados sin alterar contenido visible;
- locales mapeados a códigos aprobados;
- precios convertidos a céntimos con rechazo de valores ambiguos;
- booleanos de visible/agotado con semántica documentada;
- horarios normalizados y excepciones separadas;
- relaciones expresadas por external IDs;
- referencias storage convertidas a un inventario de assets;
- payload canónico por entidad y SHA-256;
- errores con código estable y sin pérdida silenciosa.

No se importará directamente JSONL Convex en tablas PostgreSQL.

### 5.4 Mapa Convex ID → UUID

Para cada documento:

1. buscar `(hercules_convex, entity_type, external_id)`;
2. reutilizar el UUID si existe;
3. crear un UUID si no existe;
4. registrar el mapping antes de resolver relaciones dependientes;
5. comparar `payload_hash`;
6. omitir si no cambió;
7. aplicar solo campos cuya autoridad todavía sea `historical_import`;
8. registrar el run donde fue visto.

Esto garantiza que repetir el mismo snapshot no duplique registros.

### 5.5 Orden de carga

El orden obligatorio será:

1. run de importación y locales;
2. restaurante y traducciones;
3. branding sin assets enlazados;
4. categorías y traducciones;
5. tags, alérgenos y traducciones;
6. productos y traducciones;
7. relaciones producto-categoría, producto-tag y producto-alérgeno;
8. horarios habituales y excepciones;
9. metadatos de assets;
10. transferencia/verificación de binarios;
11. enlaces producto-assets y branding-assets;
12. validación integral;
13. publicación solo si el run completo es aceptado.

### 5.6 Archivos y vídeos

Cada archivo se procesa por contenido:

1. localizarlo en `_storage`;
2. calcular SHA-256 local;
3. contrastarlo con metadatos Convex si están disponibles;
4. validar MIME por contenido, no solo extensión;
5. rechazar ejecutables o formatos no permitidos;
6. deduplicar por SHA-256 cuando sea seguro;
7. subir con una clave estable;
8. leer de vuelta metadatos del storage;
9. marcar `ready`;
10. enlazarlo únicamente tras la verificación.

Una referencia sin binario es error bloqueante si aparece en contenido
publicado. Un archivo no referenciado se conserva en el archivo histórico, pero
no necesariamente se publica en el nuevo storage.

### 5.7 Modos de ejecución

El importador tendrá:

- `inventory`: solo lectura y manifiesto;
- `dry-run`: valida transformación y operaciones previstas contra una base
  aislada;
- `apply`: escribe en un entorno destino explícito;
- `verify`: recalcula cantidades, relaciones y checksums;
- `rollback-run`: revierte únicamente cambios atribuibles al run cuando sea
  seguro.

No se seleccionará producción por defecto. `apply` exigirá identificador del
snapshot, entorno explícito y confirmación humana fuera del código.

### 5.8 Verificación

Un run no se acepta hasta comprobar:

- conteos por entidad y locale;
- 100 % de referencias obligatorias resueltas;
- cero categorías/productos duplicados;
- precio y media ración exactos;
- orden preservado;
- estados visible/agotado preservados;
- traducciones completas según matriz aprobada;
- cantidad de assets esperada;
- SHA-256 coincidente para cada asset publicado;
- cero URLs Convex/Hercules en contenido publicado;
- render público de una muestra y casos límite;
- repetición del mismo run con cero duplicados y cero cambios inesperados.

### 5.9 Prueba y rollback

Secuencia:

1. ejecutar en base y bucket aislados;
2. revisar informe con el propietario;
3. restaurar entorno de prueba desde cero;
4. repetir y comparar manifiestos;
5. crear backup PostgreSQL antes de producción;
6. ejecutar importación final;
7. verificar;
8. si falla antes de publicar, eliminar/restaurar por run;
9. si falla después de publicar, restaurar PostgreSQL/storage y mantener
   Hercules como destino activo.

El rollback no depende de volver a escribir en Convex.

## 6. Autoridad de datos

### 6.1 Regla general

Solo una fuente escribe cada campo en operación normal. La primera versión no
envía cambios desde QR Menu al TPV.

| Datos | Autoridad | Regla |
| --- | --- | --- |
| Identidad/SKU de categoría o producto TPV | TPV | Se conserva mediante mapping |
| Existencia y baja de productos TPV | TPV | Baja lógica; no borrado destructivo automático |
| Categoría base y pertenencia de producto | TPV | QR puede añadir presentación, no reasignar la fuente |
| Precio completo y media ración cuando existen en TPV | TPV | El admin QR los muestra como solo lectura |
| Disponibilidad/agotado cuando existe en TPV | TPV | Actualización unidireccional |
| Nombre base aportado por TPV | TPV | Es la base del locale acordado |
| Traducciones adicionales | QR Menu | No se sobrescriben por ausencia en TPV |
| Descripción editorial | QR Menu, salvo campo TPV explícito | La decisión se fija por campo en el contrato |
| Orden público | QR Menu | Permite presentación independiente sin alterar TPV |
| Tags y alérgenos | QR Menu salvo soporte TPV confirmado | Nunca ambos; se fijará por campo |
| Imágenes y vídeos | QR Menu/storage | TPV puede aportar referencia inicial, no URL efímera |
| Branding | Configuración administrativa QR | Nunca TPV |
| Teléfono, dirección y llamada | Configuración administrativa QR | Nunca catálogo TPV |
| Idiomas y fallbacks | Configuración administrativa QR | Nunca TPV |
| Horarios y excepciones | Configuración administrativa QR | Salvo integración futura distinta del catálogo |
| QR, compartir, impresión y PWA | QR Menu | Presentación |
| Administradores | Autenticación QR | No se importan credenciales Hercules |
| Datos Convex importados | Histórico/bootstrap | Pierden autoridad al quedar mapeados al TPV o al admin QR |

Si el TPV no ofrece un campo, se asigna explícitamente a QR Menu. No se crea una
regla de “última escritura gana”.

### 6.2 Transición de autoridad

1. El snapshot Hercules inicia los datos.
2. Cada categoría/producto se vincula a un ID TPV.
3. Se ejecuta una comparación sin aplicar cambios.
4. El propietario aprueba mappings y diferencias.
5. El TPV pasa a ser autoridad de los campos acordados.
6. Las futuras importaciones Hercules quedan deshabilitadas en producción.
7. Convex se mantiene solo como backup histórico.

Los elementos históricos sin equivalente TPV requieren una decisión humana:

- vincular a una entidad TPV;
- conservar como contenido QR-only;
- ocultar;
- archivar.

## 7. Entregas ejecutables

Se proponen **10 entregas**. Cada una debe ser un cambio revisable y desplegable
por separado; ninguna autoriza desplegar automáticamente a producción.

### Entrega 0 — Paquete de fuentes y contrato de aceptación

- **Objetivo:** cerrar las entradas reales antes de diseñar migraciones.
- **Áreas previsibles:** `docs/`, fixtures fuera del repositorio o sanitizados,
  definición de manifiesto.
- **Pruebas obligatorias:** SHA-256 del snapshot; apertura del ZIP; inventario
  sin escritura; reconciliación de conteos.
- **Criterio de aceptación:** snapshot prod con storage, commit Hercules,
  ocho locales, lista de funciones usadas y cantidades aprobadas.
- **Dependencias:** ninguna.
- **Riesgo:** alto.
- **Esfuerzo relativo:** medio.
- **Modelo Cursor recomendado:** GPT-5.6 Sol High.
- **Intervención humana:** sí, propietario y responsable operativo.

### Entrega 1 — Modelo destino y migraciones revisables

- **Objetivo:** implementar únicamente locales, mappings externos, assets,
  branding, excepciones, runs y auditoría definidos en la sección 4.
- **Áreas previsibles:** `src/db/schema.ts`, `drizzle/`, repositorios de
  infraestructura, documentación de autoridad.
- **Pruebas obligatorias:** generación limpia; migración forward en base vacía
  y copia realista; constraints; rollback ensayado en entorno de prueba.
- **Criterio de aceptación:** modelo soporta el manifiesto sin campos JSON
  opacos de dominio ni IDs externos como PK.
- **Dependencias:** Entrega 0.
- **Riesgo:** muy alto.
- **Esfuerzo relativo:** alto.
- **Modelo Cursor recomendado:** GPT-5.6 Sol High.
- **Intervención humana:** sí, aprobación del modelo y política de datos.

### Entrega 2 — Inventario e importador idempotente de datos

- **Objetivo:** importar categorías, productos, traducciones, relaciones,
  branding y horarios sin assets.
- **Áreas previsibles:** `src/features/import/`, scripts de CLI, repositorios,
  fixtures y pruebas.
- **Pruebas obligatorias:** inventory/dry-run/apply/verify/rollback; dos
  ejecuciones idénticas; referencias huérfanas; precios y conteos.
- **Criterio de aceptación:** importación repetible con cero duplicados y
  manifiesto reconciliado.
- **Dependencias:** Entregas 0 y 1.
- **Riesgo:** muy alto.
- **Esfuerzo relativo:** muy alto.
- **Modelo Cursor recomendado:** GPT-5.6 Sol High.
- **Intervención humana:** sí, resolución de anomalías y mappings ambiguos.

### Entrega 3 — Storage e importación de imágenes/vídeos

- **Objetivo:** trasladar solo assets necesarios y eliminar dependencias de URLs
  Hercules/Convex.
- **Áreas previsibles:** adapter de storage, `next.config.ts`, componentes de
  imagen/vídeo, importador y administración mínima de assets.
- **Pruebas obligatorias:** SHA-256, MIME, deduplicación, fichero ausente,
  reintento, lectura pública y responsive.
- **Criterio de aceptación:** 100 % de assets publicados verificados; ninguna
  referencia externa antigua en la carta.
- **Dependencias:** Entregas 1 y 2; proveedor de storage aprobado.
- **Riesgo:** alto.
- **Esfuerzo relativo:** alto.
- **Modelo Cursor recomendado:** GPT-5.6 Sol High.
- **Intervención humana:** sí, credenciales/configuración del storage y
  validación de derechos sobre archivos.

### Entrega 4 — Ocho idiomas y selector público

- **Objetivo:** publicar la carta en los ocho idiomas confirmados reutilizando
  las tablas de traducciones.
- **Áreas previsibles:** `src/app/[locale]/`, `src/features/public-menu/`,
  selector, metadata, layout y admin de locales.
- **Pruebas obligatorias:** cada locale, fallback, entidad sin traducción,
  selector, `<html lang>`, enlaces y búsqueda con diacríticos.
- **Criterio de aceptación:** ocho rutas navegables con contenido aprobado y
  sin mezclas silenciosas de idiomas.
- **Dependencias:** Entregas 1 y 2.
- **Riesgo:** alto.
- **Esfuerzo relativo:** alto.
- **Modelo Cursor recomendado:** GPT-5.6 Sol High.
- **Intervención humana:** sí, traducciones y orden/fallback de locales.

### Entrega 5 — Configuración administrativa de paridad

- **Objetivo:** administrar branding, teléfono, horarios/excepciones, tags y
  alérgenos sin tocar campos controlados por el TPV.
- **Áreas previsibles:** `src/app/admin/`, `src/features/admin/`, repositorios,
  Server Actions y controles de autoridad.
- **Pruebas obligatorias:** autorización, validación, CRUD, concurrencia,
  revalidación pública y auditoría.
- **Criterio de aceptación:** el propietario puede mantener toda configuración
  QR-only necesaria tras retirar Hercules.
- **Dependencias:** Entregas 1, 3 y 4.
- **Riesgo:** alto.
- **Esfuerzo relativo:** muy alto.
- **Modelo Cursor recomendado:** GPT-5.6 Sol High.
- **Intervención humana:** sí, branding, horarios y reglas editoriales.

### Entrega 6 — Paridad pública mínima

- **Objetivo:** igualar la experiencia usada de Hercules sin rehacer el menú.
- **Áreas previsibles:** carta pública, filtros, estilos, impresión, botón de
  llamada y componentes responsive.
- **Pruebas obligatorias:** filtros conocidos, impresión, 320/390/tablet/desktop,
  navegación, accesibilidad básica y regresión visual.
- **Criterio de aceptación:** branding/contenido aprobados, filtros equivalentes,
  llamada real e impresión aceptada.
- **Dependencias:** Entregas 2 a 5.
- **Riesgo:** alto.
- **Esfuerzo relativo:** alto.
- **Modelo Cursor recomendado:** GPT-5.6 Sol High.
- **Intervención humana:** sí, comparación visual y prueba física de impresión.

### Entrega 7 — TPV como autoridad y auditoría de sincronización

- **Objetivo:** activar el flujo unidireccional TPV → PostgreSQL para campos de
  catálogo acordados.
- **Áreas previsibles:** adapter TPV, Route Handler/worker programado según
  contrato, mappings, `sync_runs`, repositorios y UI de estado.
- **Pruebas obligatorias:** contrato, paginación, idempotencia, reintentos,
  bajas, payload atrasado, timeout, rate limit, ocultación de secretos y
  ejecución de comparación sin escritura.
- **Criterio de aceptación:** dos syncs consecutivos convergen; no sobrescriben
  campos QR-only; diferencias y errores son visibles.
- **Dependencias:** Entregas 1 y 2; contrato y acceso TPV.
- **Riesgo:** muy alto.
- **Esfuerzo relativo:** muy alto.
- **Modelo Cursor recomendado:** GPT-5.6 Sol High.
- **Intervención humana:** sí, proveedor/propietario TPV y aprobación de
  autoridad por campo.

### Entrega 8 — Calificación y corte controlado

- **Objetivo:** demostrar que Next.js puede sustituir Hercules y ejecutar el
  cambio de dominio con rollback.
- **Áreas previsibles:** suite E2E, regresión visual, scripts de reconciliación,
  runbook de dominio, monitorización y QR canónico.
- **Pruebas obligatorias:** importación final ensayada, sync TPV, ocho idiomas,
  assets, móvil, admin, filtros, llamada, impresión, enlaces QR
  existentes, backup y restauración.
- **Criterio de aceptación:** checklist de corte firmado, cero bloqueantes,
  rollback ensayado y métricas iniciales disponibles.
- **Dependencias:** Entregas 0 a 7.
- **Riesgo:** muy alto.
- **Esfuerzo relativo:** alto.
- **Modelo Cursor recomendado:** GPT-5.6 Sol High.
- **Intervención humana:** sí, aceptación, DNS/dominio y decisión go/no-go.

### Entrega 9 — Funciones aplazables

- **Objetivo:** completar solo módulos con valor confirmado después del corte.
- **Áreas previsibles:** exportación acordada, PWA, generador/descarga QR,
  compartir avanzado y UI completa de auditoría.
- **Pruebas obligatorias:** específicas del consumidor; instalación/actualización
  PWA; contenido QR; permisos y volumen de auditoría.
- **Criterio de aceptación:** cada módulo tiene usuario, formato y necesidad
  aprobados antes de implementarse.
- **Dependencias:** Entrega 8.
- **Riesgo:** medio.
- **Esfuerzo relativo:** medio, potencialmente alto si se confirma offline.
- **Modelo Cursor recomendado:** GPT-5.6 Sol High.
- **Intervención humana:** sí, priorización de producto.

## 8. Primera versión capaz de sustituir Hercules

La primera versión de corte incluye:

1. importación verificada del snapshot de producción;
2. categorías, productos, precios, medias raciones, estados y relaciones;
3. ocho idiomas y selector;
4. imágenes y vídeos publicados realmente usados;
5. branding, teléfono y botón de llamada reales;
6. horarios y excepciones administrables;
7. filtros públicos equivalentes a los usados en Hercules;
8. impresión validada contra la referencia Hercules;
9. administración suficiente de contenido QR-only;
10. integración unidireccional TPV para campos de catálogo;
11. runs de import/sync auditables;
12. paridad visual aprobada, sin exigir reproducción pixel-perfect;
13. dominio/URL compatibles con los QR existentes o plan de sustitución;
14. rollback probado hacia Hercules.

No necesita para el corte:

- exportación genérica;
- instalación PWA;
- generador QR completo si los QR existentes continúan válidos;
- compartir avanzado;
- UI completa de auditoría;
- MFA/RBAC avanzado;
- escritura hacia el TPV;
- pedidos, extras, variantes o combos.

## 9. Camino crítico

```text
Entrega 0: fuentes reales y aceptación
  → Entrega 1: modelo mínimo
  → Entrega 2: importación idempotente
  → Entrega 3: assets
  → Entrega 4: ocho idiomas
  → Entrega 5: administración QR-only
  → Entrega 6: paridad pública
  → Entrega 7: autoridad TPV
  → Entrega 8: calificación y corte
```

Las Entregas 3 y 4 pueden desarrollarse en paralelo después de las Entregas 1
y 2. La Entrega 7 puede avanzar en paralelo con 3–6 cuando exista el contrato
TPV, pero todas deben converger antes de la Entrega 8.

## 10. Funcionalidades mínimas para el corte

- ocho idiomas y selector funcional;
- catálogo completo importado con relaciones y orden;
- precios y medias raciones correctos;
- visibilidad y agotado;
- imágenes y vídeos publicados utilizados;
- branding y datos reales del restaurante;
- horarios y excepciones administrables;
- filtros usados actualmente;
- botón de llamada real;
- impresión validada;
- autenticación/admin existente más configuración QR-only;
- TPV como autoridad unidireccional del catálogo;
- auditoría de importación y sincronización;
- paridad visual aprobada;
- compatibilidad de URL/QR y rollback ensayado.

## 11. Funcionalidades aplazables

- exportación;
- PWA y offline;
- generador/descarga QR completo;
- compartir avanzado;
- UI de auditoría administrativa completa;
- roles avanzados y MFA;
- optimización multimedia avanzada;
- cualquier módulo sin evidencia de uso.

## 12. Bloqueantes humanos

1. Acceso de lectura al repositorio Hercules y commit exacto desplegado.
2. Snapshot Convex de producción con file storage.
3. Confirmación de que el snapshot no es de desarrollo.
4. Lista exacta y orden de los ocho idiomas.
5. Traducciones aprobadas y reglas de fallback.
6. Inventario aceptado de categorías, productos y 262 archivos aproximados.
7. Resolución de referencias huérfanas o datos ambiguos.
8. Assets de branding originales y derechos de uso.
9. Confirmación de vídeos realmente publicados.
10. Confirmación de necesidad y alcance de PWA, exportación y generación QR.
11. Contrato/API del TPV, autenticación, entorno de prueba, límites y soporte.
12. Decisión de autoridad por campo cuando el TPV no lo ofrezca.
13. Mapeo de categorías/productos históricos sin equivalente TPV.
14. Proveedor y credenciales de storage.
15. Aceptación visual en dispositivos objetivo.
16. Control del dominio, DNS y URLs de QR existentes.
17. Ventana de corte, responsable go/no-go y responsable de rollback.

## 13. Datos y archivos que debe aportar el propietario

- ZIP Convex de producción con `_storage`;
- SHA-256 y fecha del ZIP;
- nombre del deployment de origen;
- repositorio/archivo Hercules y commit desplegado;
- esquema y funciones Convex correspondientes;
- listado de variables requerido, sin compartir secretos en Git;
- ocho locales y contenido traducido;
- listado esperado de 26 categorías y 195 productos;
- manifiesto esperado de archivos o aceptación del generado;
- logos, favicons, hero, paleta y tipografías;
- horarios reales y excepciones conocidas;
- teléfono, dirección, moneda y zona horaria reales;
- ejemplos de impresión;
- QR existentes y sus URLs;
- documentación y credenciales de sandbox TPV por canal seguro;
- reglas empresariales de precios, media ración, disponibilidad y bajas;
- lista de administradores que deben provisionarse, sin contraseñas Hercules.

## 14. Estimación relativa por entrega

| Entrega | Esfuerzo |
| --- | --- |
| 0. Fuentes y contrato | Medio |
| 1. Modelo destino | Alto |
| 2. Importador | Muy alto |
| 3. Storage/assets | Alto |
| 4. Ocho idiomas | Alto |
| 5. Administración de paridad | Muy alto |
| 6. Paridad pública | Alto |
| 7. Integración TPV | Muy alto |
| 8. Calificación/corte | Alto |
| 9. Funciones aplazables | Medio, o alto si se exige offline complejo |

Estas categorías expresan complejidad relativa, no horas ni calendario.

## 15. Punto exacto para retirar Hercules

Será seguro retirar Hercules únicamente cuando se cumplan simultáneamente todas
estas condiciones:

1. el snapshot final de producción y sus assets están preservados y
   verificables;
2. una importación limpia y repetible ha sido aceptada;
3. los conteos, relaciones, traducciones, precios, estados y SHA-256 coinciden
   con el manifiesto aprobado;
4. los ocho idiomas, filtros, branding, horarios, assets y llamada funcionan en
   producción;
5. la impresión ha sido aceptada frente a la referencia Hercules;
6. el TPV es la única autoridad activa de los campos de catálogo acordados y
   dos sincronizaciones consecutivas han convergido sin conflictos;
7. no quedan URLs ni lecturas runtime de Convex/Hercules;
8. los QR existentes resuelven al nuevo dominio o han sido sustituidos;
9. el panel permite mantener todos los datos QR-only necesarios;
10. las pruebas E2E, de importación, integración, regresión visual y restauración
    están verdes;
11. el propietario ha firmado la aceptación funcional y visual;
12. ha transcurrido el periodo de observación acordado sin incidentes
    bloqueantes;
13. todavía existe un backup restaurable independiente de Hercules.

En ese punto se puede desactivar la aplicación y el acceso operativo de
Hercules. Los backups, manifiestos, código y mappings históricos se conservan
según la política de retención; Convex no permanece como catálogo ni fallback
activo.
