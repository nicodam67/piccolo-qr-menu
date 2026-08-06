# Importador seguro de snapshots Hercules/Convex

## Alcance y prohibiciones

Este módulo implementa la Entrega 2 del plan de consolidación. Lee un snapshot
oficial Convex, inventaría y valida su contenido, construye mappings
deterministas, genera un plan y permite ensayar el plan únicamente en una base
PostgreSQL de test.

No se conecta a Convex, no usa credenciales Hercules, no modifica el ZIP, no
extrae archivos en el repositorio, no copia binarios a storage definitivo, no
crea administradores y no cambia la interfaz. Está terminantemente prohibido
usarlo contra producción.

## Formato soportado

El lector sigue el formato oficial documentado por Convex:

```text
<table>/documents.jsonl
_storage/documents.jsonl
_storage/<storage-id>
_storage/<storage-id>.<ext>       # variante observada en el export real
generated_schema.jsonl       # metadata opcional; no es una tabla
```

Cada línea de `documents.jsonl` debe ser un objeto JSON. Se preservan `_id` y
`_creationTime`. El lector acepta el ZIP directamente y procesa cada entrada
sin extraerla. Rechaza rutas absolutas, `..`, backslashes, enlaces simbólicos,
entradas repetidas, tamaños excesivos y ratios de compresión sospechosos.
Cuando el export añade una extensión al binario, el lector la separa únicamente
si el prefijo coincide de forma no ambigua con un `_storage._id`. El nombre
físico se conserva en el manifiesto.

Los tipos Convex especiales descritos por `generated_schema.jsonl` se
inventarían como metadata, pero esta versión solo transforma valores JSON que
los adaptadores pueden validar expresamente. No realiza conversiones
silenciosas.

## Tablas y clasificación

| Tabla | Clasificación | Comportamiento |
| --- | --- | --- |
| `categories` | soportada | Categorías y traducciones |
| `menuItems` | soportada | Productos, precios, relaciones y assets |
| `branding` | soportada | Restaurante, traducciones, branding y enlaces |
| `users` | soportada para inventario | Nunca crea admins ni importa credenciales |
| `_storage` | soportada | Metadata, hashes y binarios; no copia storage |
| Otras tablas `_...` | auxiliar | Inventariada y omitida |
| Cualquier otra | desconocida | Inventariada y omitida sin adaptador |

Una tabla adicional nunca se ignora: aparece en el manifiesto, el informe y el
plan con `skip`.

## Arquitectura

`src/features/hercules-import/` está aislado de las rutas y componentes:

- `zip-reader.ts`: apertura segura y streaming de entradas ZIP;
- `jsonl.ts`: decodificación UTF-8 y parsing JSONL;
- `mime.ts`: MIME por firma binaria y dimensiones cuando son verificables;
- `security.ts`: detección, rechazo y omisión de claves sensibles;
- `normalizers.ts`: adaptadores de las tablas conocidas;
- `manifest.ts`: inventario de tablas, documentos y assets;
- `planner.ts`: mappings y acciones ordenadas;
- `database.ts`: comparación read-only y apply transaccional de test;
- `reports.ts`: salidas JSON y Markdown deterministas;
- `service.ts`: orquestación sin persistencia;
- `cli.ts`: comandos.

## Comandos

### Inspección

```bash
npm run hercules:inspect -- --input /ruta/snapshot.zip
```

El directorio predeterminado es
`/ruta/snapshot.hercules-report`. Puede elegirse otro:

```bash
npm run hercules:inspect -- \
  --input /ruta/snapshot.zip \
  --output-dir /ruta/reporte
```

### Dry-run

Dry-run es el modo predeterminado; `--dry-run` puede dejarse explícito:

```bash
npm run hercules:import -- \
  --input /ruta/snapshot.zip \
  --dry-run \
  --output-dir /ruta/reporte
```

Sin `--database-url` no abre PostgreSQL. Con una DB de test compara mappings sin
escribir:

```bash
npm run hercules:import -- \
  --input /ruta/snapshot.zip \
  --database-url postgresql://usuario:clave@localhost:5432/piccolo_test_import \
  --output-dir /ruta/reporte
```

Solo `--record-run` registra opcionalmente el resultado dry-run en
`import_runs`; requiere `--database-url`. No modifica datos de dominio.

### Validación PostgreSQL read-only

```bash
npm run hercules:validate-db -- \
  --input /ruta/snapshot.zip \
  --database-url postgresql://usuario:clave@localhost:5432/piccolo_test_import \
  --output-dir /ruta/reporte
```

La base debe empezar por `piccolo_test_`. El comando no crea `import_runs` y no
escribe.

### Apply de test

`apply` existe exclusivamente para fixtures y ensayos aislados:

```bash
npm run hercules:import -- \
  --input /ruta/snapshot-sintetico.zip \
  --apply \
  --database-url postgresql://usuario:clave@localhost:5432/piccolo_test_import \
  --confirm-database-name piccolo_test_import \
  --confirm-source-checksum <sha256-del-zip> \
  --confirm-backup-id <id-del-backup-previo-de-test> \
  --output-dir /ruta/reporte
```

Las cinco barreras son obligatorias:

1. `NODE_ENV` no puede ser `production`;
2. el nombre real debe empezar por `piccolo_test_`;
3. la confirmación debe coincidir exactamente con el nombre real;
4. el checksum debe coincidir antes del plan y justo antes de la transacción;
5. debe identificarse el backup previo de test.

Nombres con `prod`, `production`, `live` o `real` se rechazan. No se registra ni
imprime `DATABASE_URL`. Un plan con errores o rechazos no puede aplicarse.

## Transformaciones

### Categorías

Se preservan `_id`, `_creationTime`, orden, visibilidad/actividad, estado,
referencias externas, nombres y descripciones por locale. Se rechazan IDs
duplicados, orden negativo/no entero, ausencia de nombre, locales desconocidos
y padres inexistentes. Un nombre repetido en el mismo locale genera warning.

### Productos

Se preservan categoría, traducciones, precio completo, media ración,
disponibilidad, agotado, orden, tags, alérgenos, imagen principal, galería,
vídeos y flags conocidos. Los precios decimales aceptan como máximo dos
decimales y se convierten exactamente a céntimos; los campos `*Cents` deben ser
enteros. Se rechazan categorías inexistentes, precios ambiguos, media ración
incoherente, locales desconocidos y referencias obligatorias ausentes.

La forma real `halfPortionPrice` se trata como precio de media ración,
`videoStorageId` como vídeo singular ordenado y `quantity` se preserva en la
metadata del mapping porque todavía no existe una columna de cantidad/unidad.
Los estados activo, visible, disponible, oculto, archivado y agotado se
mantienen separados; su precedencia está documentada en
`HERCULES_REAL_BACKUP_COMPATIBILITY.md`.

Tags y alérgenos observados dentro de productos se planifican como relaciones
N:M. No se inventan traducciones adicionales: el literal de origen solo se
conserva en `es`.

### Branding

Se transforma a `restaurant_settings`, `restaurant_translations`,
`restaurant_branding`, `restaurant_links` y relaciones de assets. Teléfono y
dirección son obligatorios para apply. Colores y fuentes permanecen
estructurados; nunca se acepta CSS arbitrario.

También se adaptan los aliases reales `restaurantName`, `tagline`,
`heroImageStorageId`, `themeColors`, `themeFonts`, `cardSettings`, componentes
de dirección y `schedule`. El horario estructurado admite cierres, dos periodos
y cruces de medianoche; el texto libre `hours` solo se preserva como metadata.

### Usuarios

Solo se conservan en `validation-report.json` el email, `_id`,
`_creationTime` y metadata no sensible. Passwords, hashes, tokens, sesiones,
cookies, claves API, secretos y equivalentes anidados se omiten. Cada usuario
queda en `skip` con intervención humana obligatoria. No se crea ningún admin.

## Seguridad de datos y logs

Se detectan claves equivalentes a:

- `password`, `passwordHash`;
- `token`, `refreshToken`, `accessToken`;
- `secret`, `apiKey`, `privateKey`;
- `cookie`, `authorization`;
- credenciales y sesiones.

En entidades importables producen error y rechazo. En usuarios se omiten y se
genera warning. La validación reutiliza la política de
`src/db/audit-safety.ts`. Los informes nunca incluyen payloads completos ni
valores secretos; los errores JSONL indican solo tabla y número de línea.

## Mappings e idempotencia

Los IDs Convex nunca son PK PostgreSQL. El UUID propuesto es UUID v5
determinista sobre `tipo:_id` dentro de un namespace fijo. Al consultar una DB:

1. se busca `(hercules_convex, entity_type, external_id)`;
2. se reutiliza siempre su `internal_id`;
3. se compara el hash SHA-256 del payload canónico;
4. mismo hash produce `skip`;
5. hash distinto produce `update`;
6. ausencia produce `create`;
7. una asociación conflictiva aborta la transacción.

Las restricciones únicas de `external_entity_mappings` evitan mappings
duplicados. Repetir el mismo snapshot genera el mismo plan y los mismos UUID.
El segundo apply sintético conserva una fila por entidad y actualiza únicamente
la trazabilidad del run para elementos sin cambios.

## Assets

Cada binario se recorre para calcular byte size, SHA-256 y MIME por firma, no
por extensión. Cuando es verificable se obtienen ancho/alto; duración queda
`null` si el contenedor no permite determinarla de forma segura sin un
decodificador multimedia.

Un storage ID produce una sola entrada lógica aunque el nombre físico tenga
extensión o sea referenciado desde varias entidades/roles. `references`
conserva cada uso con rol y orden; `referencedBy` mantiene dependencias únicas.
El hash declarado se valida tanto en hexadecimal como en Base64.

`manifest.json` incluye:

- `storageId`, nombre original, MIME, tamaño y SHA-256;
- ancho, alto y duración;
- referencias inversas y condición de huérfano;
- `duplicateOf` por SHA-256;
- key e ID propuestos;
- estado.

Una referencia sin binario es error. Un binario sin metadata y un asset
huérfano quedan explícitos. Dos contenidos iguales solo generan una propuesta
de deduplicación; nada se elimina. Apply crea únicamente metadata `pending` con
provider `hercules_pending`; nunca copia el binario ni lo marca disponible.

## Informes

Cada ejecución genera con permisos restrictivos y escritura atómica:

- `manifest.json`;
- `import-plan.json`;
- `validation-report.json`;
- `REPORT.md`.

Las salidas son deterministas: no contienen timestamps de ejecución ni rutas
absolutas. `create`, `update`, `skip` y `reject` muestran razón, warnings,
dependencias y orden. Un warning exige revisión, pero no siempre bloquea. Un
error vuelve inválido el informe y bloquea apply.

Para verificar conteos, comparar `manifest.totals`, la tabla `tables` y los
contadores del plan. Después de apply de test, confirmar conteos y unicidad de
`external_entity_mappings`; ejecutar por segunda vez y exigir cero `create`,
cero duplicados y solo `skip`/`update` justificados.

## Errores frecuentes

- `JSONL_INVALID_DOCUMENT`: línea no parseable o no-objeto;
- `UNKNOWN_DOCUMENT_FIELD`: campo observado sin transformación;
- `UNKNOWN_TABLE`: falta adaptador explícito;
- `DUPLICATE_EXTERNAL_ID`: `_id` repetido;
- `UNKNOWN_LOCALE` / `MISSING_TRANSLATION`: matriz de traducciones;
- `EMPTY_TRANSLATION` / `TRANSLATION_EQUALS_BASE`: contenido vacío o igual al
  locale base;
- `HOURS_SCHEDULE_REVIEW`: coexisten horario de texto y horario estructurado;
  se preservan ambos y `schedule` requiere aprobación;
- `INVALID_PRICE` / `INVALID_HALF_PORTION`: precio ambiguo;
- `PRODUCT_CATEGORY_NOT_FOUND` / `ORPHAN_CATEGORY`: relación inválida;
- `STORAGE_BINARY_MISSING`: referencia o metadata sin binario;
- `STORAGE_*_MISMATCH`: tamaño, MIME o checksum discrepante;
- `SENSITIVE_FIELD`: dato que no puede importarse ni reportarse.

## Rollback

Un fallo durante apply revierte toda la transacción de dominio y marca el run
como `failed` con un error sanitizado. Para un ensayo completado, el rollback
es restaurar el backup de la DB temporal o eliminar y recrear
`piccolo_test_import`; no existe borrado selectivo autorizado para datos
reales. Antes de cualquier futura importación productiva harán falta runbook,
backup restaurable, aprobación humana y una entrega específica. Esta versión
no autoriza ni implementa ese paso.

Los snapshots, JSONL y resultados generados están excluidos por `.gitignore`.
Los tests crean ZIP pequeños y sintéticos en el directorio temporal del sistema;
el repositorio no contiene backups ni datos reales.
