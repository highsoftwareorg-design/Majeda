// Gates access to admin screens (task 1.11): /clients, /clients/[id], /calendar.
// Uses lightweight JWT verification (avoids bundling Prisma/bcrypt into the Edge Function).
import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

export default async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.AUTH_SECRET });

  if (!token) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/clients", "/clients/:path*", "/calendar", "/calendar/:path*"],
};
