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
`ADMIN_EMAIL`, `ADMIN_PASSWORD` y `ADMIN_FULL_NAME`. Genera el secreto con:

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

`npm run db:admin:create` crea o actualiza el único administrador configurado
en las variables `ADMIN_*`. La contraseña se transforma con Argon2id antes de
guardarse y nunca se almacena en texto plano. Elimina `ADMIN_PASSWORD` del
entorno cuando el alta haya terminado si no necesitas repetir el comando.

La sesión utiliza una cookie `httpOnly`, `SameSite=Lax`, marcada como `Secure`
en producción. `AUTH_SESSION_TTL_SECONDS` controla su duración y admite valores
entre 300 y 604800 segundos.

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

No contiene edición de productos o categorías, branding, QR, exportaciones,
almacenamiento S3, publicación, pedidos ni integración con Piccolo TPV.
