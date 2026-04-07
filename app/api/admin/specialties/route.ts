import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.from("specialties").select("*").order("name")
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ specialties: data })
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()
  const { name, description } = await request.json()
  const { data, error } = await supabase
    .from("specialties")
    .insert({ name, description })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ specialty: data })
}

export async function DELETE(request: Request) {
  const supabase = await createSupabaseServerClient()
  const { id } = await request.json()
  const { error } = await supabase.from("specialties").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
