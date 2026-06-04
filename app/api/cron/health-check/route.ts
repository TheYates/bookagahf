import { NextResponse } from "next/server"

import { runCheck } from "@/lib/health/run-check"

function verifyCronAuth(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get("authorization")

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return false
  }

  return true
}

export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const result = await runCheck("daily_health")

  return NextResponse.json({
    success: result.ok,
    responseMs: result.responseMs,
    message: result.message,
  })
}
