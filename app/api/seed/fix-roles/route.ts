import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

/**
 * ONE-TIME route — backfills app_metadata.role for all users that are missing it.
 * POST /api/seed/fix-roles  { "secret": "<SEED_SECRET>" }
 */
export async function POST(request: Request) {
  try {
    const { secret } = await request.json()
    if (!secret || secret !== process.env.SEED_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    // Get all profiles with their roles
    const { data: profiles, error } = await adminClient
      .from("profiles")
      .select("id, role")

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    const results: { id: string; role: string; status: string }[] = []

    for (const profile of profiles ?? []) {
      const { error: updateError } = await adminClient.auth.admin.updateUserById(
        profile.id,
        { app_metadata: { role: profile.role } },
      )
      results.push({
        id: profile.id,
        role: profile.role,
        status: updateError ? `failed: ${updateError.message}` : "updated",
      })
    }

    const updated = results.filter((r) => r.status === "updated").length
    const failed = results.filter((r) => r.status.startsWith("failed")).length

    return NextResponse.json({
      message: `Done. Updated: ${updated}, Failed: ${failed}`,
      results,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Unexpected error" }, { status: 500 })
  }
}
