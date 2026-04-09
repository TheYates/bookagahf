import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

export async function GET() {
  const { data, error } = await adminClient
    .from("specialties")
    .select("*")
    .order("name")

  if (error) {
    console.error("Error fetching departments:", error)
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const departments = data.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    slots_per_day: 10,
    working_days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
    working_hours: { start: "08:00", end: "17:00" },
    is_active: true,
  }))

  return NextResponse.json({ success: true, data: departments })
}