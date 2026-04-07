import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

/**
 * PATCH /api/admin/doctors/[id]
 * Update a doctor's profile and specialty assignments.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { full_name, phone, is_active, specialty_ids } = await request.json()

  // Update profile
  const { error: profileError } = await adminClient
    .from("profiles")
    .update({
      ...(full_name && { full_name }),
      ...(phone !== undefined && { phone }),
      ...(is_active !== undefined && { is_active }),
    })
    .eq("id", id)

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 })
  }

  // Replace specialties if provided
  if (Array.isArray(specialty_ids)) {
    await adminClient
      .from("doctor_specialties")
      .delete()
      .eq("doctor_id", id)

    if (specialty_ids.length > 0) {
      const { error: specError } = await adminClient
        .from("doctor_specialties")
        .insert(
          specialty_ids.map((sid: string) => ({
            doctor_id: id,
            specialty_id: sid,
          })),
        )

      if (specError) {
        return NextResponse.json({ error: specError.message }, { status: 400 })
      }
    }
  }

  return NextResponse.json({ success: true })
}
