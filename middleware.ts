// Gates access to admin screens (task 1.11): /clients, /clients/[id], /calendar, ועוד.
// task 13.1: מגן גם על נתיבי /api (שכבת הגנה שנייה מעבר ל-auth() בכל route).
// Uses lightweight JWT verification (avoids bundling Prisma/bcrypt into the Edge Function).
// אין לייבא כאן את @/lib/auth/auth — רק next-auth/jwt, next/server ו-public-paths.
import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import { isApiPath, isPublicApiPath } from "@/lib/auth/public-paths";

export default async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // נתיבי API ציבוריים (allowlist סגור) עוברים ללא בדיקת session.
  if (isApiPath(pathname) && isPublicApiPath(pathname)) {
    return NextResponse.next();
  }

  // בפרודקשן (HTTPS) Auth.js שומר את עוגיית ה-session בשם
  // "__Secure-authjs.session-token". getToken כברירת מחדל (secureCookie=false)
  // מחפש "authjs.session-token" ללא התחילית — לא מוצא, מחזיר null, וה-middleware
  // מפנה חזרה ל-/login; בעוד עמוד /login (דרך auth()) רואה session תקין ומפנה
  // ל-/dashboard — לולאת הפניות אינסופית שמקפיאה את הדפדפן. העברת secureCookie
  // מיישרת את שם העוגייה ואת ה-salt עם מה שנכתב בעת ההתחברות.
  //
  // ה-try/catch מטפל גם בעוגייה פגומה/שהוצפנה עם AUTH_SECRET אחר
  // ("no matching decryption secret") — מתייחסים אליה כלא-מאומת במקום 500.
  const secureCookie = process.env.NODE_ENV === "production";
  let token = null;
  try {
    token = await getToken({ req, secret: process.env.AUTH_SECRET, secureCookie });
  } catch {
    token = null;
  }

  if (!token) {
    // נתיבי API מחזירים 401 ב-JSON (לא הפניה לדף התחברות).
    if (isApiPath(pathname)) {
      return NextResponse.json({ error: "נדרשת התחברות" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // ה-matcher מכסה את כל /api — ה-allowlist הציבורי מוגדר ב-lib/auth/public-paths.ts בלבד (אין לשכפלו כאן).
    "/api/:path*",
    "/dashboard",
    "/dashboard/:path*",
    "/clients",
    "/clients/:path*",
    "/calendar",
    "/calendar/:path*",
    "/settings",
    "/settings/:path*",
    "/consent-templates",
    "/consent-templates/:path*",
    "/treatments",
    "/treatments/:path*",
    "/tasks",
    "/tasks/:path*",
    "/campaigns",
    "/campaigns/:path*",
  ],
};
