import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

export async function POST() {
  try {
    // Check if column already exists
    const { data: existing } = await adminClient
      .from("settings")
      .select("appointment_duration")
      .eq("id", 1)
      .single()

    if (existing && existing.appointment_duration !== null) {
      return NextResponse.json({ success: true, message: "Column already exists" })
    }

    // Try to update with default value - this will fail if column doesn't exist
    const { error: updateError } = await adminClient
      .from("settings")
      .update({ appointment_duration: 30 })
      .eq("id", 1)

    if (updateError) {
      // Column doesn't exist, try to add it via raw SQL
      // First check if we can use postgrest
      const { error: alterError } = await adminClient
        .from("settings")
        .update({ appointment_duration: 30 })
        .eq("id", 1)

      return NextResponse.json({ error: "Column does not exist. Please run: ALTER TABLE settings ADD COLUMN appointment_duration int DEFAULT 30;" }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ 
      error: error.message || "Migration failed. Please run this SQL manually:\n\nALTER TABLE public.settings ADD COLUMN IF NOT EXISTS appointment_duration int DEFAULT 30;"
    }, { status: 400 })
  }
}