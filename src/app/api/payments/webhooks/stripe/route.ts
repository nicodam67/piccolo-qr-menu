import { NextResponse } from "next/server";
import { processProviderWebhook } from "@/features/reservations/payments/service";

export async function POST(request:Request) {
  const payload=await request.text();
  const signature=request.headers.get("stripe-signature") ?? "";
  let eventId="";
  try { eventId=String((JSON.parse(payload) as {id?:string}).id ?? ""); } catch { eventId=""; }
  if(!eventId) return NextResponse.json({error:"Evento inválido"},{status:400});
  try { await processProviderWebhook(payload,signature,eventId); return NextResponse.json({received:true}); }
  catch { return NextResponse.json({error:"Webhook rechazado"},{status:400}); }
}
