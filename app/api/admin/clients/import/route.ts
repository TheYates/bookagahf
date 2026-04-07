import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

/**
 * POST /api/admin/clients/import
 * Body: { clients: Array of client objects parsed from CSV }
 * 
 * Expected CSV columns (case-insensitive):
 * full_name, phone, x_number, company_number, email, address, category,
 * emergency_contact_name, emergency_contact_phone
 */
export async function POST(request: Request) {
  const { clients } = await request.json()

  if (!Array.isArray(clients) || clients.length === 0) {
    return NextResponse.json({ error: "No clients provided" }, { status: 400 })
  }

  const results: { name: string; status: string; error?: string }[] = []

  for (const client of clients) {
    const full_name = client.full_name?.trim()
    const phone = client.phone?.trim()
    const x_number = client.x_number?.trim() || null
    const company_number = client.company_number?.trim() || null
    const email = client.email?.trim() || null
    const address = client.address?.trim() || null
    const category = company_number
      ? "private_sponsored"
      : (client.category?.trim() || "private_cash")
    const emergency_contact_name = client.emergency_contact_name?.trim() || null
    const emergency_contact_phone = client.emergency_contact_phone?.trim() || null

    if (!full_name || !phone) {
      results.push({ name: full_name ?? "(unknown)", status: "failed", error: "Full name and phone required" })
      continue
    }

    if (!x_number && !company_number) {
      results.push({ name: full_name, status: "failed", error: "X-number or company number required" })
      continue
    }

    try {
      // Check if already exists
      const { data: existing } = await adminClient
        .from("profiles")
        .select("id")
        .or(x_number ? `x_number.eq.${x_number}` : `company_number.eq.${company_number}`)
        .single()

      if (existing) {
        results.push({ name: full_name, status: "skipped (already exists)" })
        continue
      }

      const slug = x_number
        ? x_number.replace("/", "-").toLowerCase()
        : `corp-${company_number}`
      const authEmail = `${slug}@client.medbook.internal`

      const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
        email: authEmail,
        email_confirm: true,
        user_metadata: { role: "client", full_name },
        app_metadata: { role: "client" },
      })

      if (authError || !authUser.user) {
        results.push({ name: full_name, status: "failed", error: authError?.message })
        continue
      }

      const { error: profileError } = await adminClient.from("profiles").insert({
        id: authUser.user.id,
        role: "client",
        full_name,
        email: email ?? authEmail,
        phone,
        x_number,
        company_number,
        address,
        category,
        emergency_contact_name,
        emergency_contact_phone,
        is_active: true,
      })

      if (profileError) {
        results.push({ name: full_name, status: "failed", error: profileError.message })
        continue
      }

      results.push({ name: full_name, status: "created" })
    } catch (err: any) {
      results.push({ name: full_name, status: "failed", error: err?.message })
    }
  }

  const created = results.filter((r) => r.status === "created").length
  const skipped = results.filter((r) => r.status.startsWith("skipped")).length
  const failed = results.filter((r) => r.status === "failed").length

  return NextResponse.json({
    message: `Import complete. Created: ${created}, Skipped: ${skipped}, Failed: ${failed}`,
    results,
  })
}
