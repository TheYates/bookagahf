import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

/**
 * ONE-TIME seed route — creates the superadmin account.
 * Protected by a SEED_SECRET env var.
 * Call once: POST /api/seed/admin  { "secret": "<SEED_SECRET>" }
 * Then remove or disable this route in production.
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

    const ADMIN_EMAIL = "superadmin@medbook.internal"

    // Check if user already exists via admin API
    const { data: userList } = await adminClient.auth.admin.listUsers()
    const existing = userList?.users?.find((u) => u.email === ADMIN_EMAIL)

    let userId: string

    if (existing) {
      userId = existing.id
      // Update password in case it changed
      await adminClient.auth.admin.updateUserById(userId, {
        password: "admin123",
        email_confirm: true,
      })
    } else {
      // Create fresh auth user
      const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
        email: ADMIN_EMAIL,
        password: "admin123",
        email_confirm: true,
      })

      if (authError || !authUser?.user) {
        return NextResponse.json(
          { error: authError?.message ?? "Failed to create auth user" },
          { status: 400 },
        )
      }

      userId = authUser.user.id
    }

    // Store role in auth user metadata so it's available without a DB call
    await adminClient.auth.admin.updateUserById(userId, {
      user_metadata: { role: "admin", full_name: "Super Admin" },
      app_metadata: { role: "admin" },
    })

    // Upsert the profile with role = admin
    const { error: profileError } = await adminClient.from("profiles").upsert(
      {
        id: userId,
        role: "admin",
        full_name: "Super Admin",
        email: ADMIN_EMAIL,
        x_number: null,
        company_number: null,
        is_active: true,
      },
      { onConflict: "id" },
    )

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }

    return NextResponse.json({
      message: existing ? "Admin account updated." : "Admin account created successfully.",
      id: userId,
      login: {
        username: "superadmin",
        password: "admin123",
      },
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unexpected server error" },
      { status: 500 },
    )
  }
}
