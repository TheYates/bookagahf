import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

/**
 * ONE-TIME seed route — creates sample clients (individual + corporate).
 * POST /api/seed/clients  { "secret": "<SEED_SECRET>" }
 */

const SAMPLE_CLIENTS = [
  // ── Individual clients (private cash) ─────────────────────────────────────
  {
    full_name: "Ama Owusu",
    x_number: "X10023/26",
    company_number: null,
    phone: "+233241000001",
    email: "ama.owusu@gmail.com",
    address: "14 Labone Crescent, Accra",
    category: "private_cash",
    emergency_contact_name: "Kofi Owusu",
    emergency_contact_phone: "+233241000002",
  },
  {
    full_name: "Kwame Mensah",
    x_number: "X10024/26",
    company_number: null,
    phone: "+233241000003",
    email: "kwame.mensah@yahoo.com",
    address: "7 Ring Road East, Accra",
    category: "private_cash",
    emergency_contact_name: "Adwoa Mensah",
    emergency_contact_phone: "+233241000004",
  },
  {
    full_name: "Abena Boateng",
    x_number: "X10025/26",
    company_number: null,
    phone: "+233241000005",
    email: "abena.boateng@hotmail.com",
    address: "22 Osu Oxford Street, Accra",
    category: "nhis",
    emergency_contact_name: "Yaw Boateng",
    emergency_contact_phone: "+233241000006",
  },
  {
    full_name: "Fiifi Asante",
    x_number: "X10026/26",
    company_number: null,
    phone: "+233241000007",
    email: "fiifi.asante@gmail.com",
    address: "3 Achimota Road, Accra",
    category: "nhis",
    emergency_contact_name: "Esi Asante",
    emergency_contact_phone: "+233241000008",
  },
  {
    full_name: "Akosua Darko",
    x_number: "X10027/26",
    company_number: null,
    phone: "+233241000009",
    email: "akosua.darko@gmail.com",
    address: "9 Spintex Road, Accra",
    category: "private_cash",
    emergency_contact_name: "Kojo Darko",
    emergency_contact_phone: "+233241000010",
  },

  // ── Corporate employees (private sponsored) ───────────────────────────────
  {
    full_name: "Emmanuel Adjei",
    x_number: "X10028/26",
    company_number: "300001",
    phone: "+233241000011",
    email: "e.adjei@corporateco.com",
    address: "15 Aviation Road, Accra",
    category: "private_sponsored",
    emergency_contact_name: "Grace Adjei",
    emergency_contact_phone: "+233241000012",
  },
  {
    full_name: "Efua Quansah",
    x_number: "X10029/26",
    company_number: "300002",
    phone: "+233241000013",
    email: "e.quansah@corporateco.com",
    address: "1 Liberation Road, Accra",
    category: "private_sponsored",
    emergency_contact_name: "Nana Quansah",
    emergency_contact_phone: "+233241000014",
  },
  {
    full_name: "Kofi Agyeman",
    x_number: "X10030/26",
    company_number: "300003",
    phone: "+233241000015",
    email: "k.agyeman@techfirm.com",
    address: "8 Independence Avenue, Accra",
    category: "private_sponsored",
    emergency_contact_name: "Ama Agyeman",
    emergency_contact_phone: "+233241000016",
  },
  {
    full_name: "Akua Frimpong",
    x_number: "X10031/26",
    company_number: "300004",
    phone: "+233241000017",
    email: "a.frimpong@techfirm.com",
    address: "55 Cantonments Road, Accra",
    category: "private_sponsored",
    emergency_contact_name: "Yaw Frimpong",
    emergency_contact_phone: "+233241000018",
  },
  {
    full_name: "Nana Kusi",
    x_number: "X10032/26",
    company_number: "300005",
    phone: "+233241000019",
    email: "n.kusi@bankgroup.com",
    address: "21 High Street, Accra",
    category: "private_sponsored",
    emergency_contact_name: "Esi Kusi",
    emergency_contact_phone: "+233241000020",
  },
]

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

    const results: { name: string; status: string; error?: string }[] = []

    for (const client of SAMPLE_CLIENTS) {
      try {
        const slug = client.x_number.replace("/", "-").toLowerCase()
        const email = `${slug}@client.medbook.internal`

        // Check if already exists
        const { data: existing } = await adminClient
          .from("profiles")
          .select("id")
          .eq("x_number", client.x_number)
          .single()

        if (existing) {
          results.push({ name: client.full_name, status: "skipped (already exists)" })
          continue
        }

        // Create auth user
        const { data: authUser, error: authError } =
          await adminClient.auth.admin.createUser({
            email,
            email_confirm: true,
            user_metadata: { role: "client", full_name: client.full_name },
            app_metadata: { role: "client" },
          })

        if (authError || !authUser.user) {
          results.push({ name: client.full_name, status: "failed", error: authError?.message })
          continue
        }

        // Create profile with all fields
        const { error: profileError } = await adminClient.from("profiles").insert({
          id: authUser.user.id,
          role: "client",
          full_name: client.full_name,
          email: client.email,
          phone: client.phone,
          x_number: client.x_number,
          company_number: client.company_number,
          address: client.address,
          category: client.category,
          emergency_contact_name: client.emergency_contact_name,
          emergency_contact_phone: client.emergency_contact_phone,
          is_active: true,
        })

        if (profileError) {
          results.push({ name: client.full_name, status: "failed", error: profileError.message })
          continue
        }

        results.push({ name: client.full_name, status: "created" })
      } catch (err: any) {
        results.push({ name: client.full_name, status: "failed", error: err?.message })
      }
    }

    const created = results.filter((r) => r.status === "created").length
    const skipped = results.filter((r) => r.status.startsWith("skipped")).length
    const failed = results.filter((r) => r.status === "failed").length

    return NextResponse.json({
      message: `Seed complete. Created: ${created}, Skipped: ${skipped}, Failed: ${failed}`,
      results,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unexpected error" },
      { status: 500 },
    )
  }
}
