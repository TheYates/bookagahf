import { NextResponse } from "next/server"

import { createSupabaseServerClient } from "@/lib/supabase/server"

type HealthLog = {
  id: string
  check_type: "daily_health" | "supabase_keepalive"
  status: "ok" | "error"
  response_ms: number | null
  message: string | null
  created_at: string
}

async function requireAdmin() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || user.app_metadata?.role !== "admin") {
    return null
  }

  return supabase
}

export async function GET(request: Request) {
  const supabase = await requireAdmin()

  if (!supabase) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const type = searchParams.get("type")
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 100)

  let query = supabase
    .from("health_check_logs")
    .select("id, check_type, status, response_ms, message, created_at")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (type === "daily_health" || type === "supabase_keepalive") {
    query = query.eq("check_type", type)
  }

  const { data: logs, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const { data: recentLogs } = await supabase
    .from("health_check_logs")
    .select("check_type, status, response_ms, created_at")
    .gte("created_at", sevenDaysAgo.toISOString())
    .order("created_at", { ascending: false })

  const allRecent = (recentLogs ?? []) as Pick<
    HealthLog,
    "check_type" | "status" | "response_ms" | "created_at"
  >[]

  const lastDaily = allRecent.find((log) => log.check_type === "daily_health") ?? null
  const lastKeepalive =
    allRecent.find((log) => log.check_type === "supabase_keepalive") ?? null

  const summary = {
    lastDaily,
    lastKeepalive,
    errorsLast7Days: allRecent.filter((log) => log.status === "error").length,
  }

  return NextResponse.json({ logs: logs ?? [], summary })
}
