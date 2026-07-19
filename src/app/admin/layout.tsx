import { requireAdminSession } from "@/features/auth/server-session";

export default async function ProtectedAdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireAdminSession();
  return children;
}
