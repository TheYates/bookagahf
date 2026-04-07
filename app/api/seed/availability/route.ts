import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

/**
 * ONE-TIME seed route — seeds default availability for all doctors.
 * POST /api/seed/availability  { "secret": "<SEED_SECRET>" }
 *
 * Default schedule:
 * Mon-Fri: 08:00 - 17:00
 * Saturday: 09:00 - 13:00
 * Sunday: closed
 */

// Mon=1, Tue=2, Wed=3, Thu=4, Fri=5, Sat=6
const DEFAULT_AVAILABILITY = [
  { day_of_week: 1, start_time: "08:00", end_time: "17:00" }, // Monday
  { day_of_week: 2, start_time: "08:00", end_time: "17:00" }, // Tuesday
  { day_of_week: 3, start_time: "08:00", end_time: "17:00" }, // Wednesday
  { day_of_week: 4, start_time: "08:00", end_time: "17:00" }, // Thursday
  { day_of_week: 5, start_time: "08:00", end_time: "17:00" }, // Friday
  { day_of_week: 6, start_time: "09:00", end_time: "13:00" }, // Saturday
]

// Some doctors get custom schedules for variety
const CUSTOM_AVAILABILITY: Record<string, typeof DEFAULT_AVAILABILITY> = {
  "dr.darko": [
    { day_of_week: 1, start_time: "09:00", end_time: "16:00" },
    { day_of_week: 2, start_time: "09:00", end_time: "16:00" },
    { day_of_week: 3, start_time: "09:00", end_time: "16:00" },
    { day_of_week: 4, start_time: "09:00", end_time: "16:00" },
    { day_of_week: 5, start_time: "09:00", end_time: "13:00" },
  ],
  "dr.frimpong": [
    { day_of_week: 1, start_time: "07:00", end_time: "15:00" },
    { day_of_week: 2, start_time: "07:00", end_time: "15:00" },
    { day_of_week: 3, start_time: "07:00", end_time: "15:00" },
    { day_of_week: 4, start_time: "07:00", end_time: "15:00" },
    { day_of_week: 5, start_time: "07:00", end_time: "15:00" },
  ],
  "dr.adjei": [
    { day_of_week: 2, start_time: "10:00", end_time: "18:00" },
    { day_of_week: 3, start_time: "10:00", end_time: "18:00" },
    { day_of_week: 4, start_time: "10:00", end_time: "18:00" },
    { day_of_week: 5, start_time: "10:00", end_time: "18:00" },
    { day_of_week: 6, start_time: "10:00", end_time: "14:00" },
  ],
}

export async function POST(request: Request) {
  try {
    const { secret } = await request.json()

    if (!secret || secret !== process.env.SEED_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    // Get all doctors with their usernames (email prefix)
    const { data: doctors, error } = await adminClient
      .from("profiles")
      .select("id, email")
      .eq("role", "doctor")

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    const results: { doctor: string; status: string; slots: number }[] = []

    for (const doctor of doctors ?? []) {
      // Extract username from email e.g. dr.asare@medbook.internal → dr.asare
      const username = doctor.email?.split("@")[0] ?? ""

      // Pick custom or default schedule
      const schedule = CUSTOM_AVAILABILITY[username] ?? DEFAULT_AVAILABILITY

      // Delete existing availability for clean re-seed
      await adminClient
        .from("doctor_availability")
        .delete()
        .eq("doctor_id", doctor.id)

      // Insert new slots
      const { error: insertError } = await adminClient
        .from("doctor_availability")
        .insert(
          schedule.map((slot) => ({
            doctor_id: doctor.id,
            day_of_week: slot.day_of_week,
            start_time: slot.start_time,
            end_time: slot.end_time,
            is_active: true,
          })),
        )

      results.push({
        doctor: username,
        status: insertError ? `failed: ${insertError.message}` : "seeded",
        slots: insertError ? 0 : schedule.length,
      })
    }

    const seeded = results.filter((r) => r.status === "seeded").length
    const failed = results.filter((r) => r.status.startsWith("failed")).length

    return NextResponse.json({
      message: `Done. Seeded: ${seeded} doctors, Failed: ${failed}`,
      results,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unexpected error" },
      { status: 500 },
    )
  }
}
