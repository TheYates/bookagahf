import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Use admin client — reading doctor profiles is needed for booking (public operation)
const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const specialtyId = searchParams.get("specialty_id")

  const { data, error } = await adminClient
    .from("profiles")
    .select(`
      id,
      full_name,
      doctor_settings(is_available),
      doctor_specialties(specialty_id)
    `)
    .eq("role", "doctor")
    .eq("is_active", true)
    .order("full_name")

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  let doctors = data ?? []

  // Filter by specialty if provided
  if (specialtyId) {
    doctors = doctors.filter((d) =>
      d.doctor_specialties?.some((s: any) => s.specialty_id === specialtyId),
    )
  }

  // Only return available doctors
  doctors = doctors.filter((d) => d.doctor_settings?.[0]?.is_available !== false)

  return NextResponse.json({ doctors })
}
