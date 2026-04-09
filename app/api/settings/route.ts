import { NextResponse } from "next/server"

export async function GET() {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/settings?id=eq.1`,
      {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    )

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json({ error: data.message }, { status: 400 })
    }

    return NextResponse.json({ settings: data[0] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const body = await request.json()

  try {
    // Build update object - only include fields that are in the request
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }

    if (body.appointment_duration !== undefined) {
      updateData.appointment_duration = body.appointment_duration
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/settings?id=eq.1`,
      {
        method: "PATCH",
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(updateData),
      }
    )

    const data = await response.json()

    if (!response.ok) {
      console.error("Settings update error:", data)
      return NextResponse.json({ 
        error: data.message || "Could not update settings." 
      }, { status: 400 })
    }

    return NextResponse.json({ settings: data[0] || data })
  } catch (err: any) {
    console.error("Settings update exception:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
