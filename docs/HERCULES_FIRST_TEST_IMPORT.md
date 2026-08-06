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
- No se modificó la interfaz ni código funcional del importador.

## Preparación de la base

| Comprobación | Resultado |
| --- | --- |
| Base recreada | `piccolo_test_import` |
| Nombre validado | Solo `piccolo_test_*`; nunca producción |
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
| Assets canónicos | 161 |
| Tags | 11 |
| Alérgenos | 12 |
| `restaurant_settings` | 1 |
| `restaurant_branding` | 1 |
| `opening_hours` (días) | 7 |
| `external_entity_mappings` | 407 |
| `product_translations` | 1469 |
| `category_translations` | 196 |

### Disponibilidad, precios y metadata

| Campo | Conteo |
| --- | ---: |
| Productos inactivos | 7 |
| Categorías inactivas | 2 |
| Medias raciones (`half_price_cents`) | 31 |
| Cantidades en metadata de mappings | 46 |

### Multimedia activa

| Tipo | Conteo |
| --- | ---: |
| Referencias resueltas en manifest | 175 |
| Productos con imagen principal | 172 |
| Vídeos | 2 |
| Hero | 1 |

### Branding y horarios

- Nombre base `es`, colores y hero vinculado en `restaurant_branding`.
- Horarios: **7 días**, **10 periodos** (5 días × 2 periodos), **2 cierres**
  (martes y miércoles).
- Sin excepciones en `opening_hour_exceptions`.

### Traducciones

- **8** locales en `locales`.
- **1469** `product_translations` donde existían en origen.
- Las **110** ausencias reales del dry-run no se inventan.

## Assets: 262 en backup → 161 en PostgreSQL

| Destino | Conteo | Motivo |
| --- | ---: | --- |
| Canónicos persistidos | 161 | Referenciados por catálogo o branding |
| Huérfanos omitidos | 64 | Sin referencia en productos ni branding |
| Duplicados omitidos | 37 | Mismo SHA-256 que un canónico ya elegido |
| **Total en backup** | **262** | Sin borrado del ZIP inmutable |

### Política final de assets

1. PostgreSQL importa **solo assets referenciados** (161 canónicos).
2. Los **64 huérfanos** permanecen en el backup original; no se borran binarios.
3. Los **37 duplicados** se deduplican por SHA-256; las referencias apuntan al
   canónico elegido.
4. La futura migración de storage podrá copiar únicamente los **161** canónicos.
5. Ningún asset activo (logo, hero, icono, imagen principal, galería, vídeo) fue
   omitido.

## Informe sanitizado: 64 huérfanos

Análisis agregado sobre el manifest del primer apply (sin nombres de producto ni
URLs firmadas).

| Métrica | Valor |
| --- | --- |
| Total omitidos | 64 |
| Tamaño agregado | 34,73 MB |
| Con referencia activa (primary/hero/video/etc.) | **0** |
| Referenciados en productos o branding | **0** |
| Referenciados en tablas auxiliares | **0** |

### Por tipo MIME

| MIME | Conteo |
| --- | ---: |
| `image/jpeg` | 51 |
| `image/png` | 10 |
| `image/webp` | 2 |
| `video/mp4` | 1 |

### Dimensiones más frecuentes (cuando existen)

| Dimensión | Conteo |
| --- | ---: |
| 447×447 | 5 |
| 480×639 | 4 |
| 6016×2776 | 2 |
| 1448×1086 | 2 |
| 1000×1500 | 2 |

**Conclusión:** los 64 huérfanos parecen archivos históricos o reemplazados sin
enlace en el catálogo actual. Se recomienda **conservarlos en el backup
inmutable** como archivo histórico, sin importarlos a PostgreSQL ni descartarlos
del ZIP.

## Informe sanitizado: 37 duplicados (29 grupos SHA-256)

| Métrica | Valor |
| --- | --- |
| Entradas omitidas por deduplicación | 37 |
| Grupos SHA-256 distintos | 29 |
| Espacio redundante evitado (aprox.) | 13,25 MB |

### Grupos con mayor ahorro

| Canónico (prefijo) | Copias omitidas | Ahorro aprox. | MIME |
| --- | ---: | ---: | --- |
| `kg20gmpn…` | 3 | 5,58 MB | image/png |
| `kg214xqa…` | 1 | 3,16 MB | video/mp4 |
| `kg23x2g6…` | 1 | 2,46 MB | image/png |
| `kg29p212…` | 1 | 2,00 MB | image/png |
| `kg21whtg…` | 2 | 0,05 MB | image/jpeg |

En cada grupo, el importador elige un asset canónico y redirige las referencias
al mismo UUID determinista. Los binarios duplicados permanecen en el backup; solo
se omite su fila redundante en PostgreSQL.

## Integridad

| Comprobación | Resultado |
| --- | --- |
| Productos sin categoría | 0 |
| Violaciones FK producto→categoría | 0 |
| Mappings duplicados (`entity_type`, `external_id`) | 0 |
| UUID deterministas | Sí (`external_entity_mappings`) |
| `import_runs` registrados | 2 (primer y segundo apply) |
| Escrituras fuera de `piccolo_test_import` | Ninguna |

## Segundo apply (idempotencia)

| Campo | Valor |
| --- | --- |
| `import_run` | `654b0dec-15d5-46ca-ac82-c4be4103972f` |
| Plan | `create=0`, `update=0`, `skip=525`, `reject=0` |
| Conteos tras segundo apply | Sin duplicados (26 cat., 195 prod., 161 assets) |

El segundo apply no alteró datos de dominio; todos los ítems existentes
produjeron `skip` con mappings estables.

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
| `npm audit --omit=dev` | 3 vulnerabilidades preexistentes (next, postcss, sharp) |

## Próximo paso (no iniciado en esta entrega)

- Migración de binarios a storage definitivo (solo 161 canónicos).
- Visualización en carta pública.
- Cualquier ensayo fuera de `piccolo_test_*` requiere autorización explícita.
