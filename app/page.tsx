"use client"

import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { LoginForm } from "@/components/login-form"
import { supabaseBrowserClient } from "@/lib/supabase/client"

export default function HomePage() {
  const router = useRouter()

  // Request OTP — sends via /api/auth/otp which triggers Hubtel SMS
  const handleRequestOtp = async (identifier: string) => {
    const res = await fetch("/api/auth/otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier }),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? "Failed to send OTP")

    // In dev mode, show the OTP in a toast for easy testing
    if (data.devOtp) {
      toast.info(`[DEV] Your OTP is: ${data.devOtp}`, {
        duration: 9000,
        description: "This toast only appears in development mode.",
      })
    }

    // Return masked phone so the form can display it
    return { maskedPhone: data.maskedPhone as string }
  }

  const handleSubmit = async ({
    identifier,
    credential,
    type,
  }: {
    identifier: string
    credential: string
    type: "x-number" | "corporate" | "staff"
  }) => {
    // Staff (admin/doctor): password login via Supabase Auth
    // Map username → internal email (e.g. superadmin → superadmin@medbook.internal)
    if (type === "staff") {
      const email = identifier.includes("@")
        ? identifier
        : `${identifier}@medbook.internal`

      const { data, error } = await supabaseBrowserClient.auth.signInWithPassword({
        email,
        password: credential,
      })

      if (error || !data.user) {
        throw new Error(error?.message ?? "Login failed")
      }

      // Role is stored in app_metadata (set server-side, not editable by users)
      const role =
        (data.user.app_metadata?.role as string) ||
        (data.user.user_metadata?.role as string) ||
        "client"

      if (role === "admin") router.push("/admin")
      else if (role === "doctor") router.push("/doctor")
      else router.push("/client")
      return
    }

    // Client / corporate: verify OTP, get back a magic link token
    const res = await fetch("/api/auth/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, otp: credential, type }),
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error ?? "Invalid OTP")
    }

    // Navigate to the magic link action URL — Supabase sets the session via redirect
    if (data.actionLink) {
      window.location.href = data.actionLink
      return
    }

    router.push("/client")
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/20 px-4 py-12">
      <LoginForm onSubmit={handleSubmit} onRequestOtp={handleRequestOtp} />
    </main>
  )
}
