import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

const ALLOWED_SORT_COLUMNS = new Set([
  "full_name", "x_number", "company_number", "phone",
  "is_active", "created_at", "date_joined", "category",
])

const ALLOWED_FILTER_COLUMNS = new Set([
  "category", "is_active", "sex",
])

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get("search")?.trim() || ""
  const regex = searchParams.get("regex") === "true"
  const page = Math.max(1, Number(searchParams.get("page")) || 1)
  const pageSize = Math.min(200, Math.max(1, Number(searchParams.get("pageSize")) || 25))
  const sortBy = ALLOWED_SORT_COLUMNS.has(searchParams.get("sort_by") ?? "")
    ? searchParams.get("sort_by")!
    : "full_name"
  const sortDir = searchParams.get("sort_dir") === "desc" ? "desc" : "asc" as "asc" | "desc"

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = adminClient
    .from("profiles")
    .select("id, full_name, phone, x_number, company_number, is_active, created_at, date_joined, category, sex", { count: "exact" })
    .eq("role", "client")

  // ── Search ──────────────────────────────────────────────────────────────────
  if (q) {
    if (regex) {
      // Regex mode uses PostgreSQL ~ operator, now GIN-trigram-accelerated
      query = query.or(
        `full_name~${q},x_number~${q},company_number~${q},phone~${q}`,
      )
    } else {
      // Use pg_trgm similarity search for better relevance ranking.
      // The GIN trigram indexes on full_name and x_number accelerate this.
      // When no other filters are active, use the search_clients RPC for
      // relevance-ranked results; otherwise fall back to ILIKE (index-backed).
      const hasFilters = Array.from(searchParams.keys()).some((k) =>
        ALLOWED_FILTER_COLUMNS.has(k) && searchParams.get(k)
      )
      if (!hasFilters && page <= 3) {
        // For simple text searches, get relevance-ranked results from the RPC
        const { data: ranked } = await adminClient.rpc("search_clients", {
          search_term: q,
        })
        if (ranked && ranked.length > 0) {
          const ids = ranked.map((r: any) => r.id)
          // Fetch full columns for the ranked results, preserving sort
          const { data: full, error: fullError } = await adminClient
            .from("profiles")
            .select("id, full_name, phone, x_number, company_number, is_active, created_at, date_joined, category, sex")
            .in("id", ids)
          if (!fullError && full) {
            // Preserve similarity ranking order
            const idOrder = new Map<string, number>(ids.map((id: string, i: number) => [id, i]))
            const sorted = full.sort((a, b) => {
              const ai = idOrder.get(a.id) ?? 99
              const bi = idOrder.get(b.id) ?? 99
              return (ai as number) - (bi as number)
            })
            return NextResponse.json({ clients: sorted, total: sorted.length, page: 1, pageSize: sorted.length })
          }
        }
      }
      // Fallback: ILIKE (benefits from GIN trigram index for speed)
      query = query.or(
        `full_name.ilike.%${q}%,x_number.ilike.%${q}%,company_number.ilike.%${q}%,phone.ilike.%${q}%`,
      )
    }
  }

  // ── Filters ─────────────────────────────────────────────────────────────────
  for (const col of ALLOWED_FILTER_COLUMNS) {
    const val = searchParams.get(col)
    if (val) {
      if (val === "true") query = query.eq(col, true)
      else if (val === "false") query = query.eq(col, false)
      else query = query.eq(col, val)
    }
  }

  const { data, error, count } = await query
    .order(sortBy, { ascending: sortDir === "asc" })
    .range(from, to)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ clients: data ?? [], total: count ?? 0, page, pageSize })
}

export async function POST(request: Request) {
  const body = await request.json()
  const {
    full_name,
    phone,
    x_number,
    company_number,
    email: clientEmail,
    address,
    category,
    emergency_contact_name,
    emergency_contact_phone,
    date_joined,
  } = body

  if (!full_name) {
    return NextResponse.json({ error: "Full name is required." }, { status: 400 })
  }

  if (!x_number && !company_number) {
    return NextResponse.json(
      { error: "Either X-number or company number is required." },
      { status: 400 },
    )
  }

  const derivedCategory = company_number ? "private_sponsored" : (category || "private_cash")

  const profileId = crypto.randomUUID()

  const { error: profileError } = await adminClient.from("profiles").insert({
    id: profileId,
    role: "client",
    full_name,
    email: null,
    phone,
    x_number: x_number || null,
    company_number: company_number || null,
    address: address || null,
    category: derivedCategory,
    emergency_contact_name: emergency_contact_name || null,
    emergency_contact_phone: emergency_contact_phone || null,
    sex: body.sex || null,
    date_of_birth: body.date_of_birth || null,
    date_joined: date_joined || null,
    is_active: true,
  })

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 })
  }

  return NextResponse.json({ id: profileId, message: "Client created successfully." })
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")
  let ids: string[]

  if (id) {
    ids = [id]
  } else {
    try {
      const body = await request.json()
      ids = body.ids
    } catch {
      return NextResponse.json({ error: "Provide ?id= or a JSON body with ids." }, { status: 400 })
    }
  }

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "No IDs provided." }, { status: 400 })
  }

  const { error } = await adminClient.from("profiles").delete().in("id", ids)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ deleted: ids.length })
}
