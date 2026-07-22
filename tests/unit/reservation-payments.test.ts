import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { calculateDeposit, calculateGraceDeadline, canApplyToTpv, canMarkNoShow, enabledPaymentMethods, refundableAmount, remainingForTpv } from "../../src/features/reservations/payments/domain";
import { PaymentProviderNotConfigured } from "../../src/features/reservations/payments/provider";
import { SUPPORTED_LOCALE_CODES } from "../../src/config/locales";
import { getOfflinePaymentNotice } from "../../src/features/reservations/copy";

describe("reservation deposits", () => {
  it("calcula por persona en céntimos",()=>assert.equal(calculateDeposit(4,1000,1,true),4000));
  it("desactivado vale cero",()=>assert.equal(calculateDeposit(4,1000,1,false),0));
  it("respeta mínimo de personas",()=>assert.equal(calculateDeposit(3,1000,4,true),0));
  it("limita efectivo a manual",()=>assert.deepEqual(enabledPaymentMethods({cardEnabled:true,bizumEnabled:true,cashEnabled:true},"online"),["card","bizum"]));
  it("permite efectivo administrativo",()=>assert.deepEqual(enabledPaymentMethods({cardEnabled:false,bizumEnabled:false,cashEnabled:true},"manual"),["cash"]));
  it("calcula cortesía",()=>assert.equal(calculateGraceDeadline(new Date("2026-07-20T19:00:00Z"),15).toISOString(),"2026-07-20T19:15:00.000Z"));
  it("permite no-show tras límite",()=>assert.equal(canMarkNoShow("confirmed",new Date("2026-07-20T19:15Z"),null,new Date("2026-07-20T19:16Z")),true));
  it("rechaza no-show antes",()=>assert.equal(canMarkNoShow("confirmed",new Date("2026-07-20T19:15Z"),null,new Date("2026-07-20T19:14Z")),false));
  it("rechaza no-show con llegada",()=>assert.equal(canMarkNoShow("confirmed",new Date("2026-07-20T19:15Z"),new Date(),new Date("2026-07-20T19:16Z")),false));
  it("valida devolución parcial",()=>assert.equal(refundableAmount(4000,1000,1500),1500));
  it("impide doble devolución",()=>assert.throws(()=>refundableAmount(4000,3000,1500)));
  it("calcula saldo TPV",()=>assert.equal(remainingForTpv(4000,500,1000,false),2500));
  it("bloquea saldo retenido",()=>assert.equal(remainingForTpv(4000,0,0,true),0));
  it("prepara TPV solo tras llegada",()=>assert.equal(canApplyToTpv(new Date(),"paid",4000),true));
  it("proveedor desactivado rechaza webhooks",async()=>assert.equal(await new PaymentProviderNotConfigured().verifyWebhook("x","y"),false));
  it("proveedor no configurado no crea pagos",async()=>await assert.rejects(()=>new PaymentProviderNotConfigured().createPayment()));
  it("localiza el aviso de pago aplazado", () => {
    for (const locale of SUPPORTED_LOCALE_CODES) {
      assert.ok(getOfflinePaymentNotice(locale).length > 40);
    }
  });
  it("mantiene Stripe fuera del contrato compartido y con carga dinámica", () => {
    const root = process.cwd();
    const provider = readFileSync(
      path.join(root, "src/features/reservations/payments/provider.ts"),
      "utf8",
    );
    const factory = readFileSync(
      path.join(root, "src/features/reservations/payments/provider-factory.ts"),
      "utf8",
    );
    assert.doesNotMatch(provider, /stripe-provider|from ["']stripe["']/);
    assert.match(factory, /await import\(["']\.\/stripe-provider["']\)/);
  });
});
