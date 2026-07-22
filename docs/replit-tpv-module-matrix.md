# Matriz de módulos y reutilización — Piccolo TPV

## Clasificación

| Clase | Significado |
|---|---|
| A | Reutilizable prácticamente sin cambios |
| B | Reutilizable con adaptación |
| C | Reutilizable solo visualmente |
| D | Requiere refactorización profunda |
| E | Debe reconstruirse |
| F | No existe |

La clase considera interfaz, servidor, persistencia, concurrencia, pruebas y
seguridad. La existencia de una pantalla no implica que el módulo esté
terminado.

## Inventario

| Módulo | Estado comprobado | Datos/persistencia | Evidencia | Clase |
|---|---|---|---|---|
| Acceso por PIN | Completo con JWT, bcrypt, rate limit y revocación | PostgreSQL: `employees`, `employee_pins`, `revoked_tokens` | `routes/auth.ts`, `auth.test.ts` | B |
| Roles | Parcial; middleware por rol aplicado de forma desigual | PostgreSQL | `middlewares/auth.ts`, `App.tsx` | D |
| Permisos granulares | UI y tabla presentes, casi no aplicados en API | PostgreSQL | `role-permissions.ts`, `permissions.ts` | D |
| Camareros | Operativo | Empleados reales | `login.tsx`, `order.tsx` | B |
| Empleados | Completo en HR | PostgreSQL | `routes/hr.ts`, `schema/hr.ts` | B |
| Fichaje | Funcional, pero trust model público inseguro | PostgreSQL | `routes/fichaje.ts` | D |
| PIN de fichaje | Implementado | Hash bcrypt | `fichaje.ts`, `tablet.ts` | B |
| NFC | Preparado, no validado físicamente | Hash SHA-256 + tarjetas DB | migración `0022`, `useNfc.ts` | D |
| Importación Anviz | CSV, no conexión física | Importación persistente | `FichajeImportarAnviz.tsx`, `hr-import.ts` | B |
| Salas | Completo | PostgreSQL | `zones.ts`, `zones.test.ts` | A |
| Mesas | Completo | PostgreSQL + eventos | `tables.ts`, `tables-states.test.ts` | A |
| Editor de plano | Completo | PostgreSQL | `zone-editor.tsx` | A |
| Paredes | Implementadas como canvas | PostgreSQL | `canvas-elements.ts` | A |
| Columnas | Implementadas como canvas | PostgreSQL | `canvas-elements.ts` | A |
| Puertas | Implementadas como canvas | PostgreSQL | `canvas-elements.ts` | A |
| Ventanas | Implementadas como canvas | PostgreSQL | `canvas-elements.ts` | A |
| Apertura de mesa | Transaccional y protegida contra apertura doble | PostgreSQL | `tables.ts`, `concurrency.test.ts` | A |
| Comandas | Flujo completo | PostgreSQL | `orders.ts`, `service-flow.test.ts` | A |
| Productos | CRUD completo, formatos, IVA y destino | PostgreSQL | `products.ts`, `schema/categories.ts` | A |
| Categorías | CRUD y subcategorías | PostgreSQL | `categories.ts` | A |
| Modificadores | Implementados; actualización posterior no recalcula precio | PostgreSQL | `modifiers.ts` | B |
| Notas de cocina | Pedido y línea | PostgreSQL | `orders.ts`, `order-items.ts` | A |
| Envío de comanda | Transacción parcial; cliente no envía idempotencia | PostgreSQL | `orders.ts`, `idempotency.ts` | D |
| Cocina | KDS por destino | PostgreSQL | `kds.ts` | B |
| KDS | Real, Socket.io + polling | `kitchen_tasks` | `kds.ts`, `kds.test.ts` | B |
| Pizza | Estado específico `in_oven` | PostgreSQL | `ZONE_TRANSITIONS` | B |
| Ensaladas | Destino específico | PostgreSQL | `prep_zone=ensalada` | B |
| Barra | Destino específico | PostgreSQL | `prep_zone=barra` | B |
| Pase | Vista agregada y recogida | PostgreSQL | `recogida.tsx`, `orders/:id/pase` | B |
| Aviso plato listo | Persistido y Socket.io | PostgreSQL | `waiter_notifications` | B |
| Recogida por camarero | Implementada | `kitchen_tasks` | `recogida.tsx` | B |
| Cambio de mesa | Implementado | PostgreSQL | `table-operations.ts` | B |
| Unión de mesas | Implementada | PostgreSQL | `table-operations.test.ts` | B |
| Separación de mesas | Implementada | PostgreSQL | `table-operations.ts` | B |
| División de cuenta | Implementada, tests indirectos | PostgreSQL | `splits.ts`, `payment.tsx` | B |
| Impresión | Cola/routing reales, conector físico simulado | PostgreSQL | `printers.ts`, `print-connector-sim.ts` | D |
| Tickets | Emisión transaccional | PostgreSQL | `payments.ts`, `ticket-builder.ts` | A |
| Prefacturas | Numeración bloqueada con `FOR UPDATE` | PostgreSQL | `orders.ts` | A |
| Facturas | Completas, pero rol waiter demasiado amplio | PostgreSQL | `documents.ts` | B |
| IVA 10 % | Implementado | Snapshot por línea | `lib/tax.ts` | A |
| IVA 4 % y 21 % | Implementados | PostgreSQL | `lib/tax.ts` | A |
| Caja | Apertura/cierre/arqueo real | PostgreSQL | `cash.ts` | B |
| Arqueos X/Z | Implementados | PostgreSQL | `x-report.tsx`, `z-report.tsx` | B |
| Movimientos de efectivo | Implementados | PostgreSQL | `cash_movements` | B |
| Caja automática | Simulador | DB + simulador | `cash-machine/simulator.ts` | E |
| Clientes CRM | Amplio, modelo paralelo al nuevo CRM | PostgreSQL | `crm.ts`, `crm_clients` | B |
| Reservas | Amplias, con turnos/lista de espera/depósitos | PostgreSQL | `reservations.ts` | B |
| QR menú PostgreSQL | Funcional y embebido | PostgreSQL | `/public/menu`, `CartaPublicaApp` | B |
| QR menú Convex | Segundo sistema paralelo | Convex/snapshot | `artifacts/qr-menu` | D |
| Autocobro en mesa | Implementado; Stripe o simulador | PostgreSQL | `online-orders-v2.ts`, `menu.tsx` | B |
| Inventario | Completo | PostgreSQL | `ingredients.ts`, `inventory.test.ts` | B |
| Ingredientes | Completo | PostgreSQL | `schema/stock.ts` | B |
| Escandallos | Recetas y subrecetas | PostgreSQL | `recipes.ts`, `subrecipes.ts` | B |
| Lotes/trazabilidad | Implementados | PostgreSQL | `traceability.ts` | B |
| Mermas | Implementadas | PostgreSQL | `waste-records.ts` | B |
| Proveedores | Completo | PostgreSQL | `suppliers.ts` | B |
| Compras | Pedidos y recepción | PostgreSQL | `purchase-orders.ts`, `goods-receipts.ts` | B |
| Facturas proveedor | Real; OCR puede ser simulado | PostgreSQL | `supplier-invoices.ts` | B |
| OCR | Simulador sin proveedor | Simulado | `ocr/simulator.ts` | E |
| Informes | Amplios, exportación Excel | PostgreSQL | `reports.ts` | B |
| Rentabilidad | Implementada | PostgreSQL | `profitability.ts` | B |
| Director/objetivos | Implementado | PostgreSQL | migración `0010_director_module` | B |
| Backups | Modelo y worker; destinos externos según credenciales | PostgreSQL | `backup-worker.ts` | B |
| Setup | Asistente completo | PostgreSQL | `setup.ts`, `pages/setup` | B |
| Instalación/hardware | Inventario y diagnósticos | PostgreSQL | migraciones `0014`–`0016` | B |
| VeriFactu hash/XML/QR | Implementado y probado | PostgreSQL | `verifactu.ts`, `verifactu.test.ts` | B |
| VeriFactu envío AEAT | No productivo | Simulador/test | `verifactu-worker.ts` | E |
| Campañas CRM | Persistencia/UI heredada | PostgreSQL | `crm_campaigns` | D |
| Fidelización heredada | Amplia, pero paralela al nuevo ledger | PostgreSQL | `crm_loyalty_points` | D |

## Módulos que conviene conservar

- Plano, zonas, mesas y operaciones de mesa.
- Flujo de pedido, catálogo operativo, formatos y modificadores.
- KDS y destinos, tras reforzar idempotencia/concurrencia.
- Caja, impuestos, tickets, prefacturas y documentos.
- Fichaje/HR como dominio, después de cerrar vulnerabilidades.
- Inventario, escandallos, compras y proveedores.
- Informes y trazabilidad.

## Módulos que requieren adaptación

- Autenticación/RBAC.
- Envío de comandas y stock.
- Socket.io.
- KDS concurrente.
- CRM, reservas y fidelización, para usar la fuente nueva.
- Catálogo, para dejar un único origen.
- Impresión física, OCR y caja automática.
- Facturación y VeriFactu productivo.

## Módulos a sustituir o retirar

- QR Convex paralelo, después de exportar únicamente datos válidos.
- Simuladores de hardware en producción.
- Ruta de fichaje público sin prueba de identidad.
- Envío AEAT simulado.

## Dependencias entre módulos

```text
productos ──> order_items ──> kitchen_tasks ──> KDS
     │              │
     └── recetas ───┴──> stock_movements

mesas ──> orders ──> payments ──> tickets/invoices ──> VeriFactu

employees ──> orders / cash_sessions / time_records

clientes ──> reservas / orders / loyalty
```

La conservación debe respetar estas dependencias; extraer una pantalla sin su
API, tablas y transacciones no constituye reutilización.
