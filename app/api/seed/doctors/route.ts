import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

/**
 * ONE-TIME seed route — creates specialties and sample doctors.
 * POST /api/seed/doctors  { "secret": "<SEED_SECRET>" }
 */

const SPECIALTIES = [
  { name: "General Practice", description: "Primary care and general health consultations" },
  { name: "Internal Medicine", description: "Diagnosis and treatment of adult diseases" },
  { name: "Paediatrics", description: "Medical care for infants, children and adolescents" },
  { name: "Obstetrics & Gynaecology", description: "Women's reproductive health and childbirth" },
  { name: "Surgery", description: "Surgical procedures and post-operative care" },
  { name: "Dentistry", description: "Oral health, teeth and gum care" },
  { name: "Ophthalmology", description: "Eye care and vision health" },
  { name: "Psychiatry", description: "Mental health and behavioural disorders" },
  { name: "Dermatology", description: "Skin, hair and nail conditions" },
  { name: "Physiotherapy", description: "Physical rehabilitation and movement therapy" },
]

const DOCTORS = [
  {
    full_name: "Dr. Kwabena Asare",
    username: "dr.asare",
    password: "Doctor@123",
    phone: "+233201000001",
    specialties: ["General Practice", "Internal Medicine"],
  },
  {
    full_name: "Dr. Abena Frimpong",
    username: "dr.frimpong",
    password: "Doctor@123",
    phone: "+233201000002",
    specialties: ["Obstetrics & Gynaecology"],
  },
  {
    full_name: "Dr. Kofi Boateng",
    username: "dr.boateng",
    password: "Doctor@123",
    phone: "+233201000003",
    specialties: ["Paediatrics"],
  },
  {
    full_name: "Dr. Ama Mensah",
    username: "dr.mensah",
    password: "Doctor@123",
    phone: "+233201000004",
    specialties: ["Surgery"],
  },
  {
    full_name: "Dr. Yaw Darko",
    username: "dr.darko",
    password: "Doctor@123",
    phone: "+233201000005",
    specialties: ["Dentistry"],
  },
  {
    full_name: "Dr. Efua Quaye",
    username: "dr.quaye",
    password: "Doctor@123",
    phone: "+233201000006",
    specialties: ["Ophthalmology", "General Practice"],
  },
  {
    full_name: "Dr. Nana Adjei",
    username: "dr.adjei",
    password: "Doctor@123",
    phone: "+233201000007",
    specialties: ["Psychiatry"],
  },
  {
    full_name: "Dr. Akosua Owusu",
    username: "dr.owusu",
    password: "Doctor@123",
    phone: "+233201000008",
    specialties: ["Dermatology", "Internal Medicine"],
  },
  {
    full_name: "Dr. Fiifi Agyeman",
    username: "dr.agyeman",
    password: "Doctor@123",
    phone: "+233201000009",
    specialties: ["Physiotherapy"],
  },
  {
    full_name: "Dr. Akua Kusi",
    username: "dr.kusi",
    password: "Doctor@123",
    phone: "+233201000010",
    specialties: ["General Practice", "Paediatrics"],
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

    // ── 1. Seed specialties ───────────────────────────────────────────────────
    const specialtyResults: Record<string, string> = {}

    for (const spec of SPECIALTIES) {
      // Check if already exists
      const { data: existing } = await adminClient
        .from("specialties")
        .select("id")
        .eq("name", spec.name)
        .single()

      if (existing) {
        specialtyResults[spec.name] = existing.id
        continue
      }

      const { data, error } = await adminClient
        .from("specialties")
        .insert(spec)
        .select("id")
        .single()

      if (error) {
        console.error(`[seed] specialty "${spec.name}" failed:`, error.message)
        continue
      }

      specialtyResults[spec.name] = data.id
    }

    // ── 2. Seed doctors ───────────────────────────────────────────────────────
    const results: { name: string; status: string; error?: string }[] = []

    for (const doctor of DOCTORS) {
      try {
        const authEmail = `${doctor.username}@medbook.internal`

        // Check if already exists
        const { data: existing } = await adminClient
          .from("profiles")
          .select("id")
          .eq("email", authEmail)
          .single()

        if (existing) {
          results.push({ name: doctor.full_name, status: "skipped (already exists)" })
          continue
        }

        // Create auth user
        const { data: authUser, error: authError } =
          await adminClient.auth.admin.createUser({
            email: authEmail,
            password: doctor.password,
            email_confirm: true,
            user_metadata: { role: "doctor", full_name: doctor.full_name },
            app_metadata: { role: "doctor" },
          })

        if (authError || !authUser.user) {
          results.push({
            name: doctor.full_name,
            status: "failed",
            error: authError?.message,
          })
          continue
        }

        const userId = authUser.user.id

        // Create profile
        const { error: profileError } = await adminClient.from("profiles").insert({
          id: userId,
          role: "doctor",
          full_name: doctor.full_name,
          email: authEmail,
          phone: doctor.phone,
          is_active: true,
        })

        if (profileError) {
          results.push({ name: doctor.full_name, status: "failed", error: profileError.message })
          continue
        }

        // Create doctor settings
        await adminClient
          .from("doctor_settings")
          .insert({ doctor_id: userId, is_available: true })

        // Link specialties
        const specialtyIds = doctor.specialties
          .map((s) => specialtyResults[s])
          .filter(Boolean)

        if (specialtyIds.length) {
          await adminClient.from("doctor_specialties").insert(
            specialtyIds.map((sid) => ({ doctor_id: userId, specialty_id: sid })),
          )
        }

        results.push({ name: doctor.full_name, status: "created" })
      } catch (err: any) {
        results.push({ name: doctor.full_name, status: "failed", error: err?.message })
      }
    }

    const created = results.filter((r) => r.status === "created").length
    const skipped = results.filter((r) => r.status.startsWith("skipped")).length
    const failed = results.filter((r) => r.status === "failed").length

    return NextResponse.json({
      message: `Seed complete. Specialties: ${Object.keys(specialtyResults).length}. Doctors — Created: ${created}, Skipped: ${skipped}, Failed: ${failed}`,
      specialties: specialtyResults,
      doctors: results,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unexpected error" },
      { status: 500 },
    )
  }
}
