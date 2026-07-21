# Auditoría de seguridad — Piccolo TPV

## Método

- Inspección de archivos sensibles antes de ejecutar código.
- Búsqueda de secretos en árbol actual e historial Git, mostrando únicamente
  rutas y tipos.
- Revisión estática de autenticación, autorización, rutas, validaciones,
  Socket.io, logs, PII y SQL.
- Ejecución del auditor de rutas incluido.
- `pnpm audit`.

No se muestran valores secretos ni datos personales.

## Hallazgos iniciales del repositorio

### Alto — secreto versionado

`artifacts/qr-menu/.env.local` está versionado y contiene:

- URL Convex configurada;
- secreto de importación de 64 caracteres no identificado como placeholder.

Acción: revocar/rotar el secreto, eliminar el archivo del historial Git,
añadir reglas de ignore y revisar logs de importación.

### Alto — snapshot con identificador de usuario

`artifacts/qr-menu/import-data/backup_extracted/users/documents.jsonl`
contiene campos `email`, `name` y `tokenIdentifier`.

Acción: retirar los snapshots del repositorio público, revisar si los datos
son reales, invalidar referencias de autenticación si procede y conservar
solo fixtures anonimizadas.

### Medio — ejemplos con apariencia de credenciales

`.env.example` contiene valores configurados para secretos de sesión, Stripe,
webhook y simuladores. Aunque algunos pueden ser ficticios, su formato no
permite asumirlo.

Acción: sustituir por placeholders inequívocos, verificar que nunca se usaron
en producción y rotar si existe duda.

### Bajo/medio — backups y binarios innecesarios

- Tres archivos `.zip` están versionados, pero `file` los identifica como
  HTML/texto, no ZIP válido.
- Existe un snapshot extraído con 492 documentos y 262 referencias de
  almacenamiento.
- No existen archivos versionados superiores a 50 MB.

Acción: retirar respuestas HTML y snapshots; conservar un manifiesto
anonimizado si es necesario documentar la importación.

## Hallazgos críticos

### C-01 — fichaje público sin prueba de identidad

`POST /api/fichaje/public/clock` acepta `employeeId` y acción sin PIN,
token de dispositivo ni rate limit suficiente.

Evidencia:

- `artifacts/api-server/src/routes/fichaje.ts`
- allowlist de `artifacts/api-server/scripts/audit-routes.ts`

Impacto: cualquier cliente de Internet podría registrar fichajes de empleados
si conoce o enumera el UUID. Riesgo laboral y de protección de datos.

Remediación: deshabilitar la ruta pública; exigir desafío PIN/NFC y token
efímero ligado a empleado, dispositivo, acción y TTL.

### C-02 — reloj tablet no vincula verificación PIN con fichaje

`verify-pin` y `tablet/clock` son peticiones independientes. Un token de
tablet permite fichar cualquier `employeeId` sin prueba correlacionada.

Evidencia: `artifacts/api-server/src/routes/tablet.ts`.

Remediación: después del PIN emitir nonce de un solo uso, firmado y con TTL
menor de 60 segundos; consumirlo atómicamente al fichar.

## Hallazgos altos

### H-01 — Socket.io sin autenticación

`artifacts/api-server/src/lib/socket.ts` usa `origin: "*"` y no valida JWT.
Expone eventos operativos de mesas, KDS y pedidos.

Remediación: autenticación de handshake, CORS igual al HTTP, rooms por
restaurante/zona/empleado y permisos por evento.

### H-02 — RBAC de servidor incompleto

Numerosas escrituras de pedidos, mesas, delivery, reservas y alergias solo
usan `requireAuth`. Los guards frontend no son una frontera de seguridad.

Remediación: matriz ruta-permiso, `requirePermission` obligatorio y test
negativo por rol.

### H-03 — permisos configurables no afectan la API

`role_permissions` y su interfaz existen, pero `checkPermission()` apenas se
usa. La API emplea un mapa estático.

Remediación: una única fuente de autorización y cache invalidable.

### H-04 — camareros pueden emitir facturas

`POST /documents/invoices` permite rol waiter, aunque la pantalla admin está
protegida.

Remediación: permiso fiscal específico y autorización elevada.

### H-05 — VeriFactu no productivo

Hash, XML y QR existen, pero el envío productivo AEAT está bloqueado. Tickets
y facturas quedan pendientes sin integración automática garantizada.

Remediación: no activar hasta disponer de certificado, mTLS, reintentos,
idempotencia, monitorización y validación legal.

### H-06 — bootstrap público con credenciales conocidas

`POST /setup/seed-employees` puede crear usuarios si la base está vacía y usa
hashes precomputados asociados a patrones demo.

Remediación: token de instalación de un solo uso, variable de habilitación,
desactivación irreversible tras alta y PIN obligatorio nuevo.

### H-07 — tokens de repartidor en query string

Los endpoints de courier reciben `?token=`, expuesto a historial, Referer y
proxies.

Remediación: cabecera Authorization, expiración, rotación y scopes.

### H-08 — vulnerabilidades de dependencias

`pnpm audit`:

| Severidad | Paquete | Riesgo |
|---|---|---|
| Alto | `adm-zip` | ZIP preparada puede forzar 4 GB de memoria |
| Alto | `js-yaml` | DoS por cadenas de merge |
| Moderado | `uuid` transitivo | límites de buffer |
| Bajo | `esbuild` 0.27.3 | lectura arbitraria en dev server Windows |

## Hallazgos medios

| ID | Hallazgo | Evidencia/acción |
|---|---|---|
| M-01 | JWT en localStorage | XSS permite robar sesión; migrar a cookie segura o endurecer CSP |
| M-02 | bcrypt coste 6 en PIN demo | Elevar coste y forzar cambio |
| M-03 | fallback criptográfico VeriFactu | Eliminar `fallback-secret-change-me`, fallo seguro |
| M-04 | config pública fiscal | Minimizar `/config/business` |
| M-05 | enumeración pública empleados | Rate limit y mínimo de datos |
| M-06 | estado de pedido enumerable | Token no predecible o acceso autenticado |
| M-07 | carrito por token sin rate limit | Limitar creación/consulta |
| M-08 | pairing codes en memoria | Persistir hash/TTL/intentos |
| M-09 | UID NFC SHA-256 sin salt | HMAC con secreto rotatable |
| M-10 | tarjeta sin sesión de caja | Definir política y trazabilidad |
| M-11 | ausencia de CSP | Añadir CSP estricta |
| M-12 | `sql.raw` con nombres de tabla | Mantener allowlist cerrada |
| M-13 | documentación de seguridad obsoleta | Regenerar desde código |
| M-14 | DDL de idempotencia en runtime | Mover a migración |

## Riesgos de comandas y concurrencia

### Alto — envío duplicado

La API tiene middleware de idempotencia, pero `order.tsx` no envía
`Idempotency-Key`. Tampoco existe `UNIQUE(order_item_id)` en
`kitchen_tasks`.

Impacto: doble tarea KDS y posible doble descuento de stock tras doble toque o
reintento de red.

Remediación:

1. generar clave estable por acción en el cliente;
2. guardarla con el pedido;
3. añadir restricción adecuada;
4. incluir stock en la misma estrategia idempotente.

### Medio — KDS last-write-wins

Las transiciones actualizan una fila sin versión ni lock. Dos operadores
pueden pisarse.

Remediación: `version`, `updated_at` condicional o lock transaccional.

### Medio — offline no operativo

Existe cola IndexedDB/API, pero `enqueueOperation()` no se usa en los flujos
de mesas/comandas. El sync `open_table` no ocupa la mesa atómicamente.

Remediación: no publicitar modo offline hasta completar pruebas de conflicto y
reconciliación.

## Controles positivos

- JWT con `jti` y revocación persistida.
- Fallo cerrado cuando no puede comprobarse la revocación.
- Rate limit de PIN y autorización de manager.
- Pino redacta Authorization.
- CORS HTTP por allowlist.
- Precios e impuestos calculados en servidor.
- Transacciones en pagos y numeración.
- Zod en rutas.
- Drizzle parametriza la mayoría de consultas.
- Auditor estático de rutas: 63 archivos aprobados.

El auditor de rutas solo verifica presencia de middleware, no que el rol o
permiso sea suficiente; por eso no invalida H-02/H-03.

## Prioridad de corrección

1. Bloquear fichaje público y corregir vínculo PIN/tablet.
2. Autenticar Socket.io.
3. Aplicar permisos de servidor a toda ruta.
4. Rotar secretos y retirar snapshots.
5. Idempotencia de comandas/KDS/stock.
6. Eliminar bootstrap conocido.
7. Corregir tokens courier.
8. Actualizar dependencias vulnerables.
9. Estabilizar migraciones/DDL.
10. Diseñar VeriFactu productivo con asesoramiento legal.

Ningún secreto debe copiarse al proyecto nuevo. La integración futura usará
secretos rotados y un gestor de secretos, nunca datos versionados.
