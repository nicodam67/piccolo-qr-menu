# Plan de integración progresiva — Piccolo TPV

## Decisión de arquitectura

### Opción A — incorporar todo el TPV en `piccolo-qr-menu`

**Ventajas:** un despliegue y una base.

**Riesgos:** mezcla React/Vite/Express con Next.js, colisiones de esquema,
reescritura masiva de rutas, parada larga y pérdida de trabajo probado.

**Decisión:** descartada como estrategia inicial.

### Opción B — mantener dos aplicaciones conectadas por API

**Ventajas:** riesgo operativo bajo, conservación máxima, despliegues
independientes.

**Riesgos:** dos autenticaciones, sincronización y operación de dos servicios.

**Decisión:** recomendada como estado de transición.

### Opción C — migración progresiva de módulos

**Ventajas:** permite retirar duplicados gradualmente y llegar a una
arquitectura más sencilla.

**Riesgos:** requiere contratos, idempotencia, observabilidad y fases de doble
lectura.

**Decisión:** estrategia principal combinada con B.

### Opción D — mantener Replit y sustituir solo módulos débiles

**Ventajas:** entrega rápida y coste bajo.

**Riesgos:** perpetúa deuda de seguridad/migraciones y proveedores simulados.

**Decisión:** válida durante estabilización, no como estado final.

## Recomendación

Mantener el TPV como aplicación operativa y conectar progresivamente sus
módulos al PostgreSQL/API del proyecto nuevo. El nuevo proyecto será maestro
de catálogo público, clientes, reservas, consentimientos y fidelización. El
TPV conservará inicialmente operaciones de sala, KDS, caja, fiscalidad,
fichaje e inventario.

No se compartirán tablas directamente al principio. Se usarán APIs
versionadas y eventos idempotentes. Una vez estabilizado cada dominio se
decidirá si permanece como servicio o se migra físicamente.

Esta estrategia:

- evita reconstruir el 95 % existente;
- permite rollback por módulo;
- reduce el impacto en restaurante;
- facilita operación por una persona no programadora;
- puede desplegarse en NAS TerraMaster con contenedores separados, PostgreSQL
  gestionado, copias y proxy HTTPS.

## Contratos iniciales

```text
Catalog API
  GET /integration/v1/catalog?since=version
  IDs canónicos, precios cents, IVA, traducciones, formatos, prepZone

Customer API
  resolve(externalId?, phone?, email?)
  customerId canónico + referencia TPV

Reservation API
  locator, customerId, date/time, status, deposit balance

Loyalty API
  customerId, points, operation, externalReference, idempotencyKey

Order events
  orderId, item snapshots, status, terminalId, occurredAt, idempotencyKey
```

Todos los comandos requieren:

- autenticación de servicio;
- scope por dominio;
- idempotencia;
- versión;
- timestamps UTC;
- correlation ID;
- auditoría sin PII innecesaria.

## Fase 1 — seguridad, backup y congelación

| Aspecto | Plan |
|---|---|
| Conserva | Todo el TPV |
| Adapta | Secretos, fichaje, Socket.io, RBAC, idempotencia |
| Reemplaza | Ningún módulo funcional |
| Riesgo | Alto |
| Dependencias | Acceso Replit/DB, responsable legal y operativo |
| Datos | Snapshot completo y esquema real |
| Migración | Ninguna de negocio; formalizar DDL runtime |
| Pruebas | Restore en entorno aislado, auth negativa, concurrencia |
| Reversión | Restaurar snapshot y despliegue congelado |
| Tamaño | Grande |

Tareas:

1. rotar secretos y limpiar historial;
2. retirar snapshots PII;
3. `pg_dump` completo y schema-only;
4. etiquetar commit de producción;
5. corregir C-01/C-02/H-01/H-02;
6. unificar autoridad de migraciones;
7. añadir CI.

## Fase 2 — catálogo único

| Aspecto | Plan |
|---|---|
| Conserva | UI TPV, formatos, modificadores, IVA, prepZone |
| Adapta | Lectura/escritura de catálogo |
| Reemplaza | Edición duplicada QR/Convex |
| Riesgo | Alto |
| Dependencias | Fase 1, mapa de impuestos/formatos |
| Datos | Categorías, productos, precios, imágenes, traducciones |
| Migración | ETL numeric→cents y JSON→traducciones |
| Pruebas | Reconciliación 100 %, snapshot de comandas |
| Reversión | Feature flag vuelve al catálogo TPV |
| Tamaño | Grande |

El nuevo PostgreSQL será maestro. Hasta soportar IVA, formatos, modificadores y
destinos, el TPV mantendrá una réplica operacional versionada.

## Fase 3 — clientes, reservas y fidelización

| Aspecto | Plan |
|---|---|
| Conserva | UI CRM/reservas útil del TPV |
| Adapta | Repositorios a APIs nuevas |
| Reemplaza | `crm_clients`/loyalty paralelo como maestro |
| Riesgo | Medio-alto |
| Dependencias | Resolución de identidades |
| Datos | Clientes, consentimientos, reservas, ledger |
| Migración | Deduplicación y referencias externas |
| Pruebas | Idempotencia, saldos, consentimientos, conflictos |
| Reversión | Doble lectura y ledger antiguo en solo lectura |
| Tamaño | Grande |

No se fusionan clientes por email automáticamente sin revisión. Los puntos se
recalculan desde el ledger.

## Fase 4 — usuarios y empleados

| Aspecto | Plan |
|---|---|
| Conserva | Empleados, PIN, HR, roles operativos |
| Adapta | Identidad común y permisos |
| Reemplaza | Mapa estático de permisos |
| Riesgo | Alto |
| Dependencias | RBAC de fase 1 |
| Datos | Empleados, hashes, roles, permisos |
| Migración | Referencias externas, no contraseñas en claro |
| Pruebas | Matriz completa de roles y revocación |
| Reversión | Auth TPV detrás de feature flag |
| Tamaño | Grande |

## Fase 5 — salas, mesas y comandas

| Aspecto | Plan |
|---|---|
| Conserva | Plano, mesas, editor y flujo de pedido |
| Adapta | Idempotencia, locks y contratos catálogo |
| Reemplaza | DDL runtime |
| Riesgo | Alto |
| Dependencias | Catálogo e identidad |
| Datos | Mesas, pedidos abiertos, eventos |
| Migración | IDs canónicos y estados |
| Pruebas | 5 terminales, doble toque, caída/reconexión |
| Reversión | TPV operativo con réplica local |
| Tamaño | Grande |

Antes de producción: clave de envío en cliente, restricción KDS y stock
idempotente.

## Fase 6 — KDS

| Aspecto | Plan |
|---|---|
| Conserva | Pantallas, zonas y máquina de estados |
| Adapta | Socket autenticado, rooms y control de versión |
| Reemplaza | Broadcast global |
| Riesgo | Medio-alto |
| Dependencias | Comandas estabilizadas |
| Datos | Tareas y estaciones |
| Migración | Versiones/eventos si procede |
| Pruebas | Cocina/pizza/ensalada/barra simultáneas |
| Reversión | Polling sobre API anterior |
| Tamaño | Media |

## Fase 7 — caja

| Aspecto | Plan |
|---|---|
| Conserva | Sesiones, movimientos, X/Z, pagos |
| Adapta | Sesión para tarjeta y permisos |
| Reemplaza | Simulador de caja automática en producción |
| Riesgo | Alto |
| Dependencias | Pedidos/empleados |
| Datos | Caja, pagos, arqueos |
| Migración | Series/terminales/referencias |
| Pruebas | Cuadre por método, concurrencia y anulaciones |
| Reversión | Caja TPV aislada |
| Tamaño | Grande |

## Fase 8 — facturación

| Aspecto | Plan |
|---|---|
| Conserva | IVA, tickets, prefacturas, series, hash/XML |
| Adapta | Roles, rectificativas, emisión automática |
| Reemplaza | Envío VeriFactu simulado |
| Riesgo | Crítico/legal |
| Dependencias | Caja estable, asesoría fiscal |
| Datos | Documentos, series, auditoría |
| Migración | Numeración sin renumerar históricos |
| Pruebas | Casos 4/10/21 %, rectificación y AEAT test |
| Reversión | Desactivar envío, nunca borrar documentos |
| Tamaño | Grande |

## Fase 9 — fichaje

| Aspecto | Plan |
|---|---|
| Conserva | HR, registros, turnos, informes |
| Adapta | Identidad PIN/NFC y trazabilidad |
| Reemplaza | Endpoints públicos inseguros |
| Riesgo | Crítico/laboral |
| Dependencias | Usuarios/dispositivos |
| Datos | Entradas, salidas, pausas, correcciones |
| Migración | Ninguna destructiva |
| Pruebas | PIN, replay, tablet, offline, corrección |
| Reversión | Reloj manual controlado |
| Tamaño | Grande |

Anviz seguirá por importación CSV hasta aprobar integración física.

## Fase 10 — inventario y escandallos

| Aspecto | Plan |
|---|---|
| Conserva | Ingredientes, recetas, stock, compras |
| Adapta | IDs de catálogo e idempotencia de descuento |
| Reemplaza | OCR simulado si se contrata proveedor |
| Riesgo | Medio-alto |
| Dependencias | Catálogo/comandas |
| Datos | Ingredientes, lotes, movimientos, costes |
| Migración | Reconciliar unidades y existencias |
| Pruebas | Inventario físico, lote, merma y doble envío |
| Reversión | Snapshot de stock + ledger |
| Tamaño | Grande |

## Fase 11 — pagos

| Aspecto | Plan |
|---|---|
| Conserva | Abstracción nueva y pagos TPV |
| Adapta | Contrato común e idempotencia |
| Reemplaza | Simuladores solo al activar proveedor |
| Riesgo | Alto |
| Dependencias | Caja, reservas, seguridad |
| Datos | Intentos, pagos, devoluciones |
| Migración | Reconciliación por referencia |
| Pruebas | Sandbox, webhooks duplicados, refund |
| Reversión | `PAYMENT_PROVIDER=disabled` |
| Tamaño | Media |

## Fase 12 — VeriFactu

Separada de la fase fiscal interna para permitir validación legal:

- certificado y mTLS;
- test AEAT;
- reintentos e idempotencia;
- monitorización;
- contingencia y exportación.

Riesgo crítico, tamaño grande, reversión mediante modo test/desactivado sin
alterar documentos emitidos.

## Fase 13 — pruebas en restaurante

| Aspecto | Plan |
|---|---|
| Conserva | Sistema anterior como fallback |
| Riesgo | Alto operativo |
| Datos | Copia anonimizada + catálogo real controlado |
| Pruebas | 5 TPV, tablets, KDS, Wi‑Fi degradado, caja completa |
| Reversión | DNS/feature flags al TPV congelado |
| Tamaño | Grande |

Piloto por turnos, no cambio total en viernes/fin de semana.

## Fase 14 — producción

Requisitos:

- backups restaurables;
- observabilidad y alertas;
- runbook de apertura/cierre;
- responsable de soporte;
- rollback probado;
- NAS con RAID no sustituye backups externos;
- TLS, firewall, UPS y réplica de base;
- actualización controlada, no automática.

Tamaño medio tras completar fases anteriores.

## Estrategia de reversión transversal

1. IDs canónicos y referencias externas, nunca sobrescritura destructiva.
2. Doble lectura antes de cambiar la fuente maestra.
3. Comparadores de conteos/saldos.
4. Feature flags por módulo.
5. Backups antes de cada ETL.
6. Logs de migración sin PII.
7. Antiguo módulo en solo lectura durante periodo acordado.

## Lista exacta de tareas restantes

### Bloqueantes

- Rotar secretos y retirar snapshots.
- Corregir fichaje público/tablet.
- Autenticar Socket.io.
- Completar RBAC de API.
- Unificar migraciones.
- Corregir TypeScript.
- Actualizar dependencias vulnerables.
- Idempotencia de envío/KDS/stock.

### Antes de catálogo único

- Añadir IVA, formatos, modificadores y prepZone al contrato central.
- Decidir almacenamiento de imágenes.
- Exportar y validar traducciones.
- Elegir QR PostgreSQL y retirar Convex.

### Antes de operación conjunta

- Contratos API versionados.
- Identidad de servicio.
- Mapeo de clientes y estados.
- Reconciliación loyalty/reservas.
- Pruebas de concurrencia con DB real.
- CI/CD y entorno staging.

### Antes de producción

- Impresión/caja física.
- VeriFactu productivo certificado.
- Prueba de restauración.
- Piloto real.
- Formación y manuales.
- Plan de soporte y reversión.

No se ha ejecutado ninguna fase; este documento es únicamente el plan.
