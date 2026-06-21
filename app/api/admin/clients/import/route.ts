import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const adminClient = createClient(
  supabaseUrl,
  serviceRoleKey,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

const enc = (data: unknown) =>
  new TextEncoder().encode(JSON.stringify(data) + "\n")

const toTitleCase = (s: string) =>
  s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())

/**
 * POST /api/admin/clients/import
 * Body: { clients: Array of client objects parsed from CSV }
 *
 * Returns a streaming NDJSON response so the client can show live progress.
 * Each line is an event: { type:"created"|"skipped"|"failed", name, error? }
 * The final event is:    { type:"done", tally: { created, skipped, failed } }
 *
 * Expected columns (case-insensitive):
 * full_name, phone, x_number, company_number, email, address, category,
 * emergency_contact_name, emergency_contact_phone, sex, date_of_birth
 *
 * NOTE: Client profiles are created WITHOUT an auth user. Auth users are
 * created lazily on first login via the OTP verify flow.
 */
export async function POST(request: Request) {
  const { clients, batchSize: rawBatchSize } = await request.json()

  if (!Array.isArray(clients) || clients.length === 0) {
    return new Response(enc({ type: "error", message: "No clients provided" }), {
      status: 400,
      headers: { "Content-Type": "application/x-ndjson" },
    })
  }

  const stream = new ReadableStream({
    async start(controller) {
      // ── 1. Validate and normalise all rows ───────────────────────────────────
      const parsed: Record<string, any>[] = []
      let created = 0, skipped = 0, failed = 0

      for (const client of clients) {
        const phone = client.phone?.trim()
        const full_name = toTitleCase(client.full_name?.trim() ?? "")
        const x_number = client.x_number?.trim() || null
        const company_number = client.company_number?.trim() || null
        const email = client.email?.trim() || null
        const address = client.address?.trim() || null
        const category = company_number
          ? "private_sponsored"
          : (client.category?.trim() || "private_cash")
        const emergency_contact_name =
          client.emergency_contact_name?.trim() || null
        const emergency_contact_phone =
          client.emergency_contact_phone?.trim() || null
        const sex = client.sex?.trim() || null
        const date_of_birth = client.date_of_birth?.trim() || null
        const date_joined = client.date_joined?.trim() || null

        if (!full_name) {
          failed++
          controller.enqueue(enc({ type: "failed", name: "(unknown)", error: "Full name is required" }))
          continue
        }

        if (full_name.toLowerCase() === "walk-in patient") {
          failed++
          controller.enqueue(enc({ type: "failed", name: full_name, error: "Auto-rejected: walk-in patient" }))
          continue
        }

        if (!x_number && !company_number) {
          failed++
          controller.enqueue(enc({ type: "failed", name: full_name, error: "X-number or company number required" }))
          continue
        }

        parsed.push({
          full_name,
          email: null,
          phone,
          x_number,
          company_number,
          address,
          category,
          emergency_contact_name,
          emergency_contact_phone,
          sex,
          date_of_birth,
          date_joined,
          is_active: true,
        })
      }

      // ── 2. Bulk existence check ──────────────────────────────────────────────
      const xNumbers = [
        ...new Set(parsed.filter((p) => p.x_number).map((p) => p.x_number)),
      ]
      const companyNumbers = [
        ...new Set(
          parsed.filter((p) => p.company_number).map((p) => p.company_number),
        ),
      ]

      const existingX = new Set<string>()
      const existingCompany = new Set<string>()

      if (xNumbers.length > 0) {
        const { data } = await adminClient
          .from("profiles")
          .select("x_number")
          .in("x_number", xNumbers)
        if (data) for (const r of data) existingX.add(r.x_number)
      }

      if (companyNumbers.length > 0) {
        const { data } = await adminClient
          .from("profiles")
          .select("company_number")
          .in("company_number", companyNumbers)
        if (data) for (const r of data) existingCompany.add(r.company_number)
      }

      const toInsert: Record<string, any>[] = []
      const seenXInFile = new Set<string>()
      const seenCompanyInFile = new Set<string>()

      for (const p of parsed) {
        // Skip duplicates found in the database
        if (
          (p.x_number && existingX.has(p.x_number)) ||
          (p.company_number && existingCompany.has(p.company_number))
        ) {
          skipped++
          controller.enqueue(enc({ type: "skipped", name: p.full_name, reason: "already exists in system" }))
          continue
        }

        // Skip duplicates found elsewhere in the same file
        if (
          (p.x_number && seenXInFile.has(p.x_number)) ||
          (p.company_number && seenCompanyInFile.has(p.company_number))
        ) {
          skipped++
          controller.enqueue(enc({ type: "skipped", name: p.full_name, reason: "duplicate in file" }))
          continue
        }

        toInsert.push(p)
        if (p.x_number) seenXInFile.add(p.x_number)
        if (p.company_number) seenCompanyInFile.add(p.company_number)
      }

      // ── 3. Batch insert ──────────────────────────────────────────────────────
      const BATCH_SIZE = Math.min(1000, Math.max(1, Number(rawBatchSize) || 200))

      for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
        const batch = toInsert.slice(i, i + BATCH_SIZE)
        const rows = batch.map((p) => ({
          id: crypto.randomUUID(),
          role: "client",
          ...p,
        }))

        const { error } = await adminClient.from("profiles").insert(rows)

        if (error) {
          failed += batch.length
          for (const p of batch) {
            controller.enqueue(enc({ type: "failed", name: p.full_name, error: error.message }))
          }
        } else {
          created += batch.length
          for (const p of batch) {
            controller.enqueue(enc({ type: "created", name: p.full_name }))
          }
        }
      }

      // ── 4. Done ──────────────────────────────────────────────────────────────
      controller.enqueue(enc({ type: "done", tally: { created, skipped, failed, total: clients.length } }))
      controller.close()
    },
  })

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson" },
  })
}
