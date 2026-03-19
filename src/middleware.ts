import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "./lib/rate-limit";

const ONE_HOUR_MS = 60 * 60 * 1000;
const loginRateLimit = rateLimit({ interval: ONE_HOUR_MS, limit: 10 });

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rate limit login attempts by IP (not by email, to prevent targeted lockout DoS)
  if (pathname === "/api/auth/callback/credentials" && request.method === "POST") {
    const ip =
      request.headers.get("x-real-ip") ??
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "anonymous";
    const { success } = await loginRateLimit(`login:${ip}`);
    if (!success) {
      return NextResponse.json(
        { error: "Too many login attempts. Try again later." },
        { status: 429, headers: { "Retry-After": "3600" } }
      );
    }
    return NextResponse.next();
  }

  const token = await getToken({ req: request });
  const isApiRoute = pathname.startsWith("/api/");

  if (!token) {
    if (isApiRoute) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", request.url);
    return NextResponse.redirect(loginUrl);
  }

  const isAdminRoute =
    pathname.startsWith("/admin") || pathname.startsWith("/api/admin");

  if (isAdminRoute && token.role !== "admin") {
    if (isApiRoute) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/dashboard/:path*",
    "/admin/:path*",
    "/api/admin/:path*",
    "/api/auth/callback/credentials",
  ],
};
