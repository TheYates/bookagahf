import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { notifyAppointmentEvent } from "@/lib/notifications/send"

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from("appointments")
    .select("*, specialties(name), profiles!appointments_doctor_id_fkey(full_name)")
    .order("scheduled_at", { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ appointments: data })
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()
  const body = await request.json()

  // Booking buffer check
  const { data: settings } = await supabase
    .from("settings")
    .select("booking_buffer_hours")
    .single()

  const scheduledAt = new Date(body.scheduled_at)
  if (settings?.booking_buffer_hours) {
    const minDate = new Date(
      Date.now() + settings.booking_buffer_hours * 60 * 60 * 1000,
    )
    if (scheduledAt < minDate) {
      return NextResponse.json(
        { error: `Appointments must be booked at least ${settings.booking_buffer_hours} hour(s) in advance.` },
        { status: 400 },
      )
    }
  }

  const { data, error } = await supabase
    .from("appointments")
    .insert({ ...body, status: "scheduled" })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // Fetch doctor name for notification
  const { data: doctorProfile } = await adminClient
    .from("profiles")
    .select("full_name")
    .eq("id", data.doctor_id)
    .single()

  // Fire notifications (non-blocking)
  notifyAppointmentEvent({
    supabase,
    appointmentId: data.id,
    patientName: data.patient_name,
    doctorName: doctorProfile?.full_name ?? "Doctor",
    scheduledAt: data.scheduled_at,
    status: "scheduled",
    contactPhone: data.contact_phone ?? null,
    clientUserId: data.created_by ?? null,
    doctorUserId: data.doctor_id,
  }).catch((err) => console.error("[notify] booking:", err))

  return NextResponse.json({ appointment: data })
}
