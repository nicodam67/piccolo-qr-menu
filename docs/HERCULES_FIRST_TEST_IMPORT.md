# Primera importación real en base de pruebas

Entrega 5 — importación controlada del backup Hercules en `piccolo_test_import`.

## Alcance

- **Base:** `piccolo_test_import` (PostgreSQL local aislada, recreada desde cero).
- **Backup:** release `hercules-backup-audit-v1`, archivo `Qrmenu.todo.el.programa.zip`.
- **SHA-256:** `fab06511412671cd2394e8b44993c82d913cbb73f715b81579b57494f13812a8`.
- **Commit base:** `5c20542470662c5b58f3903d7e88e34a4de011a0`.
- **Comando:** `hercules:import --apply` con las cinco barreras de seguridad del importador.

## Lo que NO se hizo

- No se escribió en producción, Convex, Vercel ni TPV.
- No se importaron usuarios ni credenciales.
- No se copiaron binarios a storage externo (`No se copiaron binarios a storage`).
- No se modificó la interfaz ni `main` (solo documentación en esta rama).

## Preparación de la base

| Comprobación | Resultado |
| --- | --- |
| Base recreada | `piccolo_test_import` |
| Migraciones | Aplicadas correctamente |
| Tablas | 25 |
| Índices | 70 |
| Constraints | 265 |

## Primer apply

| Campo | Valor |
| --- | --- |
| `import_run` | `b7a43fde-9b59-49fb-9cda-9f25241d4e36` |
| Plan | `create=415`, `update=0`, `skip=110`, `reject=0` |
| Código de salida | 0 |

### Entidades persistidas

| Entidad | Conteo |
| --- | ---: |
| Categorías | 26 |
| Productos | 195 |
| Locales | 8 |
| Assets referenciados | 161 |
| Tags | 11 |
| Alérgenos | 12 |
| `restaurant_settings` | 1 |
| `restaurant_branding` | 1 |
| `opening_hours` (días) | 7 |
| `external_entity_mappings` | 407 |
| `product_translations` | 1469 |
| `category_translations` | 196 |

### Assets (262 en backup → 161 importados)

El backup contiene **262** entradas `_storage`. El plan importa **161** assets
referenciados o deduplicados por SHA-256. Los **101** restantes se omiten de forma
deliberada (64 huérfanos + 37 duplicados por contenido). No se pierden referencias
activas: las **175** referencias multimedia del manifest quedan resueltas.

### Multimedia

| Tipo | Conteo |
| --- | ---: |
| Productos con imagen principal (`primary_image_asset_id`) | 172 |
| Vídeos (`product_assets.role = video`) | 2 |
| Hero (`restaurant_branding.hero_asset_id`) | 1 |

### Branding y horarios

- Nombre base `es` importado; colores `#5c1f1f` / `#c8963e`; hero vinculado.
- Horarios: **7 días**, **10 periodos** (5 días × 2 periodos), **2 cierres**
  (martes y miércoles).
- Sin excepciones en `opening_hour_exceptions`.

### Disponibilidad, precios y metadata

| Campo | Conteo |
| --- | ---: |
| Productos inactivos | 7 |
| Categorías inactivas | 2 |
| Medias raciones (`half_price_cents`) | 31 |
| Cantidades en metadata de mappings | 46 |

### Traducciones

- **8** locales activos en `locales`.
- Traducciones de producto y categoría importadas donde existían en origen.
- Las **110** ausencias reales del dry-run no se inventan; solo se persisten
  traducciones presentes o resueltas por reglas del importador.

## Integridad

| Comprobación | Resultado |
| --- | --- |
| Productos sin categoría | 0 |
| Violaciones FK producto→categoría | 0 |
| Mappings duplicados (`entity_type`, `external_id`) | 0 |
| UUID deterministas en mappings | Sí (`external_entity_mappings`) |

## Segundo apply (idempotencia)

| Campo | Valor |
| --- | --- |
| `import_run` | `654b0dec-15d5-46ca-ac82-c4be4103972f` |
| Plan | `create=0`, `update=0`, `skip=525`, `reject=0` |
| Conteos tras segundo apply | Sin duplicados (26 cat., 195 prod., 161 assets) |

## Comprobaciones de código

| Comprobación | Resultado |
| --- | --- |
| `npm ci` | Correcto |
| Typecheck | Correcto |
| Lint | Correcto |
| Build | Correcto |
| Tests importador | 27/27 |
| Unitarias | 30/30 |
| Integración PostgreSQL | 12/12 |
| E2E Playwright | 12/12 |

## Próximo paso

Evaluar copia de binarios a storage y visualización en la carta pública antes de
cualquier ensayo fuera de `piccolo_test_*`.
