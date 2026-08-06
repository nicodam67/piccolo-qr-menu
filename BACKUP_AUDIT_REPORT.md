# Auditoría del backup real Convex/Hercules — Entrega 3

## Resultado ejecutivo

El backup real publicado en la Release `hercules-backup-audit-v1` se descargó
fuera del repositorio y se auditó sin extracción, sin importación y sin
escrituras de datos.

**Resultado: incompatible con el importador actual; el plan es inválido y
quedaría bloqueado antes de cualquier apply.**

La incompatibilidad principal es el nombre de los binarios de `_storage`: los
262 documentos usan el ID Convex sin extensión, mientras que los 262 archivos
del ZIP añaden una extensión (`.png`, `.jpeg`, `.webp` o `.mp4`). El importador
exige una coincidencia literal y por ello inventaría 524 assets lógicos:

- 262 metadatos marcados como `missing_binary`;
- 262 binarios marcados como `metadata_missing`;
- 0 coincidencias literales;
- 262 coincidencias al retirar únicamente la extensión.

Esto produce falsos faltantes y huérfanos aunque el ZIP contiene los 262
binarios.

## Identificación

| Dato | Resultado |
| --- | --- |
| Repositorio | `nicodam67/piccolo-qr-menu` |
| Rama base | `main` |
| Commit base | `21a43d4d4719f77f40290f12e682fb499da9b69f` |
| Rama de auditoría | `cursor/hercules-consolidation-delivery-3-real-backup-audit-13e2` |
| Diferencia respecto del nombre solicitado | El sufijo `-13e2` es obligatorio en el entorno del agente |
| Release | `hercules-backup-audit-v1` |
| Asset | `Qrmenu.todo.el.programa.zip` |
| Fecha de publicación | 2026-08-06 17:08:22 UTC |
| Tipo publicado | `application/zip` |

## Integridad del backup

| Comprobación | Resultado |
| --- | --- |
| Tamaño ZIP | 458,481,034 bytes |
| SHA-256 publicado | `fab06511412671cd2394e8b44993c82d913cbb73f715b81579b57494f13812a8` |
| SHA-256 calculado | `fab06511412671cd2394e8b44993c82d913cbb73f715b81579b57494f13812a8` |
| Coincidencia | Sí |
| Entradas ZIP | 289 |
| Prueba CRC de todas las entradas | Correcta, sin errores |
| Tamaño de binarios inventariados | 464,338,156 bytes |

El ZIP permaneció en `/tmp/hercules-backup-audit-v1/` y no se añadió a Git.
No se extrajo ni modificó.

### Estructura

```text
README.md
_tables/documents.jsonl
<12 tablas>/documents.jsonl
<12 tablas>/generated_schema.jsonl
_storage/documents.jsonl
_storage/<storage-id>.<ext>       # 262 binarios
```

`README.md` se inventaría como entrada no reconocida. Los
`generated_schema.jsonl` por tabla son metadata del export y no se cuentan como
tablas.

## Inventario de tablas

Se encontraron 14 tablas y 980 documentos. Todos los JSONL tienen cero líneas
inválidas y no hay IDs duplicados.

| Tabla | Clasificación del importador | Documentos | Resultado |
| --- | --- | ---: | --- |
| `_storage` | soportada | 262 | Incompatible por extensiones en binarios |
| `_tables` | auxiliar | 12 | Omitida; genera 12 `MISSING_EXTERNAL_ID` |
| `admins` | desconocida | 0 | Omitida |
| `authAccounts` | desconocida | 0 | Omitida |
| `authRateLimits` | desconocida | 0 | Omitida |
| `authRefreshTokens` | desconocida | 0 | Omitida |
| `authSessions` | desconocida | 0 | Omitida |
| `authVerificationCodes` | desconocida | 0 | Omitida |
| `authVerifiers` | desconocida | 0 | Omitida |
| `branding` | soportada | 1 | Rechazada por adaptación incompleta |
| `categories` | soportada | 26 | Planificadas |
| `importLog` | desconocida | 484 | Omitida |
| `menuItems` | soportada | 195 | Planificados con pérdidas potenciales |
| `users` | soportada solo para inventario | 0 | No importada |

Hay 8 tablas desconocidas. Solo `importLog` contiene datos (484 documentos);
las siete tablas desconocidas de autenticación están vacías.

## Entidades y relaciones

| Entidad o relación | Conteo |
| --- | ---: |
| Categorías | 26 |
| Categorías raíz | 20 |
| Relaciones categoría-padre | 6 |
| Productos | 195 |
| Relaciones producto-categoría | 195 |
| Categorías referenciadas por productos | 25 |
| Tags únicos | 11 |
| Relaciones producto-tag | 155 |
| Productos con tags | 99 |
| Alérgenos únicos | 12 |
| Relaciones producto-alérgeno | 413 |
| Productos con alérgenos | 126 |
| Branding | 1 |
| Usuarios | 0 |

No se detectaron categorías padre inexistentes, productos sin categoría,
locales desconocidos, IDs duplicados ni referencias de catálogo rotas. Las
referencias de assets sí quedan rotas en el modelo intermedio por la
incompatibilidad de nombres.

## Idiomas y traducciones

Se detectaron exactamente 8 locales soportados:

`ca`, `de`, `en`, `es`, `fr`, `it`, `nl`, `ro`.

### Cobertura por documento

| Entidad | `ca` | `de` | `en` | `es` | `fr` | `it` | `nl` | `ro` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Categorías (26) | 24 | 24 | 26 | 24 + 2 fallback | 24 | 24 | 24 | 24 |
| Productos (195) | 183 | 183 | 176 | 183 + 12 fallback | 183 | 183 | 183 | 183 |
| Branding (1) | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

El normalizador produciría 196 traducciones de categoría y 1,469 traducciones
de producto. Registra 111 advertencias de traducción faltante:

- branding: 8;
- categorías: 12;
- productos: 91.

Branding no contiene ninguna traducción reconocida y genera además
`REQUIRED_TRANSLATION_MISSING`, que rechaza tanto `restaurant` como `branding`.

## Assets y storage

### Inventario físico real

| MIME | Archivos | Bytes |
| --- | ---: | ---: |
| `image/png` | 186 | 421,192,235 |
| `image/jpeg` | 69 | 30,238,854 |
| `image/webp` | 2 | 29,718 |
| `video/mp4` | 5 | 12,877,349 |
| **Total** | **262** | **464,338,156** |

Hay 37 duplicados físicos por SHA-256. La salida del importador muestra 74
duplicados porque cuenta dos veces cada par metadata/binario desconectado.

### Referencias

| Referencia de origen | Conteo | Tratamiento actual |
| --- | ---: | --- |
| Imagen principal de producto | 172 | Detectada, pero el binario aparece ausente |
| Vídeo de producto (`videoStorageId`) | 2 | Campo no soportado; se perdería |
| Hero de branding (`heroImageStorageId`) | 1 | Campo no soportado; se perdería |
| Binarios sin referencia de contenido conocida | 87 | Archivo histórico |

El importador reporta:

- 262 `STORAGE_BINARY_MISSING`: 172 errores para assets referenciados y 90
  advertencias para metadatos no referenciados;
- 262 `STORAGE_METADATA_MISSING`;
- 352 assets “huérfanos” (262 binarios desacoplados + 90 metadatos no
  referenciados);
- 172 assets referenciados rechazados.

Estos conteos describen la incompatibilidad del lector, no una ausencia real de
los archivos.

## Campos no soportados

Se detectaron 17 rutas distintas y 357 ocurrencias:

| Tabla | Campo | Ocurrencias | Riesgo |
| --- | --- | ---: | --- |
| `_storage` | `internalId` | 262 | Metadata Convex descartada |
| `branding` | `cardSettings` | 1 | Configuración visual descartada |
| `branding` | `city` | 1 | Dirección incompleta |
| `branding` | `establishedYear` | 1 | Dato descartado |
| `branding` | `heroImageStorageId` | 1 | Hero no enlazado |
| `branding` | `hours` | 1 | Horarios no transformados |
| `branding` | `postalCode` | 1 | Dirección incompleta |
| `branding` | `province` | 1 | Dirección incompleta |
| `branding` | `restaurantName` | 1 | Causa ausencia de traducción/nombre |
| `branding` | `schedule` | 1 | Horarios no transformados |
| `branding` | `tagline` | 1 | Texto de marca descartado |
| `branding` | `themeColors` | 1 | Paleta descartada |
| `branding` | `themeFonts` | 1 | Tipografías descartadas |
| `categories` | `available` | 4 | Disponibilidad descartada |
| `menuItems` | `halfPortionPrice` | 31 | Precio de media ración descartado |
| `menuItems` | `quantity` | 46 | Cantidad/stock descartado |
| `menuItems` | `videoStorageId` | 2 | Vídeos no relacionados |

Los campos `halfPortionPrice`, `videoStorageId`, `restaurantName`,
`heroImageStorageId`, `themeColors`, `themeFonts`, `schedule` y `hours` tienen
equivalentes conceptuales en el modelo PostgreSQL o en el plan maestro, pero no
coinciden con los nombres que acepta el adaptador. La pérdida es del adaptador,
no una carencia general del esquema destino.

## Plan y mappings

El plan sin conexión a base contiene 787 items:

| Acción | Conteo |
| --- | ---: |
| `create` | 252 |
| `update` | 0 |
| `skip` | 361 |
| `reject` | 174 |

Los 252 `create` se desglosan en:

- 8 locales;
- 26 categorías;
- 195 productos;
- 11 tags;
- 12 alérgenos.

Los rechazos son 172 assets referenciados, 1 restaurante y 1 branding. Los
`skip` incluyen 352 assets considerados huérfanos, las 8 tablas desconocidas y
`_tables`.

Los IDs propuestos son deterministas. No se compararon con mappings
PostgreSQL existentes: `hercules:validate-db` solo acepta una base
`piccolo_test_*`, no existe `piccolo_test_import` en este entorno y crearla
habría escrito en PostgreSQL. Por tanto, `create/update/skip` no representan
una reconciliación con datos actuales, sino el plan base sin estado existente.

## Resultado de los comandos

### `hercules:inspect`

- completó la lectura: 980 documentos y 262 binarios;
- generó los cuatro informes en `/tmp`;
- devolvió código 2 porque `validation-report.valid` es `false`;
- no hubo error de lectura.

### `hercules:import --dry-run`

- se ejecutó con `--dry-run` explícito;
- no recibió `--database-url`;
- no recibió `--record-run`;
- produjo `create=252`, `update=0`, `skip=361`, `reject=174`;
- devolvió código 2 por el informe inválido;
- sus tres JSON coinciden byte a byte con los de `inspect`.

### `hercules:validate-db`

No se ejecutó. El código es de solo lectura (`SELECT`) cuando se usa sin
`--record-run`, pero exige una base `piccolo_test_*`. El clúster local no
contiene `piccolo_test_import`, y crear o clonar una base habría infringido la
prohibición de escritura.

### `apply`

**No se ejecutó.** No se pasó `--apply` a ningún comando.

## Diferencias frente al modelo PostgreSQL actual

| Área | Compatibilidad |
| --- | --- |
| Locales | Compatible: los 8 códigos están soportados |
| Categorías | Parcial: estructura y relaciones compatibles; `available` se ignora |
| Productos | Parcial: categoría, precio completo, orden, tags y alérgenos compatibles; media ración y cantidad se pierden |
| Traducciones | Parcial: esquema compatible, cobertura incompleta y branding sin traducción reconocida |
| Branding | Incompatible con el adaptador: nombres de campos agrupados no se transforman |
| Horarios | Incompatible con el adaptador: `hours` y `schedule` no se transforman |
| Assets | Esquema destino compatible; lector incompatible con extensiones del export |
| Vídeos | Esquema destino admite rol `video`; `videoStorageId` no se transforma |
| Usuarios/auth | Correctamente excluidos; no hay documentos de usuario |
| `importLog` | Sin entidad destino y omitida intencionadamente |
| Mappings | Diseño compatible, pero no comparado contra una DB existente |

## Errores, advertencias y riesgos

El informe contiene 185 errores y 904 advertencias.

### Errores

- 172 `STORAGE_BINARY_MISSING` bloqueantes para assets referenciados;
- 12 `MISSING_EXTERNAL_ID` en la tabla auxiliar `_tables`;
- 1 `REQUIRED_TRANSLATION_MISSING` en branding.

### Advertencias principales

- 357 `UNKNOWN_DOCUMENT_FIELD`;
- 262 `STORAGE_METADATA_MISSING`;
- 90 `STORAGE_BINARY_MISSING` no referenciados;
- 111 `MISSING_TRANSLATION`;
- 74 `ASSET_DUPLICATE_SHA256` inflados por el doble inventario;
- 8 `UNKNOWN_TABLE`;
- 1 `AUXILIARY_TABLE`;
- 1 `ZIP_UNRECOGNIZED_ENTRY`.

### Riesgos bloqueantes

1. Ningún asset puede enlazarse correctamente hasta normalizar la extensión del
   nombre de archivo al resolver el storage ID.
2. Se perderían 31 precios de media ración.
3. Se perderían 2 referencias de vídeo y 1 hero de branding.
4. Branding completo, horarios, paleta, tipografías y textos no se transformarían.
5. El restaurante y branding están rechazados por no reconocer
   `restaurantName`/`tagline` como traducciones.
6. Hay 111 traducciones faltantes respecto de una matriz completa de ocho
   idiomas.
7. No se ha podido comparar idempotencia contra mappings PostgreSQL reales sin
   disponer de una base de test preexistente.

### Riesgo secundario del proyecto

`npm ci` informa 4 vulnerabilidades en dependencias (1 moderada y 3 altas). No
se modificaron dependencias porque esta entrega autoriza solo documentación.

## Comprobaciones

| Comprobación | Resultado |
| --- | --- |
| `npm ci` | Correcto; 405 paquetes instalados |
| `npm run typecheck` | Correcto |
| `npm run lint` | Correcto |
| `npm run build` | Correcto |
| `npm run test:unit` | Correcto; 24/24 |
| Integración | No ejecutada: las suites hacen `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, DDL y `apply` |
| E2E | No ejecutada: la suite modifica categorías, productos, admins y rate limits |

Omitir integración y E2E es obligatorio para cumplir “cero escrituras
PostgreSQL”.

## Garantías de seguridad

- No se ejecutó `apply`.
- No se ejecutó `record-run`.
- No se ejecutó ninguna sentencia `INSERT`, `UPDATE` o `DELETE` contra
  PostgreSQL.
- No se importaron usuarios.
- No se copiaron assets a storage.
- No se escribió en Convex.
- No se accedió ni modificó Vercel.
- No se accedió ni modificó producción.
- No se eliminó ningún archivo.
- No se modificó `main`.
- El ZIP y los snapshots permanecen fuera de Git.
- Los únicos cambios versionados son este informe y los tres JSON generados por
  el importador.

## Checksums de la documentación generada

| Archivo | SHA-256 |
| --- | --- |
| `manifest.json` | `ec8013a4349f1674e1a93b60e1e2705addf806291f5ac3eb4033870791c64263` |
| `import-plan.json` | `05639f1eb6d56a7b00db19bc0eeba075e1a46d8bc22d890d9ce0cec4d79caaf0` |
| `validation-report.json` | `a195466a42bc8c5ec3590276dd7a1b19f00cdc1b9354dbe579f4fee8800fe4fb` |
