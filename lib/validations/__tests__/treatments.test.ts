/**
 * בדיקות ל-parseTreatmentInput — ולידציית קטלוג טיפולים (משימה 11.7, FR-AP-02).
 *
 * פונקציה טהורה ללא תלות ב-DB/רשת. בודק:
 * 1. create — מקבל payload תקין; מנרמל (trim/uppercase/ברירת מחדל לצבע).
 * 2. create — דוחה שם חסר/ריק/ארוך מדי, משך/מחיר מחוץ לטווח או לא שלם, צבע פסול,
 *    תיאור/זמן חזרה/מטפלים ארוכים מדי, recommendedReturnDays פסול.
 * 3. צבע ריק → ברירת המחדל של המותג (#D2AB2E).
 * 4. update — ולידציה חלקית: רק שדות שהוגשו נבדקים/נכללים ב-data.
 *
 * הרצה: `npx vitest run lib/validations/__tests__/treatments.test.ts`
 */

import { describe, it, expect } from "vitest";
import {
  parseTreatmentInput,
  isTreatmentValid,
  DEFAULT_TREATMENT_COLOR,
} from "@/lib/validations/treatments";

const VALID_CREATE = {
  name: "בוטוקס",
  description: "החלקת קמטים",
  durationMinutes: 30,
  price: 500,
  recommendedReturn: "4 חודשים",
  recommendedReturnDays: 120,
  color: "#aabbcc",
  requiresConsentForm: true,
  authorizedTherapists: "שרה, נועה",
};

describe("parseTreatmentInput — create תקין", () => {
  it("מקבל payload מלא תקין ללא שגיאות", () => {
    const { errors, data } = parseTreatmentInput(VALID_CREATE, "create");
    expect(isTreatmentValid(errors)).toBe(true);
    expect(data.name).toBe("בוטוקס");
    expect(data.durationMinutes).toBe(30);
    expect(data.price).toBe(500);
    expect(data.requiresConsentForm).toBe(true);
  });

  it("עושה trim לשם ומנרמל צבע ל-uppercase", () => {
    const { data } = parseTreatmentInput(
      { ...VALID_CREATE, name: "  פילינג  ", color: "#aabbcc" },
      "create"
    );
    expect(data.name).toBe("פילינג");
    expect(data.color).toBe("#AABBCC");
  });

  it("מנרמל מטפלים מופרדים בפסיק (trim לכל שם)", () => {
    const { data } = parseTreatmentInput(
      { ...VALID_CREATE, authorizedTherapists: " שרה , נועה ,, " },
      "create"
    );
    expect(data.authorizedTherapists).toBe("שרה,נועה");
  });

  it("מקבל משך/מחיר כמחרוזת מספרית", () => {
    const { errors, data } = parseTreatmentInput(
      { ...VALID_CREATE, durationMinutes: "45", price: "0" },
      "create"
    );
    expect(isTreatmentValid(errors)).toBe(true);
    expect(data.durationMinutes).toBe(45);
    expect(data.price).toBe(0);
  });
});

describe("parseTreatmentInput — create: שם", () => {
  it("דוחה שם חסר", () => {
    const { errors } = parseTreatmentInput(
      { durationMinutes: 30, price: 100 },
      "create"
    );
    expect(errors.name).toBeTruthy();
  });

  it("דוחה שם ריק/רווחים בלבד", () => {
    const { errors } = parseTreatmentInput(
      { ...VALID_CREATE, name: "   " },
      "create"
    );
    expect(errors.name).toBeTruthy();
  });

  it("דוחה שם ארוך מ-100 תווים", () => {
    const { errors } = parseTreatmentInput(
      { ...VALID_CREATE, name: "א".repeat(101) },
      "create"
    );
    expect(errors.name).toBeTruthy();
  });

  it("מקבל שם באורך 100 תווים בדיוק", () => {
    const { errors } = parseTreatmentInput(
      { ...VALID_CREATE, name: "א".repeat(100) },
      "create"
    );
    expect(errors.name).toBeUndefined();
  });

  it("raw שאינו אובייקט → שגיאת name", () => {
    expect(parseTreatmentInput(null, "create").errors.name).toBeTruthy();
    expect(parseTreatmentInput("x", "create").errors.name).toBeTruthy();
    expect(parseTreatmentInput([], "create").errors.name).toBeTruthy();
  });
});

describe("parseTreatmentInput — create: משך", () => {
  it("דוחה משך 0 (מתחת לטווח 1-600)", () => {
    const { errors } = parseTreatmentInput(
      { ...VALID_CREATE, durationMinutes: 0 },
      "create"
    );
    expect(errors.durationMinutes).toBeTruthy();
  });

  it("דוחה משך 601 (מעל הטווח)", () => {
    const { errors } = parseTreatmentInput(
      { ...VALID_CREATE, durationMinutes: 601 },
      "create"
    );
    expect(errors.durationMinutes).toBeTruthy();
  });

  it("דוחה משך לא שלם", () => {
    const { errors } = parseTreatmentInput(
      { ...VALID_CREATE, durationMinutes: 30.5 },
      "create"
    );
    expect(errors.durationMinutes).toBeTruthy();
  });

  it("דוחה משך חסר ב-create", () => {
    const { errors } = parseTreatmentInput(
      { name: "x", price: 100 },
      "create"
    );
    expect(errors.durationMinutes).toBeTruthy();
  });
});

describe("parseTreatmentInput — create: מחיר", () => {
  it("מקבל מחיר 0", () => {
    const { errors, data } = parseTreatmentInput(
      { ...VALID_CREATE, price: 0 },
      "create"
    );
    expect(errors.price).toBeUndefined();
    expect(data.price).toBe(0);
  });

  it("דוחה מחיר שלילי", () => {
    const { errors } = parseTreatmentInput(
      { ...VALID_CREATE, price: -1 },
      "create"
    );
    expect(errors.price).toBeTruthy();
  });

  it("דוחה מחיר מעל 100000", () => {
    const { errors } = parseTreatmentInput(
      { ...VALID_CREATE, price: 100001 },
      "create"
    );
    expect(errors.price).toBeTruthy();
  });

  it("דוחה מחיר לא שלם", () => {
    const { errors } = parseTreatmentInput(
      { ...VALID_CREATE, price: 99.99 },
      "create"
    );
    expect(errors.price).toBeTruthy();
  });
});

describe("parseTreatmentInput — צבע", () => {
  it("צבע ריק → ברירת המחדל של המותג", () => {
    const { errors, data } = parseTreatmentInput(
      { ...VALID_CREATE, color: "" },
      "create"
    );
    expect(errors.color).toBeUndefined();
    expect(data.color).toBe(DEFAULT_TREATMENT_COLOR);
  });

  it("צבע null → ברירת המחדל", () => {
    const { data } = parseTreatmentInput(
      { ...VALID_CREATE, color: null },
      "create"
    );
    expect(data.color).toBe(DEFAULT_TREATMENT_COLOR);
  });

  it("דוחה צבע שאינו #RRGGBB", () => {
    expect(
      parseTreatmentInput({ ...VALID_CREATE, color: "red" }, "create").errors.color
    ).toBeTruthy();
    expect(
      parseTreatmentInput({ ...VALID_CREATE, color: "#abc" }, "create").errors.color
    ).toBeTruthy();
    expect(
      parseTreatmentInput({ ...VALID_CREATE, color: "#12345g" }, "create").errors
        .color
    ).toBeTruthy();
  });
});

describe("parseTreatmentInput — שדות אופציונליים", () => {
  it("דוחה תיאור ארוך מ-500 תווים", () => {
    const { errors } = parseTreatmentInput(
      { ...VALID_CREATE, description: "א".repeat(501) },
      "create"
    );
    expect(errors.description).toBeTruthy();
  });

  it("דוחה זמן חזרה (טקסט) ארוך מ-100 תווים", () => {
    const { errors } = parseTreatmentInput(
      { ...VALID_CREATE, recommendedReturn: "א".repeat(101) },
      "create"
    );
    expect(errors.recommendedReturn).toBeTruthy();
  });

  it("דוחה רשימת מטפלים ארוכה מ-300 תווים", () => {
    const { errors } = parseTreatmentInput(
      { ...VALID_CREATE, authorizedTherapists: "א".repeat(301) },
      "create"
    );
    expect(errors.authorizedTherapists).toBeTruthy();
  });

  it("recommendedReturnDays מחוץ לטווח 1-3650 נדחה", () => {
    expect(
      parseTreatmentInput(
        { ...VALID_CREATE, recommendedReturnDays: 0 },
        "create"
      ).errors.recommendedReturnDays
    ).toBeTruthy();
    expect(
      parseTreatmentInput(
        { ...VALID_CREATE, recommendedReturnDays: 3651 },
        "create"
      ).errors.recommendedReturnDays
    ).toBeTruthy();
    expect(
      parseTreatmentInput(
        { ...VALID_CREATE, recommendedReturnDays: 5.5 },
        "create"
      ).errors.recommendedReturnDays
    ).toBeTruthy();
  });

  it("recommendedReturnDays ריק/null → null (לא שגיאה)", () => {
    const { errors, data } = parseTreatmentInput(
      { ...VALID_CREATE, recommendedReturnDays: "" },
      "create"
    );
    expect(errors.recommendedReturnDays).toBeUndefined();
    expect(data.recommendedReturnDays).toBeNull();
  });

  it("requiresConsentForm לא בוליאני → שגיאה", () => {
    const { errors } = parseTreatmentInput(
      { ...VALID_CREATE, requiresConsentForm: "yes" },
      "create"
    );
    expect(errors.requiresConsentForm).toBeTruthy();
  });
});

describe("parseTreatmentInput — update (חלקי)", () => {
  it("מקבל payload חלקי — רק השדה שהוגש נכלל ב-data", () => {
    const { errors, data } = parseTreatmentInput({ price: 750 }, "update");
    expect(isTreatmentValid(errors)).toBe(true);
    expect(data).toEqual({ price: 750 });
    expect(data.name).toBeUndefined();
    expect(data.durationMinutes).toBeUndefined();
  });

  it("לא דורש שם/משך/מחיר כשלא הוגשו (בניגוד ל-create)", () => {
    const { errors } = parseTreatmentInput(
      { recommendedReturn: "6 שבועות" },
      "update"
    );
    expect(errors.name).toBeUndefined();
    expect(errors.durationMinutes).toBeUndefined();
    expect(errors.price).toBeUndefined();
  });

  it("עדיין מאמת שדה שהוגש — שם ריק נדחה גם ב-update", () => {
    const { errors } = parseTreatmentInput({ name: "  " }, "update");
    expect(errors.name).toBeTruthy();
  });

  it("עדיין מאמת משך שהוגש — מחוץ לטווח נדחה ב-update", () => {
    const { errors } = parseTreatmentInput({ durationMinutes: 999 }, "update");
    expect(errors.durationMinutes).toBeTruthy();
  });

  it("payload ריק ב-update → ללא שגיאות וללא data", () => {
    const { errors, data } = parseTreatmentInput({}, "update");
    expect(isTreatmentValid(errors)).toBe(true);
    expect(data).toEqual({});
  });
});
