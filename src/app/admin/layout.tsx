import { requireAdminSession } from "@/features/auth/server-session";
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function ProtectedAdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireAdminSession();
  return children;
}
