"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { supabaseBrowserClient } from "@/lib/supabase/client"

export default function AuthCallbackPage() {
  const router = useRouter()
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const handleCallback = async () => {
      // Parse the fragment from the URL
      const hash = window.location.hash.substring(1)
      const params = new URLSearchParams(hash)
      const accessToken = params.get("access_token")
      const refreshToken = params.get("refresh_token")

      const searchParams = new URLSearchParams(window.location.search)
      const redirectTo = searchParams.get("redirect_to") ?? "/client"

      if (accessToken && refreshToken) {
        // Exchange tokens server-side to set a proper cookie-based session
        const res = await fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access_token: accessToken, refresh_token: refreshToken }),
          credentials: "include",
        })

        if (!res.ok) {
          const d = await res.json()
          setError(d.error ?? "Failed to establish session")
          return
        }

        // Full page navigation so middleware sees the new cookie
        window.location.replace(redirectTo)
        return
      }

      // Fallback: check if session already exists
      const { data, error: getSessionError } = await supabaseBrowserClient.auth.getSession()
      if (data?.session) {
        router.replace(redirectTo)
        return
      }

      setError(getSessionError?.message ?? "Authentication failed. Please try again.")
    }

    void handleCallback()
  }, [router])

  if (error) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <a href="/" className="text-sm text-primary hover:underline">
          Back to login
        </a>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Signing you in…</p>
    </div>
  )
}
