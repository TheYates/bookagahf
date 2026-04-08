import { NextResponse } from "next/server"

import { createSupabaseServerClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.from("settings").select("*").single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ settings: data })
}

export async function PATCH(request: Request) {
  const supabase = await createSupabaseServerClient()
  const body = await request.json()

  const { data, error } = await supabase
    .from("settings")
    .update({
      ...(body.booking_buffer_hours !== undefined && { booking_buffer_hours: body.booking_buffer_hours }),
      ...(body.reschedule_style !== undefined && { reschedule_style: body.reschedule_style }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ settings: data })
}
