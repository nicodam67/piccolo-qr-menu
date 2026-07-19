import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { destroyAdminSession } from "@/features/auth/server-session";

export async function GET(request: NextRequest) {
  await destroyAdminSession();
  return NextResponse.redirect(new URL("/login", request.url));
}
