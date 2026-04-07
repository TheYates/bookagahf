import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { notifyAppointmentEvent } from "@/lib/notifications/send"

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const body = await request.json()

  // If rescheduling, enforce booking buffer
  if (body.scheduled_at) {
    const { data: settings } = await supabase
      .from("settings")
      .select("booking_buffer_hours")
      .single()

    if (settings?.booking_buffer_hours) {
      const minDate = new Date(
        Date.now() + settings.booking_buffer_hours * 60 * 60 * 1000,
      )
      if (new Date(body.scheduled_at) < minDate) {
        return NextResponse.json(
          { error: `Appointments must be rescheduled at least ${settings.booking_buffer_hours} hour(s) in advance.` },
          { status: 400 },
        )
      }
    }
  }

  const { data, error } = await supabase
    .from("appointments")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // Fetch doctor name
  const { data: doctorProfile } = await adminClient
    .from("profiles")
    .select("full_name")
    .eq("id", data.doctor_id)
    .single()

  // Fire all notifications (SMS + in-app + push) non-blocking
  notifyAppointmentEvent({
    supabase,
    appointmentId: data.id,
    patientName: data.patient_name,
    doctorName: doctorProfile?.full_name ?? "Doctor",
    scheduledAt: data.scheduled_at,
    status: data.status,
    contactPhone: data.contact_phone ?? null,
    clientUserId: data.created_by ?? null,
    doctorUserId: data.doctor_id,
  }).catch((err) => console.error("[notify] patch:", err))

  return NextResponse.json({ appointment: data })
}
