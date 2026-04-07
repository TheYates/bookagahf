import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Public endpoint — use admin client to bypass RLS for booking flow
const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

export async function GET() {
  const { data, error } = await adminClient
    .from("specialties")
    .select("id, name, description")
    .order("name")

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ specialties: data })
}
