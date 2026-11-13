// task 13.7 (SRS §11): שומר-סף סטטי — כל handler תחת app/api שאינו ב-allowlist הציבורי חייב לקרוא ל-auth().
// בדיקה טקסטואלית בלבד (Node fs + path). אין import של מודולי route — כך אין צורך ב-DB/Edge/Next runtime.

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { isPublicApiPath } from "@/lib/auth/public-paths";

// app/api/__tests__ -> app/api
const API_DIR = path.resolve(__dirname, "..");
// app/api -> repo root
const REPO_ROOT = path.resolve(API_DIR, "..", "..");

const AUTH_CALL = "await auth()";
const AUTH_IMPORT_RE = /import\s*\{\s*auth\s*\}\s*from\s*["']@\/lib\/auth\/auth["']/;
// export async function GET(...) — ותומך גם בצורת `export const GET =` (אם תופיע בעתיד)
const HANDLER_RE = /export\s+(?:async\s+function|function|const)\s+(GET|POST|PATCH|PUT|DELETE)\b/g;

interface RouteEntry {
  file: string;
  rel: string;
  pathname: string;
  isPublic: boolean;
  src: string;
}

function collectRouteFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectRouteFiles(full));
    } else if (entry.isFile() && entry.name === "route.ts") {
      out.push(full);
    }
  }
  return out;
}

/** app/api/clients/[id]/route.ts -> /api/clients/[id] (סלאשים קדימה בלבד) */
function toPathname(file: string): string {
  const relDir = path.relative(API_DIR, path.dirname(file));
  const segments = relDir.split(/[\\/]/).filter((s) => s.length > 0);
  return ["/api", ...segments].join("/");
}

function countToken(src: string, token: string): number {
  return src.split(token).length - 1;
}

interface Handler {
  name: string;
  start: number;
}

function findHandlers(src: string): Handler[] {
  const handlers: Handler[] = [];
  for (const match of src.matchAll(HANDLER_RE)) {
    handlers.push({ name: match[1], start: match.index ?? 0 });
  }
  return handlers;
}

/** מחזיר רשימת בעיות (בעברית) לקובץ מוגן; רשימה ריקה = תקין. */
function checkGuarded(entry: RouteEntry): string[] {
  const problems: string[] = [];
  const handlers = findHandlers(entry.src);
  const authCalls = countToken(entry.src, AUTH_CALL);

  if (handlers.length === 0) {
    problems.push("לא נמצא אף handler (GET/POST/PATCH/PUT/DELETE) בקובץ — בדקו את הקובץ ידנית");
  }
  if (!AUTH_IMPORT_RE.test(entry.src)) {
    problems.push('חסר import { auth } from "@/lib/auth/auth"');
  }
  if (authCalls < handlers.length) {
    problems.push(
      `מספר הקריאות ל-await auth() (${authCalls}) קטן ממספר ה-handlers (${handlers.length})`,
    );
  }

  // בדיקה לכל handler בנפרד: הגוף (מתחילת ההגדרה ועד ה-handler הבא/סוף הקובץ) חייב לכלול await auth()
  handlers.forEach((handler, i) => {
    const end = i + 1 < handlers.length ? handlers[i + 1].start : entry.src.length;
    const body = entry.src.slice(handler.start, end);
    if (!body.includes(AUTH_CALL)) {
      problems.push(`חסר await auth() ב-handler ${handler.name}`);
    }
  });

  return problems;
}

/** מחזיר רשימת בעיות לקובץ ציבורי: אסור שיופיע await auth(). */
function checkPublic(entry: RouteEntry): string[] {
  const count = countToken(entry.src, AUTH_CALL);
  return count === 0
    ? []
    : [`נתיב ציבורי (allowlist) אסור שיכיל await auth() — נמצאו ${count} הופעות`];
}

const entries: RouteEntry[] = collectRouteFiles(API_DIR)
  .sort()
  .map((file) => {
    const pathname = toPathname(file);
    return {
      file,
      rel: path.relative(REPO_ROOT, file).split(path.sep).join("/"),
      pathname,
      isPublic: isPublicApiPath(pathname),
      src: fs.readFileSync(file, "utf8"),
    };
  });

const publicEntries = entries.filter((e) => e.isPublic);
const guardedEntries = entries.filter((e) => !e.isPublic);

describe("auth-coverage: כל נתיבי app/api מאומתים (SRS §11)", () => {
  it("סריקת הקבצים מוצאת route.ts (לא ריקה) כולל נתיב מוגן וציבורי מוכרים", () => {
    const pathnames = entries.map((e) => e.pathname);
    expect(entries.length, "לא נמצאו קבצי route.ts תחת app/api").toBeGreaterThan(0);
    expect(pathnames, "חסר נתיב מוגן מוכר: /api/clients").toContain("/api/clients");
    expect(pathnames, "חסר נתיב ציבורי מוכר: /api/cron/run").toContain("/api/cron/run");
    expect(publicEntries.map((e) => e.pathname)).toContain("/api/cron/run");
    expect(guardedEntries.map((e) => e.pathname)).toContain("/api/clients");
  });

  it("נתיבי allowlist הציבוריים מזוהים כציבוריים (auth / sign / webhook / cron)", () => {
    expect(isPublicApiPath("/api/auth/[...nextauth]")).toBe(true);
    expect(isPublicApiPath("/api/sign/[token]/submit")).toBe(true);
    expect(isPublicApiPath("/api/whatsapp/webhook")).toBe(true);
    expect(isPublicApiPath("/api/cron/run")).toBe(true);
    expect(isPublicApiPath("/api/clients")).toBe(false);
  });

  it.each(guardedEntries.map((e) => ({ rel: e.rel, entry: e })))(
    "נתיב מוגן: $rel מכיל await auth() לכל handler ו-import של auth",
    ({ rel, entry }) => {
      const problems = checkGuarded(entry);
      expect(
        problems,
        `בקובץ ${rel} חסרה הגנת אימות (auth):\n${problems.join("\n")}`,
      ).toEqual([]);
    },
  );

  it.each(publicEntries.map((e) => ({ rel: e.rel, entry: e })))(
    "נתיב ציבורי: $rel אינו מכיל await auth() (allowlist)",
    ({ rel, entry }) => {
      const problems = checkPublic(entry);
      expect(
        problems,
        `הקובץ ${rel} מסומן כציבורי אך מכיל await auth():\n${problems.join("\n")}`,
      ).toEqual([]);
    },
  );
});
