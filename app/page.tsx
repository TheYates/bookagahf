"use client"

import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useState } from "react"

import { LoginForm } from "@/components/login-form"
import { supabaseBrowserClient } from "@/lib/supabase/client"

const DEV_ACCOUNTS = {
  admins: [
    { username: "superadmin", password: "admin123", role: "Admin" },
    { username: "admin", password: "admin123", role: "Admin" },
  ],
  doctors: [
    { username: "dr.asare", password: "Doctor@123", name: "Dr. Kwabena Asare" },
    {
      username: "dr.frimpong",
      password: "Doctor@123",
      name: "Dr. Abena Frimpong",
    },
    {
      username: "dr.boateng",
      password: "Doctor@123",
      name: "Dr. Kofi Boateng",
    },
    { username: "dr.mensah", password: "Doctor@123", name: "Dr. Yaw Mensah" },
    { username: "dr.darko", password: "Doctor@123", name: "Dr. Efua Darko" },
    { username: "dr.quaye", password: "Doctor@123", name: "Dr. Kojo Quaye" },
    { username: "dr.adjei", password: "Doctor@123", name: "Dr. Samuel Adjei" },
    { username: "dr.owusu", password: "Doctor@123", name: "Dr. Ben Owusu" },
    {
      username: "dr.agyeman",
      password: "Doctor@123",
      name: "Dr. Paul Agyeman",
    },
    { username: "dr.kusi", password: "Doctor@123", name: "Dr. Kwaku Kusi" },
  ],
  clients: [
    { x_number: "X10023/26", name: "Ama Owusu" },
    { x_number: "X10024/26", name: "Kwame Mensah" },
    { x_number: "X10025/26", name: "Abena Boateng" },
    { x_number: "X10026/26", name: "Fiifi Asante" },
    { x_number: "X10027/26", name: "Akosua Darko" },
    { x_number: "X10028/26", name: "Yaw Osei" },
    { x_number: "X10029/26", name: "Nana Kofi" },
    { x_number: "X10030/26", name: "Adjoa Serwaa" },
    { x_number: "X10031/26", name: "Kofi Amponsah" },
    { x_number: "X10032/26", name: "Akua Nyarko" },
  ],
}

export default function HomePage() {
  const router = useRouter()
  const [showDevAccounts, setShowDevAccounts] = useState(false)

  // Request OTP — sends via /api/auth/otp which triggers Hubtel SMS
  const handleRequestOtp = async (identifier: string) => {
    const res = await fetch("/api/auth/otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier }),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? "Failed to send OTP")

    // In dev mode or mock mode, show the OTP in a toast for easy testing
    if (data.devOtp) {
      toast.info(`[DEV] Your OTP is: ${data.devOtp}`, {
        duration: 20000,
        description:
          "Valid for 10 minutes. This toast only appears in dev/mock mode.",
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

      const { data, error } =
        await supabaseBrowserClient.auth.signInWithPassword({
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
    <main className="flex min-h-svh flex-col items-center justify-center bg-muted/20 px-4 py-12">
      <LoginForm onSubmit={handleSubmit} onRequestOtp={handleRequestOtp} />

      {process.env.NODE_ENV === "development" && (
        <div className="mt-8 text-center">
          <button
            onClick={() => setShowDevAccounts(!showDevAccounts)}
            className="text-xs text-muted-foreground underline hover:text-primary"
          >
            {showDevAccounts ? "Hide" : "Show"} test accounts
          </button>

          {showDevAccounts && (
            <div className="mt-4 max-w-2xl space-y-4 rounded-lg border bg-background p-4 text-left text-xs">
              <div>
                <p className="mb-1 font-semibold text-primary">
                  Admin (Staff Login)
                </p>
                {DEV_ACCOUNTS.admins.map((a) => (
                  <p key={a.username} className="text-muted-foreground">
                    Username: <span className="font-mono">{a.username}</span> |
                    Password: <span className="font-mono">{a.password}</span>
                  </p>
                ))}
              </div>

              <div>
                <p className="mb-1 font-semibold text-primary">
                  Doctors (Staff Login)
                </p>
                {DEV_ACCOUNTS.doctors.map((d) => (
                  <p key={d.username} className="text-muted-foreground">
                    {d.name} → Username:{" "}
                    <span className="font-mono">{d.username}</span> | Password:{" "}
                    <span className="font-mono">{d.password}</span>
                  </p>
                ))}
              </div>

              <div>
                <p className="mb-1 font-semibold text-primary">
                  Clients (OTP Login - use X-Number)
                </p>
                {DEV_ACCOUNTS.clients.map((c) => (
                  <p key={c.x_number} className="text-muted-foreground">
                    {c.name} → X-Number:{" "}
                    <span className="font-mono">{c.x_number}</span> (OTP:
                    123456)
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  )
}
