"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"
import { supabaseBrowserClient } from "@/lib/supabase/client"

export default function AuthCallbackPage() {
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const handleCallback = async () => {
      const hash = window.location.hash.substring(1)
      const params = new URLSearchParams(hash)
      const accessToken = params.get("access_token")
      const refreshToken = params.get("refresh_token")

      const searchParams = new URLSearchParams(window.location.search)
      const redirectTo = searchParams.get("redirect_to") ?? "/client"

      if (accessToken && refreshToken) {
        const { error: setSessionError } =
          await supabaseBrowserClient.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })

        if (!setSessionError) {
          window.location.replace(redirectTo)
          return
        }

        const res = await fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            access_token: accessToken,
            refresh_token: refreshToken,
          }),
          credentials: "include",
        })

        if (res.ok) {
          window.location.replace(redirectTo)
          return
        }

        const d = await res.json()
        setError(
          setSessionError.message ??
            d.error ??
            "Failed to establish session",
        )
        return
      }

      const { data, error: getSessionError } =
        await supabaseBrowserClient.auth.getSession()
      if (data?.session) {
        window.location.replace(redirectTo)
        return
      }

      setError(
        getSessionError?.message ?? "Authentication failed. Please try again.",
      )
    }

    void handleCallback()
  }, [])

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
