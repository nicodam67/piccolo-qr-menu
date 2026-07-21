# Mapa de datos — TPV Replit y Piccolo QR Menu

## Resumen

| Característica | TPV Replit | Proyecto nuevo |
|---|---|---|
| Motor | PostgreSQL 16 | PostgreSQL |
| ORM | Drizzle 0.45 + SQL directo | Drizzle |
| Tablas | ~164 base + incrementales | 31 hasta Entrega 24 |
| Tenancy | Restaurante implícito | `restaurant_id` explícito |
| Dinero | `numeric(10,2)` euros | enteros en céntimos |
| Migraciones | snapshot `0000` + SQL `0001–0022` | cadena Drizzle `0000–0013` |
| Identificadores | UUID | UUID |
| Idiomas | columnas/JSON mixtos | tablas de traducción |

No se deben mezclar los dos esquemas directamente. Hay colisiones nominales
(`products`, `categories`, `reservations`, `tags`) con semánticas distintas.

## Autoridad de migraciones del TPV

El TPV tiene dos líneas:

1. `lib/db/drizzle/0000_mysterious_hitman.sql`, snapshot consolidado.
2. `lib/db/migrations/0001_*` a `0022_*`, SQL incremental manual.

El journal Drizzle solo conoce `0000`. Existen columnas usadas por API/migración
que no están declaradas en el esquema TypeScript, por ejemplo campos de
idempotencia y pedidos online. También hay DDL en runtime en
`middlewares/idempotency.ts`.

Antes de integrar hay que generar un inventario real desde una copia de la
base desplegada (`pg_dump --schema-only`) y compararlo con ambas fuentes.

## Equivalencias principales

### Configuración del restaurante

| TPV | Nuevo proyecto | Decisión |
|---|---|---|
| `business_config` | `restaurant_settings` | Nuevo proyecto como identidad pública |
| branding/QR JSON | traducciones + branding normalizado | Transformar |
| horarios JSON | `opening_hours` + `special_opening_hours` | Migrar al modelo normalizado |
| NIF/fiscal | No equivalente público | Mantener en TPV/facturación |

### Catálogo

| TPV | Nuevo proyecto | Compatibilidad |
|---|---|---|
| `categories` | `categories` | Conceptual; IDs y jerarquía deben mapearse |
| `subcategories` | `categories.parent_category_id` | Transformable |
| `products.price numeric` | `products.full_price_cents` | Multiplicar por 100 y redondear |
| `half_portion_price` | `half_price_cents` | Transformable |
| `product_formats` | No equivalente | Mantener en TPV; diseñar extensión futura |
| `modifiers` | No equivalente | Mantener en TPV |
| `prep_zone` | No equivalente público | Mantener para KDS |
| `tax_rate` | No equivalente | Debe incorporarse al catálogo central antes de TPV |
| traducciones JSON/columnas | `product_translations` | Transformar a filas |
| `allergens_catalog` | `allergens` | Mapear código/nombre, revisar duplicados |
| flags dietéticos | `tags` | Mapear mediante catálogo controlado |
| imágenes | URL/storage mixto | Migrar a almacenamiento del nuevo proyecto |

### Clientes y CRM

| TPV | Nuevo proyecto | Decisión |
|---|---|---|
| `crm_clients` | `customers` | Nuevo proyecto como maestro |
| teléfono/email | índices únicos por restaurante | Normalizar antes de enlazar |
| `crm_consents` booleanos | `customer_consents` append-only | Convertir cada estado en evento histórico |
| `crm_client_notes` | `customer_notes` | Migrable, conservando fecha/autor |
| direcciones CRM | `customer_addresses` | Migrable |
| `crm_loyalty_points` | `customer_loyalty_movements` | Migrar ledger, no solo saldo |
| `puntos_saldo` | `customer_loyalty_accounts.balance` | Recalcular desde movimientos |
| niveles/wallet/gift cards | Sin equivalente | Conservar fuera del primer alcance |

Identidad recomendada:

1. `customers.id` como ID canónico.
2. Tabla futura de referencias externas:
   `(system, external_id, customer_id)`.
3. Coincidencia secundaria por teléfono normalizado.
4. Email normalizado solo como alternativa.
5. Toda escritura del TPV debe llevar `idempotency_key` y
   `external_reference`.

### Reservas

| TPV | Nuevo proyecto | Incompatibilidad |
|---|---|---|
| `reservations.client_id` | `reservations.customer_id` | IDs distintos |
| estados españoles | estados ingleses controlados | Tabla de mapeo |
| `service_shifts` | generación desde horarios | Mantener turnos solo si aportan cupos |
| `waiting_list` | No existe | Módulo TPV opcional |
| `reservation_status_history` | Sin historial general | Migrar a eventos futuros |
| depósitos `numeric` | pagos de reserva en céntimos | Transformar y reconciliar |
| canal libre | `origin` controlado | Mapear |

### Fidelización

| TPV | Nuevo proyecto | Decisión |
|---|---|---|
| `crm_loyalty_config` | `loyalty_settings` | Nuevo proyecto como configuración mínima |
| `crm_clients.puntos_saldo` | cuenta normalizada | No copiar sin reconciliar ledger |
| `crm_loyalty_points` | movimientos append-only | ETL por tipo |
| tipos `emision/canje/...` | `tpv_accrual/tpv_redemption/...` | Mapa explícito |
| sin idempotencia fuerte | índice por referencia/clave | Generar referencias estables |

### Operaciones TPV sin equivalente nuevo

Se conservan inicialmente en el TPV:

- `room_zones`, `restaurant_tables`, `canvas_elements`;
- `orders`, `order_items`, modificadores y `kitchen_tasks`;
- `payments`, `cash_sessions`, `cash_movements`;
- `tickets`, `documents`, series y VeriFactu;
- `employees`, HR, fichaje, tablet y NFC;
- ingredientes, recetas, stock, lotes, proveedores y compras;
- impresoras, cola, hardware, backups y auditoría operativa.

## Precios, impuestos y precisión

El TPV usa `numeric(10,2)` y el proyecto nuevo céntimos enteros. La integración
debe definir:

```text
new_price_cents = round(tpv_price_eur * 100)
```

Nunca se deben convertir mediante `float` en JavaScript. Deben usarse cadenas
decimales, `numeric` en PostgreSQL o una librería decimal y validar:

- que la conversión sea reversible;
- que media ración tenga el mismo IVA que el formato correspondiente;
- que los precios históricos de comandas no cambien al editar productos;
- que `tax_rate` acepte 4, 10 y 21.

El catálogo nuevo no puede convertirse en fuente TPV hasta añadir impuestos,
destinos KDS, formatos y modificadores o definir contratos separados para
estos atributos.

## Integridad y riesgos

| Riesgo | Evidencia | Acción |
|---|---|---|
| Deriva esquema/migraciones | journal solo `0000` | Baseline real desde `pg_dump` |
| DDL runtime | `idempotency.ts` | Migración formal |
| FK blandas | orders→CRM/delivery | Añadir referencias o validador |
| Ledger y saldo duplicados | CRM antiguo | Recalcular y reconciliar |
| Seeds no marcados demo | migraciones 0016–0018 | Clasificar antes de migrar |
| Catálogos duplicados | QR Convex/Postgres/nuevo | Elegir maestro único |
| Estados incompatibles | reservas/pedidos | Tablas de mapeo versionadas |
| Importes heterogéneos | numeric vs cents | ETL decimal probado |

## Datos migrables

- Categorías/productos públicos, tras normalización.
- Traducciones verificadas.
- Imágenes con URL válida y propiedad conocida.
- Clientes tras deduplicación.
- Consentimientos con origen/fecha conocidos.
- Reservas futuras y su historial.
- Loyalty ledger reconciliado.
- Empleados, roles y fichajes después del hardening de identidad.
- Inventario/recetas si la base real supera pruebas de integridad.

## Datos transformables

- Precios e IVA.
- Estados de reserva/comanda/documento.
- Horarios JSON.
- Traducciones JSON/columnas.
- Direcciones y teléfonos.
- Saldos de loyalty.
- Destinos KDS y formatos.

## Datos que no deben conservarse sin revisión

- Secretos o tokens versionados.
- Contraseñas/PIN demo.
- Filas `is_demo=true`.
- Configuración de dispositivos/KDS sembrada sin instalación real.
- Simulaciones de caja, impresión, OCR o VeriFactu.
- Snapshots Convex con usuario y tokenIdentifier.
- Archivos llamados ZIP que en realidad contienen HTML/respuestas fallidas.
- Duplicados de clientes o productos sin procedencia verificable.

## Fuente única de productos propuesta

El PostgreSQL nuevo será la fuente maestra para identidad pública:

- categoría y jerarquía;
- nombre/descripción/traducciones;
- imagen;
- precios base/media;
- alérgenos, etiquetas, activo, agotado y orden.

Antes de conectar el TPV se ampliará mediante contratos operativos:

```text
CatalogProduct
  id canónico
  prices en céntimos
  taxRate
  formats[]
  modifierGroups[]
  prepZone
  stock/recipe reference
  version / updatedAt
```

El TPV consumirá este catálogo por API o réplica local versionada. No se
mantendrán dos interfaces de edición del mismo campo.
