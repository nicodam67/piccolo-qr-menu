# Compatibilidad con el backup real Hercules/Convex

## Alcance

Esta entrega adapta exclusivamente el importador de
`src/features/hercules-import/` a la forma observada en el backup real auditado
en el PR #15. No autoriza un `apply` del backup real, no copia binarios y no
modifica Convex, Vercel, producción ni la interfaz.

Entrada auditada:

- Release: `hercules-backup-audit-v1`;
- archivo: `Qrmenu.todo.el.programa.zip`;
- SHA-256:
  `fab06511412671cd2394e8b44993c82d913cbb73f715b81579b57494f13812a8`;
- 14 tablas, 980 documentos, 26 categorías, 195 productos;
- 262 documentos `_storage` y 262 binarios físicos;
- 8 locales: `ca`, `de`, `en`, `es`, `fr`, `it`, `nl`, `ro`.

Los ejemplos de este documento son sintéticos y no reproducen contenido del
restaurante.

## Diferencias del formato real

### Storage

Los metadatos usan `_storage._id = "storage-synthetic"`, pero el ZIP nombra el
binario `_storage/storage-synthetic.png`. La versión anterior usaba el nombre
completo como storage ID y producía dos entradas lógicas.

La resolución actual:

1. prefiere una coincidencia literal;
2. si no existe, acepta `<storage-id>.<ext>` únicamente cuando `<storage-id>`
   coincide con un documento `_storage`;
3. rechaza dos binarios que resuelvan al mismo storage ID;
4. mantiene el nombre físico y `internalId` como metadata;
5. valida tamaño, MIME y SHA-256;
6. acepta SHA-256 declarado en hexadecimal o Base64;
7. crea una sola entrada lógica por storage ID;
8. conserva referencias detalladas por entidad, rol y orden;
9. usa SHA-256 para proponer deduplicación entre IDs distintos sin ocultar la
   relación original.

### Branding y horarios

El backup usa campos agrupados (`themeColors`, `themeFonts`, `schedule`) y
aliases (`restaurantName`, `tagline`, `heroImageStorageId`) que no estaban en
el adaptador. El horario estructurado es un array de siete días con dos turnos
opcionales por día.

### Productos y estados

El precio de media ración aparece como `halfPortionPrice`, la cantidad como
texto en `quantity` y el vídeo como `videoStorageId`. `available` existe en
productos y en una parte de las categorías.

## Tratamiento de los 17 campos

| # | Tabla | Campo y tipo real | Ejemplo sanitizado | Destino | Regla | Decisión |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | `_storage` | `internalId: string` | `"0000…0001"` | `assets` + metadata del mapping | Se conserva junto al nombre físico; `_id` sigue siendo el ID externo | Preservar como metadata |
| 2 | `branding` | `cardSettings: object` | `{ "layout": "grid", "showPrice": true }` | `external_entity_mappings.metadata` | Se preserva completo; el modelo destino no tiene preferencias de tarjeta | Preservar como metadata |
| 3 | `branding` | `city: string` | `"Ciudad sintética"` | metadata de restaurant/branding | No se concatena silenciosamente con `address` | Preservar como metadata |
| 4 | `branding` | `establishedYear: string` | `"2000"` | metadata de restaurant/branding | Se conserva como texto para evitar coerción | Preservar como metadata |
| 5 | `branding` | `heroImageStorageId: string` | `"hero-synthetic"` | `restaurant_branding.hero_asset_id` | Alias de `heroId`; se resuelve mediante el mapping de asset | Mapear |
| 6 | `branding` | `hours: string` | `"Horario sintético"` | metadata de restaurant/branding | Texto de presentación; no se interpreta como horario estructurado | Preservar como metadata |
| 7 | `branding` | `postalCode: string` | `"00000"` | metadata de restaurant/branding | Se mantiene separado de `address` | Preservar como metadata |
| 8 | `branding` | `province: string` | `"Provincia sintética"` | metadata de restaurant/branding | Se mantiene separado de `address` | Preservar como metadata |
| 9 | `branding` | `restaurantName: string` | `"Restaurante sanitizado"` | `restaurant_translations.name` (`es`) | Alias del nombre base cuando no existe traducción `es` con nombre | Mapear |
| 10 | `branding` | `schedule: array` | `[{ "day": "monday", "shift1": {…} }]` | `opening_hours` | Día 1–7, cierre explícito y hasta dos periodos; no se inventan días ausentes | Importar |
| 11 | `branding` | `tagline: string` | `"Eslogan sintético"` | `restaurant_translations.slogan` (`es`) | Alias del eslogan base | Mapear |
| 12 | `branding` | `themeColors: object` | `{ "primary": "#112233", "accent": "#445566" }` | `restaurant_branding` + metadata | `primary`, `accent`, `background` y color de texto se mapean; todas las variantes se preservan | Mapear y preservar |
| 13 | `branding` | `themeFonts: object` | `{ "heading": "Sans", "body": "Serif" }` | `restaurant_branding` + metadata | `heading`/`body` se mapean; colores y variantes se preservan | Mapear y preservar |
| 14 | `categories` | `available: boolean` | `false` | `categories.is_active` + metadata | Participa en la precedencia de estados | Mapear |
| 15 | `menuItems` | `halfPortionPrice: number` | `7.25` | `products.half_price_cents` | Conversión decimal exacta, máximo dos decimales; nunca se redondea | Importar |
| 16 | `menuItems` | `quantity: string` | `"250 g"` | `external_entity_mappings.metadata` | Se conserva sin intentar separar cantidad/unidad sin contrato | Preservar como metadata |
| 17 | `menuItems` | `videoStorageId: string` | `"video-synthetic"` | `product_assets(role = 'video')` | Alias singular de vídeo, con orden 0 | Mapear |

Ninguno de estos campos puede terminar en `UNKNOWN_DOCUMENT_FIELD`. Un tipo no
válido genera un issue explícito y no una conversión silenciosa.

## Branding

El adaptador conserva:

- nombre, eslogan y descripción por traducción;
- aliases de nombre/eslogan del locale base;
- teléfono, dirección, zona horaria y moneda;
- logo, hero e icono;
- paleta principal y todas sus variantes en metadata;
- fuentes principales y todas sus variantes en metadata;
- enlaces ordenados;
- preferencias de tarjeta;
- ciudad, provincia, código postal y año de fundación;
- texto de horario y horario estructurado.

No se crea una descripción si no existe. La columna PostgreSQL no nullable
recibe cadena vacía únicamente para representar ausencia explícita, y el
informe de traducciones mantiene esa ausencia visible.

## Horarios

`schedule` admite los días ingleses de `monday` a `sunday`. Cada día puede
contener `shift1` y `shift2`:

- `open: false` no crea un periodo;
- `open: true` exige `openTime` y `closeTime` en `HH:mm`;
- `24:00` se admite como cierre;
- cero periodos produce `is_closed = true`;
- uno o dos periodos se conservan en orden;
- un cierre menor o igual que la apertura se marca como cruce de medianoche y
  se conserva;
- días desconocidos, repetidos u horas inválidas son errores bloqueantes;
- si no hay `schedule`, no se inventan ni se eliminan horarios;
- el backup auditado no contiene excepciones de calendario.

Las excepciones no se sintetizan desde el texto `hours`. Si una fuente futura
incluye excepciones estructuradas, requerirá un adaptador explícito a
`opening_hour_exceptions`.

Cuando coexisten `hours` y `schedule`, se genera
`HOURS_SCHEDULE_REVIEW`: `schedule` es la fuente estructurada importable y
`hours` se conserva literalmente en metadata. En el backup real ambos campos
no son equivalentes, por lo que la elección requiere aprobación humana antes
de cualquier apply.

## Disponibilidad y estados

Se preservan por separado `active`, `visible`, `available`, `soldOut`, `hidden`
y `archived` en el modelo normalizado y en metadata.

Precedencia para `is_active`:

1. `archived = true` desactiva;
2. `hidden = true` desactiva;
3. `active = false` desactiva;
4. `visible = false` desactiva;
5. `available = false` desactiva;
6. en ausencia de negaciones explícitas, queda activo.

`soldOut` se conserva independientemente: un producto agotado puede seguir
visible. Combinaciones como `visible + hidden` o `active + archived` generan
`CONFLICTING_STATE_FLAGS`.

## Precios, media ración y cantidad

- `price`, `fullPrice` y sus aliases se convierten exactamente a céntimos;
- `halfPortionPrice`, `halfPrice` y sus aliases usan la misma validación;
- más de dos decimales, valores negativos o formatos ambiguos se rechazan;
- las 31 medias raciones del backup tienen como máximo dos decimales;
- si hay precio pero no flag de disponibilidad de media ración, se conserva el
  precio y se solicita revisión mediante `HALF_PORTION_FLAG_MISSING`;
- `quantity` se conserva literalmente en metadata porque el esquema actual no
  separa cantidad y unidad.

## Multimedia y referencias múltiples

Cada referencia contiene:

- entidad y external ID;
- rol (`primary`, `gallery`, `video`, `logo`, `hero`, `icon`);
- orden.

`referencedBy` continúa exponiendo dependencias únicas de entidades para el
plan, mientras `references` distingue varios usos del mismo asset. Una imagen
usada por dos productos o por varios roles sigue generando un único asset
lógico por storage ID.

El backup contiene 172 imágenes principales, 2 vídeos de producto y 1 hero de
branding. Las 175 referencias apuntan a IDs presentes; los falsos faltantes de
la auditoría anterior procedían únicamente de la extensión del nombre físico.

## Traducciones incompletas

No se inventa texto. El informe diferencia:

- `MISSING_TRANSLATION`: no existe entrada para el locale;
- `EMPTY_TRANSLATION`: existe entrada, pero el nombre está vacío;
- `TRANSLATION_EQUALS_BASE`: el nombre coincide con el locale base;
- `UNKNOWN_LOCALE`: locale fuera de la lista soportada;
- `baseFallback`: un campo base explícito (`name`, `restaurantName`) se mapea a
  `es`; no se copia a otros idiomas.

`validation-report.json` incluye una matriz por tabla y locale con presentes,
fallback base, ausentes, vacías e iguales al idioma base.

## Rechazos e intervención humana

Un rechazo queda reservado para:

- JSONL inválido;
- IDs duplicados en tablas soportadas;
- referencias obligatorias inexistentes;
- precio no representable exactamente;
- schedule estructurado inválido;
- locale desconocido;
- binario referenciado realmente ausente;
- discrepancias reales de tamaño, MIME o SHA-256;
- campos sensibles en entidades importables.

Cada issue incluye código, severidad, tabla, external ID, campo (`path`) y
mensaje. Las advertencias de traducción, metadata preservada, tablas auxiliares
y archivos huérfanos no rechazan entidades válidas.

Intervención humana pendiente:

1. aprobar las traducciones ausentes, vacías o iguales a la base;
2. decidir el uso funcional de `quantity`;
3. confirmar si un precio de media ración sin flag implica disponibilidad;
4. aprobar paleta, fuentes, horarios y preferencias visuales;
5. decidir si los assets históricos no referenciados deben conservarse fuera
   del catálogo publicado;
6. aprobar cualquier rechazo restante antes de un apply.

## Gate para un apply en base de test

Antes de permitir un apply sintético o futuro ensayo aislado:

1. checksum del ZIP verificado;
2. inspect y dry-run deterministas;
3. 262 assets físicos y 262 lógicos;
4. cero falsos faltantes de storage;
5. 26 categorías, 195 productos y 8 locales;
6. 31 precios de media ración exactos;
7. 3 referencias multimedia problemáticas resueltas;
8. branding y siete días de horario preservados;
9. cero rechazos no explicados;
10. revisión humana de traducciones y metadata sin destino de dominio;
11. base `piccolo_test_*` aislada y backup restaurable;
12. checksum, nombre de base y backup ID confirmados.

Este gate no autoriza usar `--apply` con el backup real.

## Resultado de validación de esta entrega

### Backup real: inspect

`hercules:inspect` terminó con código 0:

- 14 tablas;
- 980 documentos;
- 26 categorías;
- 195 productos;
- 262 archivos físicos;
- 262 assets lógicos, todos con estado `ready`;
- 8 locales;
- 0 errores y 0 rechazos;
- 0 `UNKNOWN_DOCUMENT_FIELD` para los 17 campos auditados.

### Backup real: dry-run

`hercules:import --dry-run`, sin `DATABASE_URL`, terminó con código 0:

| Acción | Conteo |
| --- | ---: |
| `create` | 415 |
| `update` | 0 |
| `skip` | 110 |
| `reject` | 0 |

Los 110 `skip` corresponden a 101 assets huérfanos o propuestos para
deduplicación y 9 tablas auxiliares/desconocidas. No representan registros
válidos rechazados.

### Datos preservados

- branding: 1 documento, nombre/eslogan base, hero, colores, fuentes y metadata;
- horarios: 7 días, 2 cerrados, 10 periodos, 0 cruces de medianoche reales;
- disponibilidad: 7 productos y 2 categorías inactivos preservados;
- medias raciones: 31 precios exactos;
- cantidades: 46 strings preservados en metadata;
- multimedia: 172 imágenes principales, 2 vídeos y 1 hero; 175 referencias
  resueltas;
- storage: 87 archivos históricos no referenciados y 37 duplicados por SHA-256.

### Traducciones

La versión anterior informaba 111 traducciones incompletas. Al reconocer
`restaurantName` como nombre base de branding:

- 1 ausencia estructural de `es` queda resuelta como `baseFallback`;
- permanecen 110 traducciones realmente ausentes;
- no hay traducciones vacías en el backup real;
- 353 nombres coinciden con el idioma base y quedan señalados para revisión;
- no hay locales desconocidos ni contenido inventado.

### Comprobaciones

| Comprobación | Resultado |
| --- | --- |
| `npm ci` | Correcto; informa 4 vulnerabilidades existentes |
| Typecheck | Correcto |
| Lint | Correcto |
| Build | Correcto |
| Tests del importador | 27/27 |
| Suite unitaria completa | 30/30 |
| Integración PostgreSQL | 12/12 en `piccolo_test_import` |
| E2E existente | 12/12 en una DB local E2E aislada |

La integración ejecuta `apply` únicamente con fixtures sintéticos sanitizados.
No se ejecutó `apply` con el backup real.
