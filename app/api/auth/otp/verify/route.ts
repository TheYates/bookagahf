import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Admin client — for DB queries and user management (bypasses RLS)
const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(request: Request) {
  const { identifier, otp, type } = await request.json()

  if (!identifier || !otp) {
    return NextResponse.json(
      { error: "Identifier and OTP are required" },
      { status: 400 }
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
      { status: 400 }
    )
  }

  // Dev mode bypass: accept 123456 as valid OTP without checking expiration or database
  const isDev = process.env.NODE_ENV === "development"
  const isDevOtp = isDev && otp === "123456"

  if (!isDevOtp) {
    if (new Date(token.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "OTP has expired. Please request a new one." },
        { status: 400 }
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

  // Generate a magic link and return the action_link for the browser to follow
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

  // Get the internal auth email from the auth user (not the contact email in profiles)
  const { data: authUser } = await adminClient.auth.admin.getUserById(
    profile.id
  )
  const authEmail = authUser?.user?.email ?? profile.email

  const { data: linkData, error: linkError } =
    await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email: authEmail,
      options: { redirectTo: `${appUrl}/auth/callback?redirect_to=/client` },
    })

  if (linkError || !linkData?.properties?.action_link) {
    console.error("[OTP verify] generateLink error:", linkError)
    return NextResponse.json(
      { error: "Failed to create session link" },
      { status: 500 }
    )
  }

  // Return the full action link — browser will navigate to it to get a real session
  return NextResponse.json({
    success: true,
    role: profile.role,
    actionLink: linkData.properties.action_link,
  })
}
