import "server-only";

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";

import * as schema from "./schema";

export class DatabaseConfigurationError extends Error {
  constructor() {
    super("DATABASE_URL no está configurada.");
    this.name = "DatabaseConfigurationError";
  }
}

type DatabaseClient = {
  db: PostgresJsDatabase<typeof schema>;
  sql: Sql;
};

const globalForDatabase = globalThis as typeof globalThis & {
  piccoloDatabase?: DatabaseClient;
};

export function getDatabase(): DatabaseClient {
  if (globalForDatabase.piccoloDatabase) {
    return globalForDatabase.piccoloDatabase;
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new DatabaseConfigurationError();
  }

  const sql = postgres(databaseUrl, {
    max: process.env.NODE_ENV === "production" ? 10 : 3,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  const client = {
    db: drizzle(sql, { schema }),
    sql,
  };

  globalForDatabase.piccoloDatabase = client;

  return client;
}
