# Entrega 29 — Auditoría e integración TPV ↔ QR Menu

## Alcance auditado

Se revisaron el árbol completo de `main`, su historial, las rutas, capas de
datos, autenticación, pruebas y las ramas remotas acumulativas:

- `delivery-21-base-ba22`: Reservas y dependencias de carta avanzada.
- `customer-crm-ba22`: Reservas, pagos y CRM.
- `customer-loyalty-ba22`: CRM, consentimientos, segmentos y fidelización.
- `replit-tpv-audit-ba22`: los dominios anteriores y la auditoría del TPV.

Las ramas forman una cadena, no cuatro implementaciones independientes. Por
ello deben fusionarse en orden cuando se autoricen sus migraciones; copiar sus
repositories o interfaces visuales de forma parcial duplicaría funcionalidad.

## Inventario de `main` antes de la Entrega 29

### API, Server Actions y clientes

- No existía `/api`, REST, OpenAPI, cliente HTTP ni autenticación de servicio.
- El único Route Handler era `GET /auth/clear-session`.
- Las mutaciones se ejecutaban con Server Actions:
  - autenticación: `loginAction`, `logoutAction`;
  - categorías: crear, editar, visibilidad, orden y eliminación;
  - productos: crear, editar, visibilidad, orden y eliminación.
- No existía Socket.IO, WebSocket, SSE, webhook, cola, outbox, worker, Redis,
  caché distribuida, PWA ni sincronización offline.
- La propagación administración → carta consistía en `revalidatePath("/es")`;
  no actualiza pestañas ya abiertas.

### Servicios y repositories

No había capa `services`. El acceso a PostgreSQL estaba concentrado en:

- `getPublicMenu`;
- `getAdminDashboardSummary`;
- repositories de categorías y productos;
- repositories de autenticación y rate limit.

Los patrones transaccionales reutilizables son los advisory locks, `FOR
UPDATE`, el upsert de traducciones y los errores de validación de dominio.

### Autenticación y RBAC

- Sesión humana mediante JWT HS256 en cookie `httpOnly`, `SameSite=Lax`.
- Revalidación contra `admins.is_active` y `session_version`.
- Argon2id y rate limit de login en PostgreSQL.
- Autorización binaria: administrador o anónimo. No hay roles ni permisos
  granulares.
- No había credenciales ni scopes entre servicios.

### Dominios

| Dominio | Estado en `main` | Estado reutilizable en ramas |
| --- | --- | --- |
| QR Menu | Carta pública y CRUD de catálogo | Carta avanzada, QR, idiomas y horarios |
| TPV | Ausente | Auditoría y plan; sin API implementada |
| Reservas | Ausente | Dominio, repository, actions, UI y pruebas |
| CRM | Ausente | Dominio, repository, actions, UI y pruebas |
| Fidelización | Ausente | Ledger, servicios, UI y puente TPV interno |

Reservas, CRM y fidelización dependen de las migraciones `0003`–`0013` de esas
ramas. Incorporarlas sin sus tablas no compila de forma operativa; incorporar
las tablas viola las restricciones de esta entrega.

### Componentes reutilizables

- Datos: UUID estables, precios en céntimos, `isActive`, `isSoldOut`,
  traducciones, alérgenos, etiquetas y horarios.
- Servidor: `getDatabase`, `getPublicMenu`, repository de productos,
  `revalidatePath` y errores de validación existentes.
- Seguridad humana: sesión, revocación y rate limit admin.
- UI: `AdminLayout`, `Sidebar`, managers CRUD, `ProductCard`,
  `CategoryNavigation`, `MenuSearch` y `OpeningHours`.
- Pruebas: Playwright con PostgreSQL real y Chrome móvil.

### Duplicaciones encontradas

- Queries y DTO distintos para catálogo público, dashboard y administración.
- Managers y flujos optimistic de categorías/productos casi paralelos.
- Validaciones repetidas entre Server Actions y repositories.
- Invalidación de rutas repetida y locale `/es` codificado.
- Configuración Argon2 repetida entre auth y CLI.
- Verificación JWT en proxy y sesión servidor con respuestas diferentes.
- Datos de contexto admin consultados por cada página.

No se refactorizan en esta entrega porque no son necesarias para el enlace TPV
y ampliarían el riesgo de regresión.

## Arquitectura definitiva

```text
QR Menu/PostgreSQL (maestro público)
  ├─ catálogo versionado ───────────────> TPV
  ├─ disponibilidad absoluta <────────── TPV
  ├─ Reservas (rama existente) <───────> TPV
  ├─ CRM (rama existente) <────────────> TPV
  └─ Fidelización (rama existente) <───> TPV

TPV (maestro operativo)
  └─ mesas, comandas, KDS, caja, fiscalidad e inventario
```

Las aplicaciones se despliegan separadas y no comparten tablas. La frontera es
HTTP versionada con Bearer token, scopes mínimos, correlation ID, contratos
OpenAPI, enteros para dinero y operaciones idempotentes. Socket.IO queda
interno al TPV y no es el canal de integración entre sistemas.

## Infraestructura añadida en esta entrega

- `GET /integration/v1/catalog`
  - scope `catalog:read`;
  - reutiliza `getPublicMenu`;
  - mantiene los precios originales en céntimos;
  - versión SHA-256 estable, `ETag`, `If-None-Match` y `since`;
  - solo expone contenido publicado.
- `PUT /integration/v1/catalog/products/{productId}/availability`
  - scope `catalog:write`;
  - reutiliza el repository de productos;
  - establece `isSoldOut` como estado absoluto, por lo que repetir la petición
    es idempotente;
  - invalida carta y administración.
- Autenticación de servicio cerrada por defecto:
  `INTEGRATION_SERVICE_TOKEN` de al menos 32 bytes y
  `INTEGRATION_SERVICE_SCOPES`.
- `X-Correlation-Id`, errores homogéneos, límite de body y logging sin PII.
- Contrato OpenAPI `3.1.0`.

## Lo que falta realmente

1. Fusionar en orden Reservas → CRM → Fidelización cuando se autorice la
   ventana de migraciones. No reescribir esos dominios.
2. Exponer sus servicios existentes por `/integration/v1` con scopes e
   idempotencia persistente.
3. Completar el catálogo TPV con IVA, formatos, modificadores y zona de
   preparación; esos campos no existen en PostgreSQL actual.
4. Resolver referencias externas TPV ↔ UUID canónico.
5. Endurecer en el repositorio TPV los hallazgos críticos de fichaje, Socket.IO,
   RBAC, credenciales demo e idempotencia de comandas.
6. Añadir rotación de credenciales, métricas, alertas, retries acotados y
   dead-letter para eventos operativos.

Los detalles del TPV, mapa de datos, seguridad, módulos y fases se conservan en
los cinco documentos `docs/replit-tpv-*` reutilizados de la auditoría previa.
