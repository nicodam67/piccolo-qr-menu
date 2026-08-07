import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const MAX_CONNECTION_ATTEMPTS = 30;
const RETRY_DELAY_MS = 2_000;

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function connectToDatabase(databaseUrl: string) {
  for (let attempt = 1; attempt <= MAX_CONNECTION_ATTEMPTS; attempt += 1) {
    const client = postgres(databaseUrl, {
      max: 1,
      connect_timeout: 5,
    });

    try {
      await client`select 1`;
      return client;
    } catch (error) {
      await client.end({ timeout: 1 });

      if (attempt === MAX_CONNECTION_ATTEMPTS) {
        throw error;
      }

      console.info(
        `PostgreSQL todavía no está disponible (intento ${attempt}/${MAX_CONNECTION_ATTEMPTS}).`,
      );
      await delay(RETRY_DELAY_MS);
    }
  }

  throw new Error("No se pudo conectar con PostgreSQL.");
}

async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL;
  const authSecret = process.env.AUTH_SECRET;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL es obligatoria para ejecutar migraciones.");
  }

  if (!authSecret || new TextEncoder().encode(authSecret).byteLength < 32) {
    throw new Error("AUTH_SECRET debe contener al menos 32 bytes.");
  }

  const client = await connectToDatabase(databaseUrl);

  try {
    await migrate(drizzle(client), {
      migrationsFolder: "/app/drizzle",
    });
    console.info("Migraciones de PostgreSQL aplicadas.");
  } finally {
    await client.end();
  }
}

runMigrations().catch((error: unknown) => {
  console.error("No se pudieron aplicar las migraciones.", error);
  process.exitCode = 1;
});
