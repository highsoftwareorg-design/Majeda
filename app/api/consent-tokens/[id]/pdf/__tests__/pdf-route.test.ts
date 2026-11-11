/**
 * בדיקות ל-GET /api/consent-tokens/[id]/pdf — הורדה פרטית של PDF חתום (משימה 11.12, §11).
 *
 * כל התלויות החיצוניות ממוקות — אין גישה אמיתית ל-R2 ולא ל-DB:
 *   - auth() (@/lib/auth/auth)
 *   - prisma.signedConsent.findUnique (@/lib/db/prisma)
 *   - @aws-sdk/client-s3 (S3Client, GetObjectCommand)
 *   - getSignedUrl (@aws-sdk/s3-request-presigner)
 * קונפיגורציית R2 נשלטת דרך משתני סביבה (lib/consent/r2.ts נקרא אמיתי).
 *
 * בודק:
 * 1. אין session → 401 עם הודעת שגיאה בעברית.
 * 2. מאומת אך SignedConsent לא נמצא → 404.
 * 3. pdfStorageKey הוא null → 404 עם הודעה בעברית.
 * 4. pdfStorageKey הוא "mock-storage-key" → 404 עם הודעה בעברית.
 * 5. pdfStorageKey הוא URL מלא (http/https) → 302 הפניה ישירה ל-URL (ללא getSignedUrl).
 * 6. pdfStorageKey הוא מפתח R2 גולמי → 302 הפניה ל-presigned URL (getSignedUrl נקרא).
 * 7. R2 לא מוגדר (חסרים creds) → 500 עם הודעה בעברית, ללא קריסה.
 * 8. כל התגובות נושאות Cache-Control: private, no-store.
 *
 * הרצה: `npx vitest run "app/api/consent-tokens/[id]/pdf/__tests__/pdf-route.test.ts"`
 */

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// מוקים — חייבים לפני ה-imports של המודולים הממוקים
// ---------------------------------------------------------------------------

const { mockAuth, mockFindUnique, mockGetSignedUrl } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockFindUnique: vi.fn(),
  mockGetSignedUrl: vi.fn(),
}));

vi.mock("next/server", () => ({
  NextRequest: class {
    constructor(public url: string) {}
  },
  NextResponse: {
    json: (body: unknown, init?: { status?: number; headers?: Record<string, string> }) => {
      const headers = new Headers(init?.headers);
      return { status: init?.status ?? 200, headers, json: async () => body };
    },
    redirect: (
      url: string | URL,
      init?: { status?: number; headers?: Record<string, string> }
    ) => {
      const headers = new Headers(init?.headers);
      const location = typeof url === "string" ? url : url.toString();
      headers.set("Location", location);
      return { status: init?.status ?? 307, headers, json: async () => ({}) };
    },
  },
}));

vi.mock("@/lib/auth/auth", () => ({
  auth: mockAuth,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    signedConsent: {
      findUnique: mockFindUnique,
    },
  },
}));

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class {
    constructor(public config: unknown) {}
  },
  GetObjectCommand: class {
    constructor(public input: Record<string, unknown>) {}
  },
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: mockGetSignedUrl,
}));

// ---------------------------------------------------------------------------
// Import handler after mocks
// ---------------------------------------------------------------------------

import { GET } from "@/app/api/consent-tokens/[id]/pdf/route";

// ---------------------------------------------------------------------------
// עזרים
// ---------------------------------------------------------------------------

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function callGet(id: string) {
  // _req לא בשימוש ב-handler
  return GET({} as never, makeParams(id));
}

const PRESIGNED_URL =
  "https://acc123.r2.cloudflarestorage.com/majeda-files/consents/client-1/sc-1.pdf?X-Amz-Signature=abc";

const ORIGINAL_ENV = { ...process.env };

function setR2Env() {
  process.env.CLOUDFLARE_R2_ACCOUNT_ID = "acc123";
  process.env.CLOUDFLARE_R2_ACCESS_KEY_ID = "key123";
  process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY = "secret123";
  process.env.CLOUDFLARE_R2_BUCKET_NAME = "majeda-files";
}

function clearR2Env() {
  delete process.env.CLOUDFLARE_R2_ACCOUNT_ID;
  delete process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  delete process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  delete process.env.CLOUDFLARE_R2_BUCKET_NAME;
}

// ---------------------------------------------------------------------------
// בדיקות
// ---------------------------------------------------------------------------

describe("GET /api/consent-tokens/[id]/pdf — משימה 11.12", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // ברירת מחדל: משתמש מאומת, R2 מוגדר, getSignedUrl מחזיר presigned URL
    mockAuth.mockResolvedValue({ user: { id: "u1", role: "admin" } });
    mockGetSignedUrl.mockResolvedValue(PRESIGNED_URL);
    setR2Env();
    // משתיק console.error הצפוי בבדיקות שגיאה
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  // ---- בדיקה 1: אין session → 401 ----
  it("אין session → 401 עם הודעת שגיאה בעברית", async () => {
    mockAuth.mockResolvedValue(null);

    const res = await callGet("sc-1");

    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("נדרשת התחברות");
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    // לא נגעים ב-DB
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  // ---- בדיקה 2: SignedConsent לא נמצא → 404 ----
  it("מאומת אך SignedConsent לא נמצא → 404", async () => {
    mockFindUnique.mockResolvedValue(null);

    const res = await callGet("missing");

    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("טופס ההסכמה לא נמצא");
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mockGetSignedUrl).not.toHaveBeenCalled();
  });

  // ---- בדיקה 3: pdfStorageKey הוא null → 404 ----
  it("pdfStorageKey הוא null → 404 עם הודעה בעברית", async () => {
    mockFindUnique.mockResolvedValue({ id: "sc-1", pdfStorageKey: null });

    const res = await callGet("sc-1");

    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("לא נשמר קובץ PDF עבור טופס זה");
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mockGetSignedUrl).not.toHaveBeenCalled();
  });

  // ---- בדיקה 4: pdfStorageKey הוא "mock-storage-key" → 404 ----
  it('pdfStorageKey הוא "mock-storage-key" → 404 עם הודעה בעברית', async () => {
    mockFindUnique.mockResolvedValue({
      id: "sc-1",
      pdfStorageKey: "mock-storage-key",
    });

    const res = await callGet("sc-1");

    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("לא נשמר קובץ PDF עבור טופס זה");
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mockGetSignedUrl).not.toHaveBeenCalled();
  });

  // ---- בדיקה 5: pdfStorageKey הוא URL מלא → 302 הפניה ישירה ----
  it("pdfStorageKey הוא URL מלא (https) → 302 הפניה ישירה ל-URL, ללא getSignedUrl", async () => {
    const publicUrl = "https://cdn.example.com/consents/client-1/sc-1.pdf";
    mockFindUnique.mockResolvedValue({ id: "sc-1", pdfStorageKey: publicUrl });

    const res = await callGet("sc-1");

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe(publicUrl);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    // legacy URL — לא חותמים מחדש
    expect(mockGetSignedUrl).not.toHaveBeenCalled();
  });

  it("pdfStorageKey הוא URL מלא (http) → 302 הפניה ישירה", async () => {
    const publicUrl = "http://cdn.example.com/consents/client-1/sc-1.pdf";
    mockFindUnique.mockResolvedValue({ id: "sc-1", pdfStorageKey: publicUrl });

    const res = await callGet("sc-1");

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe(publicUrl);
    expect(mockGetSignedUrl).not.toHaveBeenCalled();
  });

  // ---- בדיקה 6: מפתח R2 גולמי → 302 הפניה ל-presigned URL ----
  it("pdfStorageKey הוא מפתח R2 גולמי → 302 הפניה ל-presigned URL (getSignedUrl נקרא)", async () => {
    const rawKey = "consents/client-1/sc-1.pdf";
    mockFindUnique.mockResolvedValue({ id: "sc-1", pdfStorageKey: rawKey });

    const res = await callGet("sc-1");

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe(PRESIGNED_URL);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");

    // getSignedUrl נקרא עם command שמכיל את ה-Bucket וה-Key הנכונים
    expect(mockGetSignedUrl).toHaveBeenCalledOnce();
    const [, command, opts] = mockGetSignedUrl.mock.calls[0];
    expect((command as { input: Record<string, unknown> }).input.Bucket).toBe(
      "majeda-files"
    );
    expect((command as { input: Record<string, unknown> }).input.Key).toBe(rawKey);
    expect((opts as { expiresIn: number }).expiresIn).toBe(60);
  });

  // ---- בדיקה 7: R2 לא מוגדר → 500 ----
  it("R2 לא מוגדר (חסרים creds) → 500 עם הודעה בעברית, ללא קריסה", async () => {
    clearR2Env();
    const rawKey = "consents/client-1/sc-1.pdf";
    mockFindUnique.mockResolvedValue({ id: "sc-1", pdfStorageKey: rawKey });

    const res = await callGet("sc-1");

    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe(
      "אחסון הקבצים אינו מוגדר כראוי. יש לפנות למנהל המערכת"
    );
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    // לא ניסינו לחתום URL ללא קונפיגורציה
    expect(mockGetSignedUrl).not.toHaveBeenCalled();
  });

  // ---- בדיקה 8: שגיאת DB בלתי צפויה → 500 עם Cache-Control ----
  it("שגיאה בלתי צפויה בעת שליפה → 500 עם Cache-Control: private, no-store", async () => {
    mockFindUnique.mockRejectedValue(new Error("db down"));

    const res = await callGet("sc-1");

    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("שגיאה בטעינת הקובץ");
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });
});
