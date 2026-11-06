import { describe, it, expect } from "vitest";
import {
  isValidIsraeliPhone,
  validateContactForm,
  isContactFormValid,
  type ContactFormValues,
} from "./contact";

describe("isValidIsraeliPhone", () => {
  it("מקבל מספרים מקומיים תקינים (05XXXXXXXX)", () => {
    expect(isValidIsraeliPhone("0501234567")).toBe(true);
    expect(isValidIsraeliPhone("050-123-4567")).toBe(true);
    expect(isValidIsraeliPhone("050 1234567")).toBe(true);
  });

  it("מקבל מספרים בינלאומיים תקינים (+9725XXXXXXXX)", () => {
    expect(isValidIsraeliPhone("+972501234567")).toBe(true);
    expect(isValidIsraeliPhone("972501234567")).toBe(true);
  });

  it("דוחה מספר קצר מדי (5 ספרות)", () => {
    expect(isValidIsraeliPhone("12345")).toBe(false);
  });

  it("דוחה מחרוזת עם אותיות", () => {
    expect(isValidIsraeliPhone("05abc12345")).toBe(false);
    expect(isValidIsraeliPhone("phone number")).toBe(false);
  });

  it("דוחה מספר ללא קידומת 05 או 972", () => {
    expect(isValidIsraeliPhone("1234567890")).toBe(false);
  });

  it("דוחה מחרוזת ריקה", () => {
    expect(isValidIsraeliPhone("")).toBe(false);
  });
});

const baseValues: ContactFormValues = {
  name: "דנה כהן",
  phone: "0501234567",
  treatmentId: "",
  note: "",
  marketingConsent: false,
};

describe("validateContactForm / isContactFormValid", () => {
  it("טופס עם שם וטלפון תקינים עובר ולידציה ללא שגיאות", () => {
    const errors = validateContactForm(baseValues);
    expect(errors).toEqual({});
    expect(isContactFormValid(errors)).toBe(true);
  });

  it("מחזיר שגיאה כאשר הטלפון לא תקין (5 ספרות)", () => {
    const errors = validateContactForm({ ...baseValues, phone: "12345" });
    expect(errors.phone).toBeDefined();
    expect(isContactFormValid(errors)).toBe(false);
  });

  it("מחזיר שגיאה כאשר השם ריק", () => {
    const errors = validateContactForm({ ...baseValues, name: "   " });
    expect(errors.name).toBeDefined();
    expect(isContactFormValid(errors)).toBe(false);
  });

  it("מחזיר שגיאה כאשר הטלפון ריק", () => {
    const errors = validateContactForm({ ...baseValues, phone: "" });
    expect(errors.phone).toBeDefined();
  });
});
