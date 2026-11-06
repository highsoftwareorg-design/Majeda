// Gates access to admin screens (task 1.11): /clients, /clients/[id], /calendar.
// The public landing page ("/") and auth routes remain accessible without login.
// No role-based enforcement here yet — only "is logged in or not" (SRS §11.1 groundwork).
import { auth } from "@/lib/auth/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;

  if (!isLoggedIn) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/clients", "/clients/:path*", "/calendar", "/calendar/:path*"],
};
