import "server-only"

import { createClient } from "@supabase/supabase-js"

export type CheckType = "daily_health" | "supabase_keepalive"

export type CheckResult = {
  ok: boolean
  responseMs: number
  message: string | null
}

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export async function runCheck(checkType: CheckType): Promise<CheckResult> {
  const adminClient = getAdminClient()
  const start = Date.now()
  let ok = false
  let message: string | null = null

  try {
    const { error } = await adminClient
      .from("settings")
      .select("id")
      .eq("id", 1)
      .single()

    if (error) {
      message = error.message
    } else {
      ok = true
    }
  } catch (err) {
    message = err instanceof Error ? err.message : "Unknown error"
  }

  const responseMs = Date.now() - start

  await adminClient.from("health_check_logs").insert({
    check_type: checkType,
    status: ok ? "ok" : "error",
    response_ms: responseMs,
    message,
  })

  return { ok, responseMs, message }
}
