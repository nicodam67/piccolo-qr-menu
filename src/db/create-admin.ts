import "dotenv/config";

import argon2 from "argon2";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { admins } from "./schema";

const databaseUrl = process.env.DATABASE_URL;
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
const fullName = process.env.ADMIN_FULL_NAME?.trim();

if (!databaseUrl) {
  throw new Error("DATABASE_URL es obligatoria para crear el administrador.");
}

if (!email || !email.includes("@") || email.length > 320) {
  throw new Error("ADMIN_EMAIL debe contener un email válido.");
}

if (!password || password.length < 12 || password.length > 1_024) {
  throw new Error(
    "ADMIN_PASSWORD debe contener entre 12 y 1024 caracteres.",
  );
}

if (!fullName || fullName.length > 160) {
  throw new Error("ADMIN_FULL_NAME es obligatorio y admite 160 caracteres.");
}

const client = postgres(databaseUrl, { max: 1 });
const db = drizzle(client);

async function createOrUpdateAdmin() {
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65_536,
    timeCost: 3,
    parallelism: 1,
  });

  await db
    .insert(admins)
    .values({
      email,
      passwordHash,
      fullName,
      isActive: true,
    })
    .onConflictDoUpdate({
      target: admins.email,
      set: {
        passwordHash,
        fullName,
        isActive: true,
        updatedAt: new Date(),
      },
    });
}

createOrUpdateAdmin()
  .then(() => {
    console.info(`Administrador creado o actualizado: ${email}`);
  })
  .catch((error: unknown) => {
    console.error("No se pudo crear el administrador.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });
