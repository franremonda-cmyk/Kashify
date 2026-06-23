import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getSession reads from cookie — no network round-trip. Sufficient for redirect guard;
  // actual RLS enforces real security on every Supabase query.
  const { data: { session } } = await supabase.auth.getSession();
  const { pathname } = request.nextUrl;

  // Public routes — never gate these behind auth (incl. social/SEO crawlers)
  const isPublic =
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/onboarding") ||
    pathname === "/opengraph-image" ||
    pathname === "/twitter-image" ||
    pathname === "/icon.svg" ||
    pathname.startsWith("/apple-icon") ||
    pathname === "/logo-mark.svg" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml";

  if (isPublic) {
    return supabaseResponse;
  }

  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon|opengraph-image|twitter-image|logo-mark.svg|icons|manifest.json|robots.txt|sitemap.xml).*)"],
};
