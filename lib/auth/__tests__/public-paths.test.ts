/**
 * בדיקות יחידה ל-lib/auth/public-paths.ts — משימה 13.1 (SRS §11).
 *
 * המודול טהור (ללא imports) ולכן אין צורך במוקים. הבדיקות מכסות את allowlist
 * הציבורי של /api ואת הזיהוי של נתיבי /api בכלל.
 */
import { describe, it, expect } from "vitest";
import {
  PUBLIC_API_PREFIXES,
  isApiPath,
  isPublicApiPath,
} from "@/lib/auth/public-paths";

describe("PUBLIC_API_PREFIXES", () => {
  it("מכיל בדיוק את ארבעת הפריפיקסים הציבוריים שהוגדרו", () => {
    expect([...PUBLIC_API_PREFIXES]).toEqual([
      "/api/auth/",
      "/api/sign/",
      "/api/whatsapp/webhook",
      "/api/cron/run",
    ]);
  });
});

describe("isPublicApiPath", () => {
  it.each([
    "/api/auth/session",
    "/api/auth/callback/credentials",
    "/api/sign/abc123/submit",
    "/api/whatsapp/webhook",
    "/api/whatsapp/webhook/",
    "/api/cron/run",
    // פריפיקס ללא "/" סופי שווה לנתיב עצמו — לפי כלל משימה 13.1 זה ציבורי (אין handler, ולכן 404)
    "/api/sign",
  ])("מחזיר true עבור נתיב ציבורי: %s", (pathname) => {
    expect(isPublicApiPath(pathname)).toBe(true);
  });

  it.each([
    "/api/clients",
    "/api/whatsapp/templates",
    "/api/whatsapp/webhook-admin",
    "/api/signatures",
    "/api/authx",
    "/api/cron/runner",
    "/api",
  ])("מחזיר false עבור נתיב שאינו ציבורי: %s", (pathname) => {
    expect(isPublicApiPath(pathname)).toBe(false);
  });

  it("מחזיר false עבור נתיבי עמודים (לא API)", () => {
    expect(isPublicApiPath("/clients")).toBe(false);
    expect(isPublicApiPath("/login")).toBe(false);
  });

  it("דורש '/' מוביל — pathname ללא '/' מוביל אינו תואם", () => {
    expect(isPublicApiPath("api/auth/session")).toBe(false);
    expect(isPublicApiPath("api/cron/run")).toBe(false);
  });

  it("אין נרמול לאותיות — '/API/auth/session' אינו ציבורי (רגיש לאותיות)", () => {
    // תיעוד מכוון: לא מבצעים toLowerCase. נתיב בכתב שונה לא יתאים לאלו שברשימה.
    expect(isPublicApiPath("/API/auth/session")).toBe(false);
    expect(isPublicApiPath("/Api/Cron/Run")).toBe(false);
  });
});

describe("isApiPath", () => {
  it.each([
    "/api",
    "/api/",
    "/api/clients",
    "/api/auth/session",
    "/api/sign/abc123/submit",
    "/api/whatsapp/webhook",
  ])("מחזיר true עבור נתיב API: %s", (pathname) => {
    expect(isApiPath(pathname)).toBe(true);
  });

  it.each(["/", "/clients", "/apix", "/api-docs", "/authx", "api/clients"])(
    "מחזיר false עבור נתיב שאינו API: %s",
    (pathname) => {
      expect(isApiPath(pathname)).toBe(false);
    },
  );

  it("'/api' לבד נחשב API (אך אינו ציבורי)", () => {
    expect(isApiPath("/api")).toBe(true);
    expect(isPublicApiPath("/api")).toBe(false);
  });

  it("אין נרמול לאותיות — '/API/clients' אינו API-path לפי הכלל", () => {
    // תיעוד מכוון: הזיהוי רגיש לאותיות, כמו שאר ההשוואות במודול.
    expect(isApiPath("/API/clients")).toBe(false);
  });
});
