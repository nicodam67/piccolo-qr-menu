import { NextResponse } from "next/server";

export function proxy() {
  return new NextResponse(null, { status: 404 });
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
