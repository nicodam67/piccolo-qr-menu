import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  normalizeCustomerInput,
  normalizeCustomerNote,
  splitCustomerName,
} from "../../src/features/customers/domain";

describe("customers CRM", () => {
  it("separa nombre y apellidos de una reserva", () => {
    assert.deepEqual(splitCustomerName("  Ana   Pérez García "), {
      firstName: "Ana",
      lastName: "Pérez García",
    });
  });
  it("normaliza teléfono email e idioma", () => {
    const customer = normalizeCustomerInput({
      firstName: "Ana",
      lastName: "Pérez",
      phone: "+34 600-123-456",
      email: " ANA@EXAMPLE.COM ",
      birthDate: "1990-05-10",
      preferredLocale: "es",
      observations: "Cliente habitual",
      importantAllergies: "Frutos secos",
      isActive: true,
    });
    assert.equal(customer.phone, "+34600123456");
    assert.equal(customer.email, "ana@example.com");
    assert.equal(customer.birthDate, "1990-05-10");
  });
  it("rechaza un idioma no soportado", () => {
    assert.throws(() =>
      normalizeCustomerInput({
        firstName: "Ana",
        lastName: "",
        phone: "600123456",
        email: "",
        birthDate: "",
        preferredLocale: "xx",
        observations: "",
        importantAllergies: "",
        isActive: true,
      }),
    );
  });
  it("rechaza fechas de nacimiento inválidas", () => {
    assert.throws(() =>
      normalizeCustomerInput({
        firstName: "Ana",
        lastName: "",
        phone: "600123456",
        email: "",
        birthDate: "2026-02-31",
        preferredLocale: "es",
        observations: "",
        importantAllergies: "",
        isActive: true,
      }),
    );
  });
  it("valida notas CRM", () => {
    assert.equal(normalizeCustomerNote("  Seguimiento telefónico  "), "Seguimiento telefónico");
    assert.throws(() => normalizeCustomerNote(" "));
    assert.throws(() => normalizeCustomerNote("<script>"));
  });
});
