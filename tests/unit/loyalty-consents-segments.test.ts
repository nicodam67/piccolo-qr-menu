import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyLoyaltyMovement,
  normalizeLoyaltyReason,
} from "../../src/features/loyalty/domain";
import {
  getCurrentConsentStates,
  isConsentStatus,
  isConsentType,
} from "../../src/features/consents/domain";
import {
  customerMatchesSegment,
  normalizeCustomerFilters,
} from "../../src/features/customer-segments/config";

const empty = {
  balance: 0,
  totalEarned: 0,
  totalRedeemed: 0,
  totalExpired: 0,
};

describe("loyalty, consents and segments", () => {
  it("abona puntos y actualiza el histórico obtenido", () => {
    assert.deepEqual(applyLoyaltyMovement(empty, 100, "manual_credit"), {
      balance: 100,
      totalEarned: 100,
      totalRedeemed: 0,
      totalExpired: 0,
    });
  });
  it("descuenta y registra puntos utilizados", () => {
    const result = applyLoyaltyMovement(
      { ...empty, balance: 100, totalEarned: 100 },
      -40,
      "manual_debit",
    );
    assert.equal(result.balance, 60);
    assert.equal(result.totalRedeemed, 40);
  });
  it("impide saldos negativos", () => {
    assert.throws(() => applyLoyaltyMovement(empty, -1, "redemption"));
  });
  it("registra caducidad separada", () => {
    const result = applyLoyaltyMovement(
      { ...empty, balance: 100, totalEarned: 100 },
      -30,
      "expiry",
    );
    assert.equal(result.totalExpired, 30);
    assert.equal(result.totalRedeemed, 0);
  });
  it("permite una corrección compensatoria sin reescribir históricos", () => {
    const result = applyLoyaltyMovement(
      { ...empty, balance: 100, totalEarned: 100 },
      -10,
      "correction",
    );
    assert.equal(result.balance, 90);
    assert.equal(result.totalEarned, 100);
  });
  it("exige motivo válido", () => {
    assert.equal(normalizeLoyaltyReason(" Ajuste autorizado "), "Ajuste autorizado");
    assert.throws(() => normalizeLoyaltyReason("x"));
  });
  it("valida tipos y estados de consentimiento", () => {
    assert.equal(isConsentType("marketing_email"), true);
    assert.equal(isConsentType("implicit"), false);
    assert.equal(isConsentStatus("withdrawn"), true);
  });
  it("obtiene únicamente el último estado de consentimiento", () => {
    const states = getCurrentConsentStates([
      {
        consentType: "marketing_email",
        status: "granted",
        createdAt: new Date("2026-01-01"),
      },
      {
        consentType: "marketing_email",
        status: "withdrawn",
        createdAt: new Date("2026-02-01"),
      },
    ]);
    assert.equal(states.get("marketing_email"), "withdrawn");
  });
  it("valida filtros estructurados y rechaza campos desconocidos", () => {
    assert.deepEqual(normalizeCustomerFilters({ hasPoints: true }), {
      hasPoints: true,
    });
    assert.throws(() => normalizeCustomerFilters({ secret: true }));
  });
  it("filtra por puntos, etiquetas y consentimiento", () => {
    const matches = customerMatchesSegment(
      {
        isActive: true,
        tagIds: ["00000000-0000-4000-8000-000000000001"],
        loyaltyParticipating: true,
        points: 100,
        emailConsent: "granted",
        phoneConsent: "rejected",
        noShowCount: 0,
      },
      {
        hasPoints: true,
        loyaltyParticipating: true,
        emailConsent: "granted",
        tagIds: ["00000000-0000-4000-8000-000000000001"],
      },
    );
    assert.equal(matches, true);
  });
  it("filtra clientes con no-show y sin visitas recientes", () => {
    assert.equal(
      customerMatchesSegment(
        {
          isActive: true,
          tagIds: [],
          loyaltyParticipating: false,
          points: 0,
          noShowCount: 1,
          daysSinceLastVisit: 120,
        },
        { hasNoShows: true, noVisitsSinceDays: 90 },
      ),
      true,
    );
  });
});
