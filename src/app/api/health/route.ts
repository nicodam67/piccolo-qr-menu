import { getDatabase } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { sql } = getDatabase();
    await sql`select 1`;

    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
