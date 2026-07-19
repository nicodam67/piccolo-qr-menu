# Piccolo QR Menu

Entrega 2: carta pública mobile-first conectada a PostgreSQL mediante Drizzle.

## Ejecutar en local

Requisitos: Node.js 20.9 o superior, npm y PostgreSQL.

```bash
npm install
cp .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
```

Antes de migrar, crea una base PostgreSQL vacía y adapta `DATABASE_URL` en
`.env` a sus credenciales reales.

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

## Comprobaciones

```bash
npm run typecheck
npm run lint
npm run build
npx playwright test
```

## Alcance

La página `/es` consulta PostgreSQL mediante
`src/features/public-menu/repository.ts`. Las imágenes siguen siendo remotas y
temporales.

No contiene administración, autenticación, almacenamiento S3, publicación,
pedidos ni integración con Piccolo TPV.
