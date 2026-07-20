import { redirect } from "next/navigation";

export default async function AdminQrPage() {
  redirect("/admin/qr-code");
}
