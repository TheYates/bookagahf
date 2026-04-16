import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { sendHubtelSms } from "@/lib/notifications/hubtel"

// Use admin client to bypass RLS — this is a public endpoint (no session yet)
const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Generate a 6-digit OTP and store it in the otp_tokens table
export async function POST(request: Request) {
  const { identifier } = await request.json()

  if (!identifier) {
    return NextResponse.json(
      { error: "Identifier is required" },
      { status: 400 }
    )
  }

  // Look up the profile by x_number or company_number using admin client (bypasses RLS)
  const { data: profile, error } = await adminClient
    .from("profiles")
    .select("id, phone")
    .or(`x_number.eq.${identifier},company_number.eq.${identifier}`)
    .single()

  if (error || !profile) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 })
  }

  if (!profile.phone) {
    return NextResponse.json(
      { error: "No phone number on file for this account" },
      { status: 400 }
    )
  }

  // Generate OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 min

  // Store OTP in otp_tokens using admin client
  const upsertResult = await adminClient.from("otp_tokens").upsert({
    profile_id: profile.id,
    otp,
    expires_at: expiresAt,
  })

  if (upsertResult.error) {
    console.error("[OTP] Failed to store OTP:", upsertResult.error)
  }

  // Send via Hubtel SMS (gracefully skip if credentials are missing)
  let smsSent = false
  try {
    await sendHubtelSms({
      to: profile.phone,
      content: `Your AGAHF verification code is: ${otp}. Valid for 10 minutes.`,
    })
    smsSent = true
  } catch (err) {
    console.warn("[OTP] Hubtel SMS failed:", err)
  }

  // Return a masked version of the phone for the UI
  const masked =
    profile.phone.slice(0, 3) +
    "*".repeat(Math.max(0, profile.phone.length - 5)) +
    profile.phone.slice(-2)

  // In development or mock mode, return the OTP in the response for easy testing
  const isDev = process.env.NODE_ENV === "development"
  const mockOtpEnv = process.env.MOCK_OTP
  const isMockMode = mockOtpEnv === "true" || mockOtpEnv === "1"

  console.log(
    "[OTP] isDev:",
    isDev,
    "isMockMode:",
    isMockMode,
    "smsSent:",
    smsSent,
    "NODE_ENV:",
    process.env.NODE_ENV,
    "MOCK_OTP:",
    mockOtpEnv
  )

  return NextResponse.json({
    message: "OTP sent successfully",
    maskedPhone: masked,
    smsSent,
    ...((isDev || isMockMode) && { devOtp: otp }),
  })
}
