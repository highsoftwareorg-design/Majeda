/**
 * בדיקות wiring למשימה 11.10:
 *  - middleware matcher כולל כעת את /dashboard.
 *  - יעד ברירת המחדל אחרי התחברות הוא /dashboard, ו-callbackUrl מפורש גובר.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ROOT = process.cwd();

// --- middleware matcher (קריאת מקור, דטרמיניסטי) ---
describe("middleware matcher includes /dashboard", () => {
  const src = readFileSync(path.join(ROOT, "middleware.ts"), "utf8");

  it('matcher contains "/dashboard"', () => {
    expect(src).toMatch(/matcher:\s*\[[\s\S]*"\/dashboard"[\s\S]*\]/);
  });

  it('matcher contains "/dashboard/:path*"', () => {
    expect(src).toMatch(/"\/dashboard\/:path\*"/);
  });
});

// --- login redirect default (התנהגותי) ---
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));
vi.mock("@/lib/auth/auth", () => ({
  auth: vi.fn(),
  signIn: vi.fn(),
}));

import LoginPage from "@/app/login/page";
import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";

describe("login post-auth default redirect", () => {
  beforeEach(() => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "u1" } } as never);
  });
  afterEach(() => vi.clearAllMocks());

  it("redirects an already-authenticated user to /dashboard by default", async () => {
    await expect(
      LoginPage({ searchParams: Promise.resolve({}) })
    ).rejects.toThrow("REDIRECT:/dashboard");
    expect(vi.mocked(redirect)).toHaveBeenCalledWith("/dashboard");
  });

  it("an explicit callbackUrl overrides the /dashboard default", async () => {
    await expect(
      LoginPage({ searchParams: Promise.resolve({ callbackUrl: "/campaigns" }) })
    ).rejects.toThrow("REDIRECT:/campaigns");
    expect(vi.mocked(redirect)).toHaveBeenCalledWith("/campaigns");
  });
});

// --- signIn redirectTo fallback (קריאת מקור: בתוך server action, לא נגיש להרצה) ---
describe("login signIn redirectTo fallback", () => {
  const src = readFileSync(path.join(ROOT, "app", "login", "page.tsx"), "utf8");

  it('falls back to "/dashboard" when no callbackUrl is submitted', () => {
    expect(src).toMatch(/redirectTo:[\s\S]*target[\s\S]*:\s*"\/dashboard"/);
  });

  it("uses the submitted callbackUrl (target) when present", () => {
    expect(src).toMatch(/typeof target === "string" && target \? target : "\/dashboard"/);
  });
});
