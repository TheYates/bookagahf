import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get("q")?.trim()

  if (!q || q.length < 2) {
    return NextResponse.json({ clients: [] })
  }

  const { data, error } = await adminClient.rpc("search_clients", {
    search_term: q,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ clients: data ?? [] })
}
