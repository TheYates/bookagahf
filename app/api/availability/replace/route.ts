import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

/**
 * Replaces all availability slots for the current doctor.
 * Body: array of { day_of_week, start_time, end_time, is_active }
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()
  const body = await request.json()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Delete all existing slots for this doctor
  await supabase.from("doctor_availability").delete().eq("doctor_id", user.id)

  if (!body || body.length === 0) {
    return NextResponse.json({ availability: [] })
  }

  // Insert new slots
  const { data, error } = await supabase
    .from("doctor_availability")
    .insert(
      body.map((s: any) => ({
        doctor_id: user.id,
        day_of_week: s.day_of_week,
        start_time: s.start_time,
        end_time: s.end_time,
        is_active: s.is_active ?? true,
      })),
    )
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ availability: data })
}
