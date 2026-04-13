import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { notifyAppointmentEvent } from "@/lib/notifications/send"

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get("startDate")
  const endDate = searchParams.get("endDate")

  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const role = user?.app_metadata?.role as string | undefined

  let query = adminClient
    .from("appointments")
    .select(
      "*, specialties(name), profiles!appointments_doctor_id_fkey(full_name)"
    )
    .order("scheduled_at", { ascending: true })

  if (startDate) {
    query = query.gte("scheduled_at", startDate)
  }
  if (endDate) {
    query = query.lte("scheduled_at", endDate + "T23:59:59")
  }

  if (role !== "admin") {
    if (!user) {
      return NextResponse.json({ appointments: [] })
    }
    query = query.or(`created_by.eq.${user.id},doctor_id.eq.${user.id}`)
  }

  const { data, error } = await query

  if (error) {
    console.error("[appointments GET] error:", error.message)
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ appointments: data })
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()
  const body = await request.json()

  // Booking buffer check — use admin client to bypass RLS on settings table
  const { data: settings } = await adminClient
    .from("settings")
    .select("booking_buffer_hours")
    .single()

  const scheduledAt = new Date(body.scheduled_at)
  if (settings?.booking_buffer_hours) {
    const minDate = new Date(
      Date.now() + settings.booking_buffer_hours * 60 * 60 * 1000
    )
    if (scheduledAt < minDate) {
      return NextResponse.json(
        {
          error: `Appointments must be booked at least ${settings.booking_buffer_hours} hour(s) in advance.`,
        },
        { status: 400 }
      )
    }
  }

  // Get the current user to set created_by (required for RLS)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from("appointments")
    .insert({
      ...body,
      status: "scheduled",
      created_by: user?.id ?? body.created_by,
    })
    .select()
    .single()

  if (error) {
    console.error(
      "[appointments POST] insert error:",
      error.message,
      error.details,
      error.hint
    )
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
