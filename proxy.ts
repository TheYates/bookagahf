import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"

// Routes that require authentication and specific roles
const ROLE_ROUTES: Record<string, string[]> = {
  "/admin": ["admin"],
  "/doctor": ["doctor"],
  "/client": ["client"],
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const response = NextResponse.next({
    request: { headers: request.headers },
  })

  // Find which protected prefix this path falls under
  const matchedPrefix = Object.keys(ROLE_ROUTES).find((prefix) =>
    pathname === prefix || pathname.startsWith(prefix + "/"),
  )

  // Not a protected route — allow through
  if (!matchedPrefix) return response

  const allowedRoles = ROLE_ROUTES[matchedPrefix]

  // Create Supabase client with cookie access
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    },
  )

  // Get current session
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Not logged in — redirect to login
  if (!user) {
    const loginUrl = new URL("/", request.url)
    loginUrl.searchParams.set("redirect", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Get role from app_metadata (set server-side during user creation)
  const role = (user.app_metadata?.role as string) ?? null

  // Role doesn't match — redirect to correct portal or login
  if (!role || !allowedRoles.includes(role)) {
    if (role === "admin") return NextResponse.redirect(new URL("/admin", request.url))
    if (role === "doctor") return NextResponse.redirect(new URL("/doctor", request.url))
    if (role === "client") return NextResponse.redirect(new URL("/client", request.url))
    return NextResponse.redirect(new URL("/", request.url))
  }

  return response
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/doctor/:path*",
    "/client/:path*",
    // exclude auth callback from protection
    // "/auth/:path*" is intentionally NOT in this list
  ],
}
