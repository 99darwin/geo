import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

// ── Edge-compatible in-memory rate limiter ────────────────────────────────
// Middleware runs in the Edge Runtime where ioredis (Node.js) is unavailable.
// A simple in-memory store is sufficient here — one per isolate.

const ONE_HOUR_MS = 60 * 60 * 1000;
const LOGIN_LIMIT = 10;

interface RateLimitEntry {
  count: number;
  expiresAt: number;
}

const loginAttempts = new Map<string, RateLimitEntry>();

function checkLoginRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);

  if (!entry || entry.expiresAt <= now) {
    loginAttempts.set(ip, { count: 1, expiresAt: now + ONE_HOUR_MS });
    return true;
  }

  entry.count += 1;
  return entry.count <= LOGIN_LIMIT;
}

// Periodic cleanup (non-blocking)
if (typeof setInterval !== "undefined") {
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of loginAttempts) {
      if (entry.expiresAt <= now) loginAttempts.delete(key);
    }
  }, 60_000);
  if (cleanup.unref) cleanup.unref();
}

// ── Middleware ─────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rate limit login attempts by IP (not by email, to prevent targeted lockout DoS)
  if (pathname === "/api/auth/callback/credentials" && request.method === "POST") {
    const ip =
      request.headers.get("x-real-ip") ??
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "anonymous";
    if (!checkLoginRateLimit(ip)) {
      return NextResponse.json(
        { error: "Too many login attempts. Try again later." },
        { status: 429, headers: { "Retry-After": "3600" } }
      );
    }
    return NextResponse.next();
  }

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    console.error("[middleware] NEXTAUTH_SECRET is not set");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const token = await getToken({ req: request, secret });
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
