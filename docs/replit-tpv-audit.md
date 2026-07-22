# Auditoría técnica verificable — Piccolo TPV de Replit

> **Nota de vigencia (Entrega 30).** Esta auditoría describe
> `main@03b1aa3`. La revalidación del 22 de julio de 2026 sobre
> `main@28a806b` confirma que Socket.IO autenticado, la autorización de fichaje
> y la idempotencia transaccional de comandas ya están implementados mediante
> la PR TPV #1. RBAC sigue parcialmente aplicado y la impresión física no tiene
> garantía exactly-once. El estado del despliegue y de sus migraciones no es
> verificable desde este repositorio. Se conserva el texto original como
> evidencia histórica del commit auditado.

## Identificación y alcance

| Dato | Valor |
|---|---|
| Repositorio | `https://github.com/nicodam67/piccolo-tpv-replit` |
| Ruta de auditoría | `/tmp/cursor/piccolo-tpv-audit` |
| Rama | `main` |
| Commit | `03b1aa3ba2422697e525c9738b2a0166caa9c3dd` |
| Commits | 228 |
| Archivos versionados | 1.358 |
| Estado inicial/final | Limpio, sin cambios locales |

La auditoría fue estática antes de instalar dependencias. Después se ejecutaron
comprobaciones de lectura, TypeScript, tests, builds y auditoría de
dependencias. No se ejecutaron migraciones, no se conectó una base TPV y no se
modificó el repositorio auditado.

## Resumen ejecutivo

El TPV no es una maqueta. Contiene un sistema operativo amplio con frontend,
API Express, PostgreSQL, Drizzle, autenticación PIN/JWT, mesas, comandas,
KDS, caja, documentos fiscales, fichaje, reservas, CRM, stock, compras,
informes y autocobro. La mayor parte del dominio y de la interfaz merece
conservarse.

No está listo para integrarse directamente en producción sin una fase previa
de seguridad y estabilización:

1. El fichaje público permite registrar acciones sin prueba suficiente de PIN
   o dispositivo.
2. Socket.io no autentica conexiones y usa origen `*`.
3. El RBAC del servidor es inconsistente; gran parte de las rutas operativas
   solo exige autenticación.
4. La cadena de migraciones tiene dos fuentes de verdad y deriva respecto al
   esquema TypeScript.
5. El cliente no envía clave de idempotencia al enviar comandas; una
   repetición puede duplicar tareas KDS y stock.
6. VeriFactu solo tiene simulador/adaptador de pruebas, no envío productivo.

La recomendación es mantener temporalmente ambos proyectos y realizar una
migración progresiva por módulos. El PostgreSQL nuevo debe ser la fuente
central del catálogo público, clientes, reservas y fidelización. El TPV debe
conservar inicialmente mesas, comandas, KDS, caja, fichaje e inventario,
conectado mediante contratos API idempotentes.

## Tecnología detectada

| Capa | Tecnología |
|---|---|
| Monorepo | pnpm workspaces, 10 paquetes |
| Runtime Replit | Node.js 24, PostgreSQL 16 |
| Lenguaje | TypeScript 5.9, modo estricto |
| Frontend TPV | React 19.1, Vite 7, Wouter, TanStack Query 5 |
| API | Express 5.2, Zod 3.25, Pino |
| Tiempo real | Socket.io 4.8 |
| Datos | PostgreSQL, Drizzle ORM 0.45 |
| QR heredado | React Router 7 + Convex |
| Estilos | Tailwind 4, Radix/shadcn |
| Tests | Vitest 4, Supertest, Playwright 1.61 |
| API tipada | OpenAPI, Orval, cliente React Query y Zod generados |

Evidencia principal:

- `package.json`
- `pnpm-workspace.yaml`
- `.replit`
- `artifacts/api-server/package.json`
- `artifacts/piccolo-tpv/package.json`
- `lib/db/package.json`
- `artifacts/piccolo-tpv/src/App.tsx`
- `artifacts/api-server/src/routes/index.ts`

La documentación interna presenta deriva: `replit.md` menciona React 18,
Zod 4, 18 migraciones y 31 suites; el código contiene React 19, Zod 3,
22 migraciones incrementales y 28 archivos Vitest.

## Estructura

```text
artifacts/
  api-server/       API Express, workers y tests
  piccolo-tpv/      aplicación TPV React/Vite
  qr-menu/          aplicación QR heredada con Convex
  mockup-sandbox/   sandbox visual
lib/
  db/               esquema Drizzle y migraciones
  api-spec/         OpenAPI y Orval
  api-client-react/ cliente generado
  api-zod/          validaciones generadas
scripts/            comprobaciones y despliegue
```

`lib/integrations/*` está declarado en el workspace, pero el directorio no
existe.

## Rutas y estado

- El TPV define más de 100 rutas Wouter en
  `artifacts/piccolo-tpv/src/App.tsx`.
- La API registra 62 módulos bajo `/api` en
  `artifacts/api-server/src/routes/index.ts`.
- TanStack Query gestiona estado remoto.
- `AuthProvider` conserva JWT y empleado en `localStorage`.
- Existe IndexedDB `piccolo-offline` y una cola local, pero la cola no se usa
  desde los flujos principales de camarero.
- Socket.io se combina con polling de 15 segundos y reconexión.

## Persistencia real frente a simulada

### Persistencia real

- PostgreSQL para empleados, mesas, pedidos, líneas, KDS, pagos, caja,
  documentos, reservas, CRM, stock, compras, fichaje y auditorías.
- Transacciones reales en apertura de mesa, envío de comanda, liquidación,
  numeración y operaciones económicas.

### Simulado o incompleto

- Conector de impresión: `print-connector-sim.ts`.
- Caja automática: simulador por defecto.
- OCR de facturas: proveedor simulador si no existe configuración.
- VeriFactu: simulador y adaptador de test, sin producción AEAT.
- Pago online: simulador si falta Stripe.
- QR: dos arquitecturas paralelas, PostgreSQL y Convex.
- Offline: infraestructura presente, pero no integrada con el flujo real del
  camarero.

## Resultados de validación

### Instalación

`pnpm install --frozen-lockfile` resolvió 715 paquetes, pero pnpm 11 devolvió
`ERR_PNPM_IGNORED_BUILDS` por el script de `esbuild`. La comprobación se
continuó con aprobación temporal de build para la auditoría. No se modificó
el repositorio.

### TypeScript

`pnpm run typecheck` falla con 57 errores. Áreas principales:

- retornos incompletos en `routes/backup.ts`, `diagnostics.ts` y
  `verifactu.ts`;
- tipos `string | string[]` de parámetros Express en KDS, modificadores y
  notificaciones;
- deriva de esquema (`tableNumber`, `updatedAt`);
- conversiones inseguras de resultados PostgreSQL;
- errores de tipos `Buffer`;
- errores en tests (`afterEach` no importado y mocks incompatibles).

### ESLint

No existe configuración ESLint ni script `lint`; no puede ejecutarse.

### Tests de API

- Auditor de rutas: 63 archivos, aprobado.
- Vitest: 26 suites aprobadas, 2 fallidas.
- 521 tests aprobados, 12 omitidos.
- `delivery.test.ts` intenta usar una base PostgreSQL `test` inexistente.
- `online-orders-v2.test.ts` no incluye `requirePermission` en su mock.

### E2E

Playwright encontró 19 tests: 11 pasaron y 8 fallaron porque los servidores
TPV/API documentados y una base sembrada no estaban disponibles. El puerto
por defecto de Playwright tampoco coincide con los puertos de Replit.

### Build

Con `PORT=8080 BASE_PATH=/`, todos los paquetes construyen:

- API: bundle `index.mjs` de 6,4 MB.
- TPV: bundle JS de 2,985 MB, gzip 711 KB.
- QR heredado: bundle JS de 984 KB, gzip 304 KB.

Persisten advertencias por chunks superiores a 500 KB, fuentes QR no
resueltas y sourcemaps de varios componentes.

### Dependencias

`pnpm audit` detectó:

- alto: `adm-zip` menor de 0.6;
- alto: `js-yaml` menor de 4.3;
- moderado: `uuid` transitivo de ExcelJS;
- bajo: `esbuild` 0.27.3.

## Evidencias funcionales principales

| Flujo | Evidencia |
|---|---|
| PIN/JWT | `routes/auth.ts`, `middlewares/auth.ts` |
| Mesas/plano | `routes/tables.ts`, `zones.ts`, `canvas-elements.ts` |
| Comanda | `routes/orders.ts`, `pages/order.tsx` |
| KDS | `routes/kds.ts`, `pages/kds.tsx` |
| Caja | `routes/cash.ts`, `payments.ts` |
| Documentos | `routes/documents.ts`, `lib/tax.ts` |
| Fichaje | `routes/fichaje.ts`, `routes/tablet.ts` |
| Inventario | `routes/ingredients.ts`, `purchase-orders.ts` |
| CRM/reservas | `routes/crm.ts`, `reservations.ts` |

La matriz detallada, el mapa de datos, seguridad y plan se encuentran en los
otros documentos de esta entrega.
