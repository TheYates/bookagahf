import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

/**
 * Returns the days of week a doctor is available (0=Sun, 6=Sat)
 * Used to disable unavailable days in the booking calendar.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Check if doctor has availability toggled off globally
  const { data: settings } = await adminClient
    .from("doctor_settings")
    .select("is_available")
    .eq("doctor_id", id)
    .single()

  if (settings?.is_available === false) {
    return NextResponse.json({
      availableDays: [],
      unavailable: true,
      schedule: [],
    })
  }

  // Get full availability schedule with times
  const { data, error } = await adminClient
    .from("doctor_availability")
    .select("day_of_week, start_time, end_time")
    .eq("doctor_id", id)
    .eq("is_active", true)
    .order("day_of_week")

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const schedule = data ?? []
  const availableDays = [...new Set(schedule.map((r) => r.day_of_week))]

  return NextResponse.json({
    availableDays,
    unavailable: false,
    schedule,
  })
}
