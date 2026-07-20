import { NextResponse } from "next/server";
import { expirePendingPayments } from "@/features/reservations/payments/service";

export async function POST(request:Request) {
  const expected=process.env.RESERVATION_CRON_SECRET;
  const provided=request.headers.get("authorization");
  if(!expected || provided!==`Bearer ${expected}`) return NextResponse.json({error:"No autorizado"},{status:401});
  return NextResponse.json({expired:await expirePendingPayments()});
}
