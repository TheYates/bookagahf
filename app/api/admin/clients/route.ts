import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createSupabaseServerClient } from "@/lib/supabase/server"

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, x_number, company_number, is_active, created_at")
    .eq("role", "client")
    .order("full_name")

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ clients: data })
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
  } = body

  if (!full_name || !phone) {
    return NextResponse.json({ error: "Full name and phone are required." }, { status: 400 })
  }

  if (!x_number && !company_number) {
    return NextResponse.json(
      { error: "Either X-number or company number is required." },
      { status: 400 },
    )
  }

  // Generate a unique internal email for auth (different from contact email)
  const slug = x_number
    ? x_number.replace("/", "-").toLowerCase()
    : `corp-${company_number}`
  const authEmail = `${slug}@client.medbook.internal`

  // Derive category: corporate employees are always private_sponsored
  const derivedCategory = company_number ? "private_sponsored" : (category || "private_cash")

  const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
    email: authEmail,
    phone: phone ?? undefined,
    email_confirm: true,
    user_metadata: { role: "client", full_name },
    app_metadata: { role: "client" },
  })

  if (authError || !authUser.user) {
    return NextResponse.json({ error: authError?.message ?? "Failed to create user" }, { status: 400 })
  }

  const userId = authUser.user.id

  const { error: profileError } = await adminClient.from("profiles").insert({
    id: userId,
    role: "client",
    full_name,
    email: clientEmail || authEmail,
    phone,
    x_number: x_number || null,
    company_number: company_number || null,
    address: address || null,
    category: derivedCategory,
    emergency_contact_name: emergency_contact_name || null,
    emergency_contact_phone: emergency_contact_phone || null,
    is_active: true,
  })

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 })
  }

  return NextResponse.json({ id: userId, message: "Client created successfully." })
}
