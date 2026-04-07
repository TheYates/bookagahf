import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createSupabaseServerClient()

  const [appointmentsRes, profilesRes] = await Promise.all([
    supabase.from("appointments").select("id, status, patient_name, scheduled_at"),
    supabase.from("profiles").select("id, role"),
  ])

  const appointments = appointmentsRes.data ?? []
  const profiles = profilesRes.data ?? []

  const stats = {
    total: appointments.length,
    scheduled: appointments.filter((a) => a.status === "scheduled").length,
    completed: appointments.filter((a) => a.status === "completed").length,
    cancelled: appointments.filter((a) => a.status === "cancelled").length,
    rescheduled: appointments.filter((a) => a.status === "rescheduled").length,
    doctors: profiles.filter((p) => p.role === "doctor").length,
    clients: profiles.filter((p) => p.role === "client").length,
  }

  const recentAppointments = [...appointments]
    .sort(
      (a, b) =>
        new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime(),
    )
    .slice(0, 10)

  return NextResponse.json({ stats, recentAppointments })
}
