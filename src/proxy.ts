import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  ADMIN_SESSION_COOKIE,
  getAdminCookieSecurityOptions,
  verifyAdminSessionToken,
} from "@/features/auth/session";

export async function proxy(request: NextRequest) {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const session = token ? await verifyAdminSessionToken(token) : null;

  if (session) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set(
    "next",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );

  const response = NextResponse.redirect(loginUrl);

  if (token) {
    response.cookies.set(ADMIN_SESSION_COOKIE, "", {
      ...getAdminCookieSecurityOptions(),
      expires: new Date(0),
      maxAge: 0,
    });
  }

  return response;
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
