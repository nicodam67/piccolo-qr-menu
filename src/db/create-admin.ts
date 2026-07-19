import "dotenv/config";

import argon2 from "argon2";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { admins } from "./schema";

const databaseUrl = process.env.DATABASE_URL;
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
const fullName = process.env.ADMIN_FULL_NAME?.trim();
const updateExisting = process.env.ADMIN_UPDATE_EXISTING === "true";

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

const adminEmail = email;
const adminPassword = password;
const adminFullName = fullName;
const client = postgres(databaseUrl, { max: 1 });
const db = drizzle(client);

async function createOrUpdateAdmin() {
  return db.transaction(async (tx) => {
    const [existingAdmin] = await tx
      .select({
        id: admins.id,
        isActive: admins.isActive,
      })
      .from(admins)
      .where(eq(admins.email, adminEmail))
      .limit(1);

    if (existingAdmin && !updateExisting) {
      throw new Error(
        "Ya existe un administrador con ese email. No se ha modificado ningún dato. Usa ADMIN_UPDATE_EXISTING=true para actualizar sus credenciales.",
      );
    }

    if (existingAdmin && !existingAdmin.isActive) {
      throw new Error(
        "El administrador existente está inactivo y no puede actualizarse ni reactivarse con este comando.",
      );
    }

    const passwordHash = await argon2.hash(adminPassword, {
      type: argon2.argon2id,
      memoryCost: 65_536,
      timeCost: 3,
      parallelism: 1,
    });

    if (existingAdmin) {
      await tx
        .update(admins)
        .set({
          passwordHash,
          fullName: adminFullName,
          sessionVersion: sql`${admins.sessionVersion} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(admins.id, existingAdmin.id));

      return "actualizado";
    }

    await tx.insert(admins).values({
      email: adminEmail,
      passwordHash,
      fullName: adminFullName,
      isActive: true,
      sessionVersion: 1,
    });

    return "creado";
  });
}

createOrUpdateAdmin()
  .then((result) => {
    console.info(`Administrador ${result}: ${adminEmail}`);
  })
  .catch((error: unknown) => {
    console.error("No se pudo crear el administrador.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });
