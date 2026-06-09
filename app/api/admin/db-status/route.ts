import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createSupabaseServerClient } from "@/lib/supabase/server"

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

const FREE_TIER_LIMIT_BYTES = 500 * 1024 * 1024 // 500 MB

async function requireAdmin() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || user.app_metadata?.role !== "admin") {
    return false
  }

  return true
}

export async function GET() {
  const isAdmin = await requireAdmin()

  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Query total database size
    const { data: sizeData, error: sizeError } = await adminClient.rpc(
      "get_db_size",
    )

    if (sizeError) {
      // Fallback: estimate from per-table sizes if the function doesn't exist
      const tables = await getTableSizes()
      if (!tables) {
        return NextResponse.json(
          { error: "Failed to query database size. The get_db_size function may not exist." },
          { status: 500 },
        )
      }

      const totalBytes = tables.reduce((sum, t) => sum + t.total_bytes, 0)
      return NextResponse.json({
        totalBytes,
        limitBytes: FREE_TIER_LIMIT_BYTES,
        usagePercent: Math.round((totalBytes / FREE_TIER_LIMIT_BYTES) * 10000) / 100,
        tables,
        note: "Size estimated from table sizes (pg_database_size unavailable).",
      })
    }

    const totalBytes = Number(sizeData)

    // Query per-table sizes
    const tables = await getTableSizes()

    return NextResponse.json({
      totalBytes,
      limitBytes: FREE_TIER_LIMIT_BYTES,
      usagePercent:
        Math.round((totalBytes / FREE_TIER_LIMIT_BYTES) * 10000) / 100,
      tables: tables ?? [],
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    )
  }
}

type TableInfo = {
  table_name: string
  row_count: number
  total_bytes: number
}

async function getTableSizes(): Promise<TableInfo[] | null> {
  const { data, error } = await adminClient.rpc("get_table_sizes")

  if (error) return null

  return (data as TableInfo[]) ?? []
}
