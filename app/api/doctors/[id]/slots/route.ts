import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Public endpoint — use admin client to bypass RLS for booking flow
const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

/**
 * Returns available time slots for a doctor on a given date.
 * Query params: date (YYYY-MM-DD)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const dateStr = searchParams.get("date")

  if (!dateStr) {
    return NextResponse.json({ error: "date param required" }, { status: 400 })
  }

  const date = new Date(dateStr)
  const dayOfWeek = date.getDay() // 0=Sun, 6=Sat

  // Get doctor availability for this day
  const { data: avail, error: availError } = await adminClient
    .from("doctor_availability")
    .select("start_time, end_time")
    .eq("doctor_id", id)
    .eq("day_of_week", dayOfWeek)
    .eq("is_active", true)

  if (availError)
    return NextResponse.json({ error: availError.message }, { status: 400 })
  if (!avail || avail.length === 0) {
    return NextResponse.json({ slots: [] })
  }

  // Get booking buffer and appointment duration from settings
  const { data: settings } = await adminClient
    .from("settings")
    .select("booking_buffer_hours, appointment_duration")
    .single()

  const bufferHours = settings?.booking_buffer_hours ?? 2
  const appointmentDuration = settings?.appointment_duration ?? 30
  const durationMs = appointmentDuration * 60 * 1000
  const now = new Date()
  const bufferMs = bufferHours * 60 * 60 * 1000

  // Get existing appointments for this doctor on this date
  const dayStart = new Date(`${dateStr}T00:00:00`)
  const dayEnd = new Date(`${dateStr}T23:59:59`)

  const { data: existing } = await adminClient
    .from("appointments")
    .select("scheduled_at")
    .eq("doctor_id", id)
    .gte("scheduled_at", dayStart.toISOString())
    .lte("scheduled_at", dayEnd.toISOString())
    .in("status", ["scheduled", "rescheduled"])

  const bookedTimes = new Set(
    (existing ?? []).map((a) => {
      const d = new Date(a.scheduled_at)
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
    })
  )

  // Generate slots within availability windows using configured duration
  const slots: string[] = []
  const bookedSlots: string[] = []
  for (const window of avail) {
    const [startH, startM] = window.start_time.split(":").map(Number)
    const [endH, endM] = window.end_time.split(":").map(Number)

    let cursor = new Date(date)
    cursor.setHours(startH, startM, 0, 0)

    const endTime = new Date(date)
    endTime.setHours(endH, endM, 0, 0)

    while (cursor < endTime) {
      const slotLabel = `${String(cursor.getHours()).padStart(2, "0")}:${String(cursor.getMinutes()).padStart(2, "0")}`
      const slotDateTime = new Date(cursor)

      // Skip if inside buffer window or already booked
      if (
        slotDateTime.getTime() - now.getTime() > bufferMs &&
        !bookedTimes.has(slotLabel)
      ) {
        slots.push(slotLabel)
      } else {
        bookedSlots.push(slotLabel)
      }

      cursor = new Date(cursor.getTime() + durationMs)
    }
  }

  return NextResponse.json({ slots, bookedSlots })
}
