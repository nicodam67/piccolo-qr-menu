# Entrega 30 — Inventario y consolidación verificable

## 1. Inventario Git previo

| Dato | Valor |
| --- | --- |
| Rama de trabajo | `cursor/tpv-qr-integration-25f4` |
| HEAD inicial | `d54b75d7868e7112e767d76baed2a310b554e6a9` |
| Base | `main@116188aaf71576fb546c5079bb752749094e4dcd` |
| Ancestro común de las líneas | `addf5f4d764925a88ee5d0dfbe812e43c3093595` |
| PR actual | #11, Draft, base `main` |

Ramas locales al iniciar:

- `main`;
- `cursor/tpv-qr-integration-25f4`.

Ramas remotas relevantes:

- `origin/cursor/delivery-21-base-ba22@feb30ff`;
- `origin/cursor/public-mobile-prototype-ba22@29b4cac`;
- `origin/cursor/customer-crm-ba22@cc263d2`;
- `origin/cursor/customer-loyalty-ba22@964d95b`;
- `origin/cursor/replit-tpv-audit-ba22@484a91b`.

Pull Requests:

| PR | Head → base | Estado | Contenido |
| --- | --- | --- | --- |
| #5 | `public-mobile-prototype-ba22` → `delivery-21-base-ba22` | Draft | Adelantos |
| #6 | `customer-crm-ba22` → `public-mobile-prototype-ba22` | Draft | CRM |
| #7 | `customer-loyalty-ba22` → `customer-crm-ba22` | Draft | Fidelización |
| #8 | `replit-tpv-audit-ba22` → `customer-loyalty-ba22` | Draft | Auditoría TPV |
| #11 | rama actual → `main` | Draft | Entrega 29/30 |

Las ramas de dominio son acumulativas: Reservas es ancestro de CRM y CRM es
ancestro de Fidelización. Antes de esta entrega, la rama actual contenía la API
de catálogo de Entrega 29, pero ninguno de esos dominios ni las migraciones
`0003`–`0013`.

## 2. Commits funcionales localizados

### Reservas

- `776d798658f526f8a42a6321b9ce4148c05e5d11`: dominio, UI, repository,
  Server Actions y migración 0009.
- `3572d91`: ciclo E2E.
- `394a5d4`: zonas horarias.
- `feb30ff`: validación de cambios de horario.

### Adelantos y eventos económicos

- `dcf23812700d792f10d62a4f2d3551a6c93752c5`: modelo, abstracción
  `PaymentProvider` y migración 0010.
- `9346639598cf596e8e20d9694c80d608d6344af1`: proveedor Stripe aislado,
  webhook y migración 0011.
- `77bbc5f`, `07ac60d`, `7ddf822`, `e39da45`: operación sin proveedor real.
- `eb79965665152b86196a495245cdc88a428a12df`: arreglo posterior de pagos
  desactivados que no había llegado a las ramas CRM/Fidelización.

### CRM

- `3986e03b31cba76c354da115212e7ddeb2fba07a`: CRM reutilizable y
  migración 0012.
- `3c2a08b`, `11d6f77`, `cc263d2`: búsqueda, pruebas y refresco de detalle.

### Fidelización

- `4cc16c3710bb317ba2d74b050d32bed41f34d751`: fidelización,
  consentimientos, etiquetas, segmentos y migración 0013.
- `eeda35d`, `964d95b`: estabilización E2E de CRM.

## 3. Migraciones reales

Los nombres y contenidos se inspeccionaron con `git show`, no se dedujeron por
la numeración.

### `0009_awesome_warpath.sql` — Reservas

- Crea `reservation_settings` y `reservations`.
- Añade localizador único e idempotencia única por restaurante.
- Incluye FKs a `restaurant_settings`, checks de capacidad, estados, origen,
  locale y tamaños, e índices de fecha/estado/contacto.

### `0010_melodic_joystick.sql` — Adelantos

- Crea `reservation_payments` y `reservation_economic_events`.
- Añade configuración de depósito y métodos a `reservation_settings`.
- Añade estado económico, cortesía, llegada y aplicación TPV a `reservations`.
- Incluye FKs, checks de importes/estados y claves de idempotencia.

### `0011_lush_blonde_phantom.sql` — Eventos del proveedor

- Añade `provider_event_id` a `reservation_economic_events`.
- Crea el índice único `reservation_events_provider_event_uidx`.

### `0012_overconfident_iron_man.sql` — CRM

- Crea `customers`, `customer_addresses` y `customer_notes`.
- Añade `reservations.customer_id`.
- Migra invitados históricos a clientes y enlaza reservas.
- Incluye unicidad parcial de email, teléfono por restaurante, FKs e índices.

### `0013_nervous_rockslide.sql` — Fidelización

- Crea consentimientos, cuentas y movimientos de puntos, configuración,
  etiquetas/asignaciones y segmentos.
- Inicializa cuentas para clientes existentes.
- Incluye ledger con idempotencia, checks de saldo/tipos, FKs e índices.

Prerrequisitos también consolidados y ordenados:

- 0003: orden/actividad de alérgenos y etiquetas;
- 0004: configuración visual de menú;
- 0005: locales persistentes;
- 0006: horarios especiales;
- 0007: jerarquía de categorías;
- 0008: tipos de excepción horaria.

## 4. Estrategia aplicada

Se integró una sola vez la punta acumulativa
`origin/cursor/customer-loyalty-ba22`. Este merge conserva el historial
Reservas → Adelantos → CRM → Fidelización y evita repetir migraciones o
repositories. No se fusionó `replit-tpv-audit-ba22` porque sus documentos ya
estaban incorporados byte a byte en Entrega 29.

Después se aplicó el commit existente `eb79965` para conservar el arreglo de
pagos desactivados que había quedado en una rama hermana.

## 5. Conflictos y resolución

### Merge acumulativo

- `.env.example`: unión de imágenes, pagos desactivados e integración TPV.
- `public-menu/repository.ts`: se conservó el repository avanzado y se
  añadieron los campos en céntimos e identificador requeridos por catálogo v1.
- `package.json`, README, tipos, producto y E2E se auto-fusionaron; se revisaron
  para conservar dependencias, `setProductSoldOut` y las pruebas de Entrega 29.

### `eb79965`

- Se mantuvo el estado de proveedor `active/incomplete/disabled`.
- Se eliminaron props, imports, queries y botones duplicados producidos por la
  divergencia.
- Se conservaron historial económico, efectivo/tarjeta externa/cortesía,
  avisos localizados y carga dinámica de Stripe exclusivamente en servidor.
- Las pruebas combinan la cobertura CRM/Fidelización posterior con la
  comprobación explícita de que no se muestra método online.

Ninguna migración aplicada fue editada o regenerada.

## 6. Estado de pagos

- `PAYMENT_PROVIDER=disabled` en `.env.example`.
- Stripe permanece detrás de `PaymentProvider` y carga dinámica de servidor.
- Bizum no tiene proveedor activo ni simulación.
- El webhook falla cerrado sin proveedor configurado.
- Los flujos administrativos y el ledger económico permanecen disponibles.
- No se solicitaron credenciales ni se ejecutaron transacciones externas.

## 7. Verificación actual del TPV

Repositorio verificado: `nicodam67/piccolo-tpv-replit`.

- Auditoría original: `main@03b1aa3`.
- Último merge en `main`: `28a806b`, PR #1.
- Rama visible más reciente: `6a81c4f`, solo añade entorno sobre ese `main`.

Resultado en código:

| Control | Estado | Evidencia |
| --- | --- | --- |
| Socket.IO autenticado | Resuelto | `cc0e6b5`, `11e99e6` |
| Fichaje protegido | Resuelto en servidor | `57d5621`, `cab5ee1` |
| Comandas idempotentes | Resuelto para pedido/KDS/stock | `2637000`, `3c8e5bd`, `85d1b7b`, `7ca742e` |
| RBAC | Parcial | `88d6d38`; faltan mutaciones operativas |
| Impresión exactly-once | Pendiente | `print_queue` no tiene deduplicación equivalente |

No se puede verificar desde GitHub que producción ejecute esos commits ni que
las migraciones TPV estén aplicadas. No se añadió código TPV a este proyecto.

## 8. Seguridad de `/integration/v1`

- Token exclusivamente por entorno, mínimo 32 bytes.
- Comparación mediante `timingSafeEqual`.
- Scopes `catalog:read` y `catalog:write` aplicados por ruta.
- 401 para token inválido, 403 para scope insuficiente y 503 sin configuración.
- `X-Correlation-Id` validado/generado y sin token en logs.
- Body de disponibilidad limitado a 1024 bytes y validado estrictamente.
- PUT de disponibilidad establece estado absoluto e idempotente.
- El catálogo solo publica carta; no contiene perfiles, contactos ni notas CRM.
- No se reutiliza el rate limit de login porque depende de identidad humana y
  tablas específicas; la limitación distribuida de integración queda futura.

No se publicaron endpoints de Reservas, CRM, Fidelización ni pagos en esta
entrega.
