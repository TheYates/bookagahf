import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"

// Admin client — for DB queries and user management (bypasses RLS)
const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

export async function POST(request: NextRequest) {
  const { identifier, otp, type } = await request.json()

  if (!identifier || !otp) {
    return NextResponse.json(
      { error: "Identifier and OTP are required" },
      { status: 400 },
    )
  }

  // Find the profile using admin client (bypasses RLS)
  const query =
    type === "corporate"
      ? `company_number.eq.${identifier}`
      : `x_number.eq.${identifier}`

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id, role, email, x_number, company_number")
    .or(query)
    .single()

  if (profileError || !profile) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 })
  }

  // Verify OTP
  const { data: token, error: tokenError } = await adminClient
    .from("otp_tokens")
    .select("otp, expires_at")
    .eq("profile_id", profile.id)
    .single()

  if (tokenError || !token) {
    return NextResponse.json(
      { error: "No OTP found. Please request a new one." },
      { status: 400 },
    )
  }

  // Dev mode bypass: accept 123456 as valid OTP without checking expiration or database
  const isDev = process.env.NODE_ENV === "development"
  const isDevOtp = isDev && otp === "123456"

  if (!isDevOtp) {
    if (new Date(token.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "OTP has expired. Please request a new one." },
        { status: 400 },
      )
    }

    if (token.otp !== otp) {
      return NextResponse.json({ error: "Invalid OTP" }, { status: 401 })
    }
  }

  // Clear OTP after successful use (skip in dev mode to allow multiple uses)
  if (!isDevOtp) {
    await adminClient.from("otp_tokens").delete().eq("profile_id", profile.id)
  }

  // Get the profile's full_name for lazy auth user creation
  const { data: fullProfile } = await adminClient
    .from("profiles")
    .select("full_name")
    .eq("id", profile.id)
    .single()

  // Client profiles are imported without auth users.
  // Lazily create an auth user on first login so Supabase sessions work.
  const { data: authUser } = await adminClient.auth.admin.getUserById(
    profile.id,
  )

  let authEmail: string
  if (!authUser?.user) {
    const uniqueEmail = `${crypto.randomUUID()}@client.medbook.internal`
    const { data: newUser, error: createError } =
      await adminClient.auth.admin.createUser({
        id: profile.id,
        email: uniqueEmail,
        email_confirm: true,
        user_metadata: {
          role: profile.role,
          full_name: fullProfile?.full_name ?? "",
        },
        app_metadata: { role: profile.role },
      })
    if (createError || !newUser?.user) {
      console.error("[OTP verify] Failed to create auth user:", createError)
      return NextResponse.json(
        { error: "Failed to create session" },
        { status: 500 },
      )
    }
    authEmail = uniqueEmail
  } else {
    authEmail = authUser.user.email ?? profile.email
  }

  const { data: linkData, error: linkError } =
    await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email: authEmail,
    })

  const tokenHash = linkData?.properties?.hashed_token

  if (linkError || !tokenHash) {
    console.error("[OTP verify] generateLink error:", linkError)
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 },
    )
  }

  const response = NextResponse.json({
    success: true,
    role: profile.role,
  })

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

  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: tokenHash,
  })

  if (verifyError) {
    console.error("[OTP verify] verifyOtp error:", verifyError)
    return NextResponse.json(
      { error: verifyError.message ?? "Failed to establish session" },
      { status: 500 },
    )
  }

  return response
}
