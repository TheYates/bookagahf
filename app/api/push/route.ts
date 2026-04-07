import { NextResponse } from "next/server"

import { createSupabaseServerClient } from "@/lib/supabase/server"
import { getVapidPublicKey } from "@/lib/notifications/webpush"

export async function GET() {
  return NextResponse.json({ publicKey: getVapidPublicKey() })
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()
  const body = await request.json()

  const { data, error } = await supabase
    .from("push_subscriptions")
    .insert(body)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ subscription: data })
}
