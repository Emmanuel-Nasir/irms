import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Runs before every page and API request.
// 1) Blocks requests that change data (POST, PUT, PATCH, DELETE) when they come from
//    another website. Stops a page elsewhere from acting with a signed-in user's account.
// 2) Sends anyone without a session cookie straight to sign in when they open the dashboard.
//    (The API checks the session properly on every request; this just avoids a blank page.)

const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/") && UNSAFE.has(request.method)) {
    const origin = request.headers.get("origin");
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    if (origin && host) {
      let originHost = "";
      try {
        originHost = new URL(origin).host;
      } catch {}
      if (originHost !== host) {
        return NextResponse.json({ error: "Request blocked" }, { status: 403 });
      }
    }
  }

  if (pathname.startsWith("/dashboard") && !request.cookies.get("token")) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*", "/dashboard/:path*"],
};
