/**
 * lib/followups/__tests__/email.test.ts
 * Task 8.7 — בדיקות ל-sendDailyAdminEmail (FR-FU-07).
 *
 * בודק:
 * 1. עם 3 משימות חדשות → console.info נקרא עם הודעה המזכירה "3".
 * 2. עם 0 משימות → פונקציה מסיימת מוקדם, console.info לא נקרא.
 * 3. ההודעה מכילה את מספר המשימות בכותרת.
 *
 * הרצה: `npx vitest run lib/followups/__tests__/email.test.ts`
 */

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { sendDailyAdminEmail } from "@/lib/followups/email";

describe("sendDailyAdminEmail — מייל סיכום יומי לאדמין (משימה 8.7)", () => {
  let infoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // עוצר console.info כדי שלא יזהם את פלט הבדיקות
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    // מנקה משתני סביבה רלוונטיים
    delete process.env.EMAIL_PROVIDER_API_KEY;
    // מגדיר WHATSAPP_MODE=mock (ברירת מחדל במצב בדיקות)
    process.env.WHATSAPP_MODE = "mock";
  });

  afterEach(() => {
    infoSpy.mockRestore();
    delete process.env.WHATSAPP_MODE;
  });

  // ════════════════════════════════════════════════════════
  // 1. 3 משימות חדשות — console.info נקרא
  // ════════════════════════════════════════════════════════

  it("עם 3 משימות חדשות → console.info נקרא", async () => {
    await sendDailyAdminEmail(3);

    expect(infoSpy).toHaveBeenCalled();
  });

  it("עם 3 משימות חדשות → ההודעה מזכירה את המספר 3", async () => {
    await sendDailyAdminEmail(3);

    expect(infoSpy).toHaveBeenCalled();
    // בודק שאחד מהארגומנטים מכיל "3"
    const allArgs = infoSpy.mock.calls.flat().join(" ");
    expect(allArgs).toMatch(/3/);
  });

  it("עם 3 משימות חדשות → הכותרת מכילה 'משימות'", async () => {
    await sendDailyAdminEmail(3);

    const allArgs = infoSpy.mock.calls.flat().join(" ");
    expect(allArgs).toContain("משימות");
  });

  // ════════════════════════════════════════════════════════
  // 2. 0 משימות — פונקציה מסיימת מוקדם
  // ════════════════════════════════════════════════════════

  it("עם 0 משימות → console.info לא נקרא (מסיים מוקדם)", async () => {
    await sendDailyAdminEmail(0);

    expect(infoSpy).not.toHaveBeenCalled();
  });

  it("עם 0 משימות → הפונקציה מסיימת בלי לזרוק שגיאה", async () => {
    await expect(sendDailyAdminEmail(0)).resolves.toBeUndefined();
  });

  // ════════════════════════════════════════════════════════
  // 3. ערכי גבול נוספים
  // ════════════════════════════════════════════════════════

  it("עם 1 משימה → console.info נקרא עם '1' בהודעה", async () => {
    await sendDailyAdminEmail(1);

    expect(infoSpy).toHaveBeenCalled();
    const allArgs = infoSpy.mock.calls.flat().join(" ");
    expect(allArgs).toMatch(/1/);
  });

  it("עם 10 משימות → console.info נקרא עם '10' בהודעה", async () => {
    await sendDailyAdminEmail(10);

    expect(infoSpy).toHaveBeenCalled();
    const allArgs = infoSpy.mock.calls.flat().join(" ");
    expect(allArgs).toMatch(/10/);
  });
});
