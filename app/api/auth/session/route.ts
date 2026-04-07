import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"

/**
 * Sets a server-side session cookie from access + refresh tokens.
 * Called after OTP verify to bridge the magic link tokens → cookie session.
 */
export async function POST(request: NextRequest) {
  const { access_token, refresh_token } = await request.json()

  if (!access_token || !refresh_token) {
    return NextResponse.json({ error: "Tokens required" }, { status: 400 })
  }

  const response = NextResponse.json({ success: true })

  // Create server client that writes cookies directly to the response
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
            response.cookies.set(name, value, options)
          })
        },
      },
    },
  )

  const { data, error } = await supabase.auth.setSession({
    access_token,
    refresh_token,
  })

  if (error || !data.session) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to set session" },
      { status: 401 },
    )
  }

  return response
}
