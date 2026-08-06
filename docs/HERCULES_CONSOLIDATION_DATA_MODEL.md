# Modelo de datos para la consolidación de Hercules — Entrega 1

## Alcance

Esta entrega prepara exclusivamente persistencia PostgreSQL, migraciones,
repositorios técnicos mínimos y pruebas. No importa backups, no mueve binarios,
no sincroniza el TPV y no cambia rutas, autenticación ni interfaz.

El diseño parte del plan
`docs/HERCULES_CONSOLIDATION_MASTER_PLAN.md`. PostgreSQL es la base del QR Menu,
Hercules/Convex es una fuente histórica de una sola dirección y el TPV será la
autoridad futura de los campos de catálogo acordados.

## Inventario anterior

| Tabla | Clave primaria | Relaciones y campos reutilizados |
| --- | --- | --- |
| `restaurant_settings` | UUID `id` | Teléfono, dirección, zona horaria, moneda, locale predeterminado y URL hero heredada |
| `restaurant_translations` | (`restaurant_id`, `locale`) | Nombre comercial, eslogan y descripción traducibles |
| `opening_hours` | UUID `id` | Semana habitual, cierre y dos franjas; un registro por restaurante y día |
| `categories` | UUID `id` | Orden, visibilidad y timestamps |
| `category_translations` | (`category_id`, `locale`) | Nombre y descripción |
| `products` | UUID `id` | Categoría, precios en céntimos, visibilidad, agotado, orden, URL de imagen heredada y timestamps |
| `product_translations` | (`product_id`, `locale`) | Nombre y descripción |
| `tags` | UUID `id` | Color |
| `tag_translations` | (`tag_id`, `locale`) | Nombre |
| `product_tags` | (`product_id`, `tag_id`) | Relación muchos a muchos |
| `allergens` | UUID `id` | Código único e icono |
| `allergen_translations` | (`allergen_id`, `locale`) | Nombre |
| `product_allergens` | (`product_id`, `allergen_id`) | Relación muchos a muchos |
| `admins` | UUID `id` | Cuenta local, hash Argon2id, activación y versión de sesión |
| `admin_login_attempts` | UUID `id` | Rate limit persistido; email/IP únicos |

Las relaciones de dominio ya usaban claves foráneas con `cascade`, `restrict` o
índices según su ciclo de vida. Categorías y productos se administraban mediante
transacciones y advisory locks. Las traducciones ya estaban normalizadas y no se
reemplazan.

Faltaban para Hercules: catálogo persistente de locales, mappings Convex→UUID,
metadatos y relaciones de assets, branding estructurado, excepciones de horario,
runs de importación y auditoría.

Faltaban para TPV: mapping TPV→UUID, autoridad y estado por entidad, baja lógica,
versión/fecha de sincronización y runs de sincronización.

Riesgos de compatibilidad detectados:

- `products.image_url` y `restaurant_settings.hero_image_url` son obligatorios y
  siguen siendo leídos por la interfaz actual;
- los repositorios existentes obtenían locales desde
  `restaurant_translations`;
- añadir columnas obligatorias sin default rompería inserts actuales;
- convertir IDs externos en PK dañaría relaciones y repetibilidad;
- una FK genérica desde mappings no puede apuntar con integridad real a varias
  tablas;
- imponer enums PostgreSQL cerrados dificultaría nuevas fuentes y estados.

Por ello se conservan todos los campos y consultas existentes. Las nuevas
columnas obligatorias de catálogo tienen defaults compatibles y no participan
todavía en las lecturas públicas.

## Diagrama textual

```text
locales(code)
  ├─< restaurant_settings.default_locale
  ├─< restaurant_translations.locale
  ├─< category_translations.locale
  ├─< product_translations.locale
  ├─< tag_translations.locale
  └─< allergen_translations.locale

restaurant_settings
  ├─1 restaurant_branding ─> assets (logo, hero, icon)
  ├─< restaurant_links
  ├─< opening_hours
  ├─< opening_hour_exceptions
  └─< restaurant_translations

categories
  ├─< category_translations
  └─< products
       ├─< product_translations
       ├─< product_tags >─ tags ─< tag_translations
       ├─< product_allergens >─ allergens ─< allergen_translations
       ├─> assets (primary_image_asset_id)
       └─< product_assets >─ assets (gallery, video, document)

admins ─< import_runs
import_runs ─< external_entity_mappings >─ internal UUID (validated in service)
sync_runs   ─< external_entity_mappings >─ internal UUID (validated in service)

audit_log (actor/entity references are intentionally polymorphic)
```

## Tablas nuevas

### `locales`

Fuente persistente de idiomas soportados. Usa UUID interno, código único,
nombres administrativo/nativo, activación, default, orden y timestamps.

- unique `code`;
- unique parcial sobre `is_default = true`, que impide dos defaults;
- índice `(is_enabled, sort_order)`;
- check de código BCP 47 corto y orden no negativo;
- FKs desde todos los locales actuales con update en cascada y borrado
  restringido.

La migración crea registros únicamente para códigos ya observados en el schema
anterior y conserva el `default_locale` existente. No incorpora contenido
Hercules. La capa de administración futura deberá hacer atómica la transición
de default para que siempre haya exactamente uno; PostgreSQL garantiza que no
haya más de uno.

### `external_entity_mappings`

Correspondencia idempotente entre `(source, entity_type, external_id)` y UUID
interno. También conserva parent externo, metadata no sensible, fechas de
origen, hash de payload y último run import/sync.

La metadata puede preservar campos de origen sin columna operacional —por
ejemplo `quantity`, variantes visuales de Hercules o el `internalId` de
`_storage`— únicamente para trazabilidad y evitar pérdida silenciosa. No se usa
como modelo de lectura de la aplicación ni sustituye las columnas normalizadas.

- unique `(source, entity_type, external_id)`;
- unique `(source, entity_type, internal_id)`, evitando dos IDs de una misma
  fuente para una entidad interna;
- índice por `internal_id` y por cada run;
- checks de fuente, nombre extensible de tipo y SHA-256.

No existe FK sobre `internal_id`: una FK polimórfica sería falsa seguridad. El
repositorio `src/db/repositories/external-entity-mappings.ts` usa una lista
cerrada de tipos, resuelve la tabla/columna correspondiente, confirma la entidad
en la misma transacción y serializa cada clave externa con advisory lock. Repetir
el mismo mapping actualiza trazabilidad sin duplicarlo; intentar reasociarlo a
otro UUID falla.

### `assets`

Inventario de imágenes, vídeos, documentos e iconos. Guarda proveedor, clave
estable, URL pública opcional, nombre original, MIME, tamaño, SHA-256,
dimensiones/duración opcionales, alt, estado y referencia externa opcional.

- unique `(storage_provider, storage_key)`;
- unique parcial `(external_source, external_id)`;
- índices por SHA-256 y `(kind, status)`;
- checks de tipo, estado, checksum, tamaño, dimensiones, duración y pareja de
  referencia externa.

No contiene binarios ni credenciales. `public_url` nunca sustituye
`storage_key`. La subida, validación MIME real y proveedor se implementarán en
una entrega posterior.

### `product_assets`

Relación ordenada de producto con assets para galería, vídeo y documentos.
La imagen principal usa además `products.primary_image_asset_id` para consulta
directa.

- unique `(product_id, asset_id, role)`;
- unique `(product_id, role, sort_order)`;
- índice inverso por asset;
- borrado de producto en cascada y borrado de asset restringido.

### `restaurant_branding` y `restaurant_links`

`restaurant_branding` es uno a uno con `restaurant_settings` y conserva logo,
hero, icono, colores, fuentes, estado y timestamps. Los tres assets pasan a
`NULL` si se archiva/elimina su metadato, sin eliminar el restaurante.

`restaurant_links` normaliza enlaces relevantes por tipo, etiqueta, URL, orden
y estado. Se descartó un JSONB opaco para enlaces porque son dominio
administrable y requieren orden, unicidad e índices.

Nombre, eslogan y descripción permanecen en `restaurant_translations`.
Teléfono y dirección permanecen en `restaurant_settings`. Las URLs hero
heredadas continúan como fallback hasta que la interfaz migre a assets.

El `schedule` real de Hercules se normaliza en `opening_hours`: un registro por
día, cierre explícito y hasta dos periodos. Un cierre anterior a la apertura
representa cruce de medianoche; no se generan excepciones desde textos libres.

### `opening_hour_exceptions`

Excepciones con rango local inclusivo, tipo (`closure`, `special_opening`,
`holiday`), cierre, dos franjas, motivo, prioridad y timestamps.

- unique `(restaurant_id, starts_on, ends_on, priority)`;
- índice de lookup por restaurante/rango/prioridad;
- checks de rango, combinación de cierre y periodos completos.

Una hora de cierre menor o igual que la apertura representa final después de
medianoche, igual que en el horario semanal existente. Si coinciden varias
excepciones, vence la prioridad mayor; a igualdad, la capa de servicio deberá
rechazar la ambigüedad antes de insertar (la igualdad exacta ya es unique).

### `import_runs`

Registra fuente, tipo, estado, inicio/fin, checksum/nombre de snapshot,
contadores, warnings y errores sanitizados, administrador iniciador y run
revertido. Tiene FKs a `admins` y a sí misma, índices por
`(source, status, started_at)` y checksum, y checks de estado, tipo, SHA-256 y
cronología.

JSONB se limita a conteos y diagnósticos estructurados; no almacena documentos
Convex ni payloads completos.

### `sync_runs`

Reserva el flujo unidireccional `tpv_to_qr`: sistema, estado,
cursor/checkpoint, cinco contadores, tiempos, errores sanitizados y timestamps.
Los checks evitan contadores negativos y final anterior al inicio. No define
polling, webhook, SDK ni credenciales.

### `audit_log`

Evento append-only de actor, acción, entidad, fuente, before/after/metadata y
fecha. Índices:

- `(entity_type, entity_id)`;
- `created_at`;
- `(actor_type, actor_id)`;
- `source`.

Los IDs de actor/entidad son polimórficos y no fingen una FK genérica. El
repositorio `src/db/repositories/audit-log.ts` rechaza claves sensibles
(`password`, hashes, token, secret, cookie, authorization, API keys o
credenciales), incluso anidadas. La misma protección se aplica a metadata de
mappings. La futura capa de import/sync debe sanitizar también warnings/errors y
guardar códigos/resúmenes, nunca payloads.

## Tablas modificadas

`categories` y `products` añaden:

- `catalog_source`: procedencia inicial (`manual`, `hercules_convex`,
  `piccolo_tpv`, `legacy`);
- `managed_by`: autoridad operativa (`qr_admin`, `tpv`, `imported`);
- `last_synced_at`;
- `sync_version`;
- `sync_status`: `not_synced`, `pending`, `synced`, `conflict` o `failed`;
- `archived_at` para baja lógica.

Ambas tienen índice `(catalog_source, sync_status)` y checks. Defaults
`manual`, `qr_admin`, `not_synced` preservan CRUD y comportamiento. `products`
añade `primary_image_asset_id`, FK nullable e indexada. `image_url` no cambia.

Las seis columnas locale existentes añaden FK a `locales.code`.

## Autoridad por campo

| Datos | Autoridad futura | Regla |
| --- | --- | --- |
| Identidad externa, existencia/baja, categoría base, precio y disponibilidad acordados | TPV | Mapping explícito; sync unidireccional; baja lógica |
| `catalog_source`, `managed_by`, sync version/status/date | Sistema import/sync | No editables como contenido |
| Orden público, traducciones adicionales, descripción editorial no ofrecida por TPV | QR Admin | No se sobrescriben por ausencia TPV |
| Tags y alérgenos | QR Admin hasta confirmar contrato TPV | Una sola autoridad por campo |
| Assets y sus relaciones | QR Admin/storage | TPV puede aportar referencia inicial, nunca URL efímera como autoridad |
| Branding, enlaces, teléfono, dirección, idiomas y horarios | QR Admin | Fuera del catálogo TPV |
| Credenciales y sesiones | Autenticación local | Nunca se importan desde Hercules |
| Datos Hercules | Histórico/importado | Solo bootstrap; pierden autoridad al mapear TPV o editar QR-only |

No se usa “última escritura gana”.

## Estrategia de idempotencia

1. Crear `import_runs` o `sync_runs`.
2. Resolver por unique `(source, entity_type, external_id)`.
3. Validar que `internal_id` existe para el tipo permitido.
4. Reutilizar siempre el UUID ya mapeado.
5. Comparar `payload_hash`; omitir si no cambió.
6. Actualizar último run y fechas de origen.
7. Escribir solo campos cuya autoridad corresponde a esa fuente.
8. Registrar resumen sanitizado en `audit_log`.

No se añaden `convex_id`/`tpv_id` repetidos en cada tabla.

## Migraciones y reversión

- `0003_misty_bullseye.sql`: tablas, columnas, checks, índices y backfill de
  locales observados;
- `0004_loose_joystick.sql`: FKs de locales una vez completado el backfill;
- `rollback/0003_0004_hercules_data_model.down.sql`: rollback manual para
  ensayo o despliegue aún sin datos de Entrega 1.

Drizzle no administra migraciones down automáticamente. El rollback elimina
estructuras nuevas y por tanto solo es seguro antes de escribir datos reales,
con backup y aprobación explícita. No forma parte de la secuencia forward de
Drizzle.

Para pruebas de integración se exige una base aislada cuyo nombre empiece por
`piccolo_test_`; el test se bloquea ante cualquier otro nombre. Variables:

```bash
DATABASE_URL=postgresql://<test-user>:<test-password>@localhost:5432/piccolo_test_data_model
```

## Decisiones descartadas

- Reutilizar IDs Convex/TPV como PK: rompe aislamiento e idempotencia.
- Columnas `convex_id` y `tpv_id` por tabla: duplican lógica y no escalan a
  assets/branding/horarios.
- FK genérica de mappings: PostgreSQL no puede garantizarla entre tablas.
- Segunda tabla de restaurante: duplicaría settings/traducciones existentes.
- JSONB para branding, enlaces o excepciones: ocultaría dominio consultable.
- Eliminar `image_url`/`hero_image_url`: rompería la interfaz actual.
- Enums PostgreSQL: los checks son explícitos pero más fáciles de ampliar con
  migraciones compatibles.
- Storage, importador o cliente TPV: fuera del alcance de esta entrega.

## Riesgos pendientes

- Entrega 0 aún debe confirmar snapshot, schema Hercules, ocho locales y
  contrato de aceptación antes de importar.
- El contrato TPV decidirá fuente, versión, cursor y autoridad final por campo.
- Falta aprobar proveedor de storage, política de retención y URLs públicas.
- La capa futura debe verificar MIME por contenido, checksum y límites de
  tamaño.
- La transición exacta entre `image_url` y assets debe ser compatible hasta que
  todas las lecturas usen la nueva relación.
- La captura completa de acciones administrativas y UI de auditoría sigue
  aplazada.
- La restricción “exactamente un locale default” requiere operación
  transaccional de servicio; la base garantiza “como máximo uno”.
