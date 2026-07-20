# Piccolo QR Menu

Entrega 4: carta pública conectada a PostgreSQL y panel de administración
protegido mediante sesión segura.

## Ejecutar en local

Requisitos: Node.js 20.9 o superior, npm y PostgreSQL.

```bash
npm install
cp .env.example .env
npm run db:migrate
npm run db:seed
npm run db:admin:create
npm run dev
```

Antes de migrar, crea una base PostgreSQL vacía y adapta `DATABASE_URL` en
`.env` a sus credenciales reales. Configura también `AUTH_SECRET`,
`ADMIN_EMAIL`, `ADMIN_PASSWORD` y `ADMIN_FULL_NAME`. `AUTH_SECRET` debe tener
como mínimo 32 bytes de entropía aleatoria. Genéralo con:

```bash
openssl rand -base64 48
```

Abrir [http://localhost:3000](http://localhost:3000). La ruta raíz redirige a
`/es`.

## Base de datos

```bash
# Generar una nueva migración después de modificar el esquema
npm run db:generate

# Aplicar migraciones pendientes
npm run db:migrate

# Insertar o actualizar exclusivamente los datos demo
npm run db:seed
```

El seed es idempotente, usa identificadores reservados y está marcado como
demostrativo. Está destinado únicamente a desarrollo y no debe ejecutarse
contra una base de datos de producción.

Con `NODE_ENV=production`, el comando se bloquea antes de abrir una conexión.
Solo una autorización excepcional y explícita permite ejecutarlo:

```bash
NODE_ENV=production ALLOW_DEMO_SEED=true npm run db:seed
```

No configures `ALLOW_DEMO_SEED=true` de forma permanente. Los datos del seed no
son información oficial de Piccolo La Ràpita.

## Administrador y sesiones

`npm run db:admin:create` crea el administrador configurado en las variables
`ADMIN_*` únicamente si el email todavía no existe. Si ya existe, el comando
termina sin modificar datos.

Para cambiar explícitamente el nombre y la contraseña de una cuenta activa:

```bash
ADMIN_UPDATE_EXISTING=true npm run db:admin:create
```

La actualización mantiene `is_active`, incrementa `session_version` e invalida
inmediatamente todas las sesiones anteriores. Una cuenta inactiva nunca se
reactiva mediante este comando.

La contraseña se transforma con Argon2id y nunca se almacena en texto plano.
`ADMIN_PASSWORD` solo debe existir durante la creación o actualización del
administrador: elimínala del `.env` al terminar y nunca la mantengas como
credencial permanente.

La sesión utiliza una cookie `httpOnly`, `SameSite=Lax`, marcada como `Secure`
en producción. `AUTH_SESSION_TTL_SECONDS` controla su duración y admite valores
entre 300 y 604800 segundos. Cada carga servidor de `/admin` confirma en
PostgreSQL que la cuenta siga activa y que `session_version` coincida.

El login admite cinco intentos fallidos por combinación de email e IP dentro de
una ventana de quince minutos. Un acceso correcto elimina el contador.

## Comprobaciones

```bash
npm run typecheck
npm run lint
npm run build
npx playwright test
```

## Alcance

La página `/es` continúa consultando PostgreSQL mediante
`src/features/public-menu/repository.ts`. `/admin` requiere iniciar sesión en
`/login`. Las imágenes siguen siendo remotas y temporales.

`/admin/categories` permite crear, traducir, editar, activar, reordenar y
eliminar categorías vacías utilizando exclusivamente `categories` y
`category_translations`. Icono, color e imagen están excluidos porque no existen
en el esquema y no se autorizó una migración.

`/admin/menu-settings` configura qué datos aparecen en la carta pública y el
layout de lista o tarjetas. La configuración se guarda en
`restaurant_settings.menu_display_settings`. La aplicación valida el JSON con
Zod y aplica defaults seguros si la columna es `NULL`, está incompleta o
contiene propiedades desconocidas.

La carta pública filtra los productos en memoria por nombre y descripción,
muestra contadores por categoría y mantiene una navegación horizontal sticky.
La última categoría y posición se conservan en `sessionStorage` durante treinta
minutos para navegación de retorno; no se utilizan cookies ni persistencia en
PostgreSQL.

`/admin/products` gestiona productos, traducciones, precios, categoría,
visibilidad, agotados, orden, URL de imagen existente, etiquetas y alérgenos
reutilizando exclusivamente las tablas actuales.

## Imágenes de productos

El editor acepta JPG, JPEG, PNG y WEBP de hasta 10 MB. Cada subida elimina
metadatos, convierte a WEBP y genera variantes móvil (640 px) y escritorio
(1440 px). PostgreSQL conserva únicamente la URL de escritorio en el campo
`products.image_url`; la variante móvil se deriva del mismo nombre.

`IMAGE_STORAGE_DRIVER=local` está destinado a desarrollo y guarda archivos en
`.data/uploads`. En producción configura `IMAGE_STORAGE_DRIVER=s3` junto con
bucket, región y `IMAGE_PUBLIC_BASE_URL`; endpoint y credenciales explícitas son
opcionales para proveedores S3-compatible.

`/admin/allergens` y `/admin/tags` gestionan traducciones, visibilidad y orden.
Los elementos inactivos conservan sus asociaciones y siguen apareciendo al
editar productos ya relacionados, pero no se muestran en la carta pública. La
migración `0003_good_vin_gonzales.sql` añade únicamente `is_active` y
`sort_order` a ambas tablas.

`/admin/branding` permite editar identidad, contacto, portada y horarios con una
vista previa en tiempo real. Utiliza `restaurant_settings`,
`restaurant_translations` y `opening_hours` sin duplicar datos.

Email, ciudad, código postal, provincia, país, redes sociales, logotipo, colores
e imágenes adicionales están excluidos porque no existen en el esquema.

No contiene QR, exportaciones, variantes, extras, combos, almacenamiento S3,
publicación, pedidos ni integración con Piccolo TPV.
