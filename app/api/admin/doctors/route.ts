import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

export async function GET() {
  const { data, error } = await adminClient
    .from("profiles")
    .select(`
      id, full_name, email, phone, is_active,
      doctor_settings(is_available),
      doctor_specialties(specialty_id, specialties(name))
    `)
    .eq("role", "doctor")
    .order("full_name")

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ doctors: data })
}

export async function POST(request: Request) {
  const body = await request.json()
  const { full_name, email, password, phone, specialty_ids } = body

  // Create auth user
  const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
    email: `${email}@medbook.internal`,
    password,
    email_confirm: true,
    user_metadata: { role: "doctor", full_name },
    app_metadata: { role: "doctor" },
  })

  if (authError || !authUser.user) {
    return NextResponse.json({ error: authError?.message ?? "Failed to create user" }, { status: 400 })
  }

  const userId = authUser.user.id

  // Create profile
  await adminClient.from("profiles").insert({
    id: userId,
    role: "doctor",
    full_name,
    email: `${email}@medbook.internal`,
    phone: phone ?? null,
    is_active: true,
  })

  // Create doctor settings
  await adminClient.from("doctor_settings").insert({ doctor_id: userId, is_available: true })

  // Link specialties
  if (specialty_ids?.length) {
    await adminClient.from("doctor_specialties").insert(
      specialty_ids.map((sid: string) => ({ doctor_id: userId, specialty_id: sid })),
    )
  }

  return NextResponse.json({ id: userId, message: "Doctor created successfully." })
}
