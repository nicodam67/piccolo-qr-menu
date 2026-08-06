# Auditoría del backup real Convex/Hercules — Entrega 3

## Resultado ejecutivo

**Estado: BLOQUEADA — backup real no disponible.**

La auditoría se detuvo en el punto 3 de la solicitud. No se encontró ningún
snapshot real de producción Convex/Hercules en el repositorio, en sus archivos
ignorados, en las rutas de carga de la sesión ni en los volúmenes visibles del
entorno. No se usaron fixtures ni se inventaron datos.

Como consecuencia:

- no se creó una copia de trabajo porque no existe una fuente que copiar;
- no se ejecutó `hercules:inspect`;
- no se ejecutó `hercules:import`;
- no se generaron `manifest`, `report` ni `plan`;
- no se abrió ninguna conexión PostgreSQL;
- no se ejecutó `apply`;
- no se leyó ni modificó Convex;
- no se copiaron assets;
- no se ejecutaron los pasos posteriores al gate (`npm ci`, typecheck, lint y
  build).

## Identificación de la ejecución

| Dato | Resultado |
| --- | --- |
| Repositorio | `nicodam67/piccolo-qr-menu` |
| Rama base | `main` |
| Commit base verificado | `21a43d4d4719f77f40290f12e682fb499da9b69f` |
| Estado inicial | Árbol limpio |
| Rama de auditoría | `cursor/hercules-consolidation-delivery-3-backup-audit-13e2` |
| Diferencia de nombre | El sufijo `-13e2` es obligatorio en este entorno de ejecución |
| Fecha de auditoría | 2026-08-06 (UTC) |

## Localización del backup

Se comprobaron, sin alterar su contenido:

- el árbol completo de `/workspace`;
- los archivos ignorados por Git (`git status --ignored`);
- `/workspace/backups` (no existe);
- `/opt/cursor/artifacts` y sus rutas de carga (vacías);
- `/tmp`, `/tmp/cursor` y `/var/tmp`;
- `/home/ubuntu` y `/home/ubuntu/.cursor`;
- `/mnt`, `/media` y `/srv`;
- `/exec-daemon`, `/packages` y `/run`;
- los montajes y directorios de primer nivel visibles en `/`.

No se encontró ningún ZIP Convex, ningún `documents.jsonl` real ni un directorio
extraído que pudiera identificarse de forma verificable como backup de
producción.

La documentación del importador confirma además que los snapshots y resultados
están excluidos por `.gitignore` y que el repositorio no contiene backups ni
datos reales. La ausencia local del backup sigue siendo un bloqueo: esa nota no
permite inferir su contenido ni sustituirlo.

## Metadatos del backup

| Dato obligatorio | Resultado |
| --- | --- |
| Nombre | **NO DISPONIBLE** |
| SHA-256 | **NO CALCULABLE: backup ausente** |
| Tamaño | **NO CALCULABLE: backup ausente** |
| Fecha del archivo | **NO DISPONIBLE: backup ausente** |
| Copia de trabajo | **NO CREADA: no existe original verificable** |

## Inventario de tablas y entidades

No existe entrada real sobre la que ejecutar el lector. Por tanto, cualquier
nombre o conteo distinto de “no evaluado” sería inventado.

| Inventario obligatorio | Conteo | Estado |
| --- | ---: | --- |
| Tablas encontradas | N/D | No evaluado |
| Categorías | N/D | No evaluado |
| Productos | N/D | No evaluado |
| Branding | N/D | No evaluado |
| Usuarios | N/D | No evaluado; no se expusieron datos sensibles |
| Assets | N/D | No evaluado |
| Idiomas/locales | N/D | No evaluado |
| Traducciones | N/D | No evaluado |
| Tags | N/D | No evaluado |
| Alérgenos | N/D | No evaluado |
| Tablas soportadas | N/D | No evaluado |
| Tablas desconocidas | N/D | No evaluado |
| Tablas ignoradas | N/D | No evaluado |

La clasificación prevista por el importador (`categories`, `menuItems`,
`branding`, `users`, `_storage`, tablas auxiliares y tablas desconocidas) no es
un inventario del backup real y no se presenta como tal.

## Integridad y anomalías

| Comprobación | Resultado |
| --- | --- |
| Documentos huérfanos | No evaluado |
| Assets huérfanos | No evaluado |
| Referencias rotas | No evaluado |
| IDs duplicados | No evaluado |
| Locales desconocidos | No evaluado |
| Campos inesperados | No evaluado |
| Tablas nuevas | No evaluado |
| Duplicados de contenido | No evaluado |
| Assets faltantes | No evaluado |

## Comparación con el plan maestro

La escala solicitada (`Coincide`, `No coincide`, `Parcial`) requiere evidencia
del snapshot. Sin backup, asignar una de esas conclusiones sería engañoso. Todos
los módulos quedan **bloqueados/no evaluables**:

| Módulo | Estado | Motivo |
| --- | --- | --- |
| Categorías | Bloqueado/no evaluable | Snapshot ausente |
| Productos y precios | Bloqueado/no evaluable | Snapshot ausente |
| Branding | Bloqueado/no evaluable | Snapshot ausente |
| Usuarios | Bloqueado/no evaluable | Snapshot ausente |
| Assets de imagen | Bloqueado/no evaluable | Snapshot ausente |
| Assets de vídeo | Bloqueado/no evaluable | Snapshot ausente |
| Ocho idiomas | Bloqueado/no evaluable | Snapshot ausente |
| Traducciones y fallback | Bloqueado/no evaluable | Snapshot ausente |
| Tags | Bloqueado/no evaluable | Snapshot ausente |
| Alérgenos | Bloqueado/no evaluable | Snapshot ausente |
| Relaciones y referencias | Bloqueado/no evaluable | Snapshot ausente |
| Importación repetible | Bloqueado/no evaluable | No se pudo producir un plan |

No puede comprobarse la expectativa del plan maestro de 26 categorías, 195
productos, ocho locales o aproximadamente 262 archivos.

## Mappings y dry-run

| Acción | Conteo |
| --- | ---: |
| `create` | N/D |
| `update` | N/D |
| `skip` | N/D |
| `reject` | N/D |

`npm run hercules:import` no se ejecutó porque requiere `--input` y el gate del
punto 3 ordena detenerse si no existe el backup real. No se proporcionó
`--database-url`, `--record-run` ni `--apply`.

**Resultado dry-run: NO EJECUTADO — backup ausente.**

## Resultado de inspect

`npm run hercules:inspect` no se ejecutó porque no existe una entrada real.

| Salida permitida | Resultado |
| --- | --- |
| `manifest.json` | No generado |
| `validation-report.json` / report | No generado |
| `import-plan.json` / plan | No generado |

**Resultado inspect: NO EJECUTADO — backup ausente.**

## Validación de assets

| Dato | Resultado |
| --- | --- |
| Total | N/D |
| Tamaño agregado | N/D |
| MIME | N/D |
| SHA-256 por asset | N/D |
| Imágenes | N/D |
| Vídeos | N/D |
| Duplicados | N/D |
| Faltantes | N/D |
| Huérfanos | N/D |

No se abrió, extrajo, copió ni publicó ningún binario.

## Usuarios y datos sensibles

No se inventariaron usuarios porque el backup no está presente. No se mostró,
registró ni transformó ningún correo, contraseña, hash, token, sesión, cookie,
clave API, secreto ni credencial.

## Garantía de cero escrituras

Durante esta auditoría:

- no se inició PostgreSQL;
- no se proporcionó `DATABASE_URL` a ningún comando del importador;
- no se ejecutó `hercules:validate-db`;
- no se ejecutó `hercules:import`;
- no se ejecutó `--record-run`;
- no se ejecutó `--apply`;
- no se ejecutaron sentencias `INSERT`, `UPDATE` ni `DELETE`;
- no se accedió a Convex ni a producción;
- no se modificó `main`.

Las únicas escrituras locales fueron la creación de la rama Git y este informe.

## Estabilidad del importador

El punto 3 exige detener la ejecución ante la ausencia del backup y antecede a
los checks del punto 15. Por ello:

| Comprobación | Resultado |
| --- | --- |
| `npm ci` | No ejecutado por bloqueo previo |
| `npm run typecheck` | No ejecutado por bloqueo previo |
| `npm run lint` | No ejecutado por bloqueo previo |
| `npm run build` | No ejecutado por bloqueo previo |

Este informe no afirma estabilidad ni fallo del importador: no hubo una
ejecución autorizada que permita concluirlo.

## Advertencias, diferencias, riesgos y bloqueos

### Bloqueo principal

Falta el snapshot ZIP real de producción Convex/Hercules con file storage.

### Diferencias respecto de la entrega solicitada

- No se puede calcular checksum, tamaño o fecha.
- No se pueden producir conteos exactos por tabla o entidad.
- No se pueden validar mappings, relaciones, locales ni campos.
- No se pueden validar MIME, hashes, duplicados o faltantes de assets.
- No se pueden ejecutar inspect, dry-run ni checks posteriores sin incumplir la
  orden explícita de detenerse.

### Riesgos

1. Ejecutar el importador con un fixture sintético daría una falsa apariencia de
   auditoría del backup real.
2. Usar un snapshot sin identificación de producción, fecha y procedencia no
   satisface la entrada inmutable del plan maestro.
3. Continuar con Entregas posteriores sin reconciliar conteos, referencias y
   assets reales mantiene un riesgo alto de pérdida de catálogo o medios.
4. La ausencia del backup impide comprobar que estén presentes los ocho
   idiomas y los conteos esperados.

### Requisito para desbloquear

Proporcionar por canal seguro el ZIP completo del snapshot de producción Convex
con `_storage`, junto con su nombre, fecha, procedencia/deployment y checksum
esperado. La siguiente ejecución debe volver a empezar desde una rama limpia,
crear una copia inmutable de trabajo y verificar el SHA-256 antes de inspección.

## Checklist de entrega

| # | Elemento | Resultado |
| ---: | --- | --- |
| 1 | Rama | `cursor/hercules-consolidation-delivery-3-backup-audit-13e2` |
| 2 | Commit base | `21a43d4d4719f77f40290f12e682fb499da9b69f` |
| 3 | SHA-256 del backup | No calculable |
| 4 | Tamaño | No calculable |
| 5 | Fecha | No disponible |
| 6 | Tablas encontradas | No evaluado |
| 7 | Conteo exacto por tabla | No evaluado |
| 8 | Categorías | No evaluado |
| 9 | Productos | No evaluado |
| 10 | Usuarios | No evaluado; cero datos sensibles expuestos |
| 11 | Assets | No evaluado |
| 12 | Idiomas | No evaluado |
| 13 | Traducciones | No evaluado |
| 14 | Tags | No evaluado |
| 15 | Alérgenos | No evaluado |
| 16 | Tablas desconocidas | No evaluado |
| 17 | Campos inesperados | No evaluado |
| 18 | Referencias rotas | No evaluado |
| 19 | Huérfanos | No evaluado |
| 20 | Duplicados | No evaluado |
| 21 | Resultado dry-run | No ejecutado |
| 22 | Resultado inspect | No ejecutado |
| 23 | Cero escrituras | Confirmado |
| 24 | `npm ci` | No ejecutado por stop del punto 3 |
| 25 | Typecheck | No ejecutado por stop del punto 3 |
| 26 | Lint | No ejecutado por stop del punto 3 |
| 27 | Build | No ejecutado por stop del punto 3 |
| 28 | `BACKUP_AUDIT_REPORT.md` | Creado |
| 29 | Commit final | Se completa al cerrar este informe |
| 30 | Push | Se completa al cerrar este informe |
| 31 | Riesgos | Documentados |
| 32 | No se ejecutó apply | Confirmado |
| 33 | `main` sin cambios | Confirmado; permanece en el commit base |

