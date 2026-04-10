"use client"

import * as React from "react"
import { Loader2, Power } from "lucide-react"
import { Button } from "@/components/ui/button"
import { supabaseBrowserClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

export default function DoctorSettingsPage() {
  const [isAvailable, setIsAvailable] = React.useState(true)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [message, setMessage] = React.useState<{
    text: string
    ok: boolean
  } | null>(null)
  const [userId, setUserId] = React.useState<string | null>(null)

  React.useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabaseBrowserClient.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const { data } = await supabaseBrowserClient
        .from("doctor_settings")
        .select("is_available")
        .eq("doctor_id", user.id)
        .single()

      if (data) setIsAvailable(data.is_available)
      setLoading(false)
    }
    void init()
  }, [])

  React.useEffect(() => {
    if (!userId) return
    const channel = supabaseBrowserClient
      .channel(`doctor-availability-${userId}`)
      .on("broadcast", { event: "availability_changed" }, ({ payload }) => {
        if (
          payload?.doctor_id === userId &&
          typeof payload.is_available === "boolean"
        ) {
          setIsAvailable(payload.is_available)
        }
      })
      .subscribe()

    return () => {
      void supabaseBrowserClient.removeChannel(channel)
    }
  }, [userId])

  React.useEffect(() => {
    if (!userId) return
    const channel = supabaseBrowserClient
      .channel("doctor-settings-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "doctor_settings",
          filter: `doctor_id=eq.${userId}`,
        },
        (payload: any) => {
          const next = payload?.new?.is_available
          if (typeof next === "boolean") {
            setIsAvailable(next)
          }
        }
      )
      .subscribe()

    return () => {
      void supabaseBrowserClient.removeChannel(channel)
    }
  }, [userId])

  const broadcastAvailability = React.useCallback(
    async (next: boolean) => {
      if (!userId) return
      await supabaseBrowserClient.channel("doctor-availability").send({
        type: "broadcast",
        event: "availability_changed",
        payload: { doctor_id: userId, is_available: next },
      })
    },
    [userId]
  )

  const toggle = async () => {
    if (!userId) return
    setSaving(true)
    setMessage(null)
    const next = !isAvailable

    const { error } = await supabaseBrowserClient
      .from("doctor_settings")
      .upsert({
        doctor_id: userId,
        is_available: next,
        updated_at: new Date().toISOString(),
      })

    if (!error) {
      await broadcastAvailability(next)
    }

    setSaving(false)
    if (error) {
      setMessage({ text: "Failed to update availability.", ok: false })
      return
    }
    setIsAvailable(next)
    setMessage({
      text: next
        ? "You are now available for bookings."
        : "You are now unavailable. Clients cannot book you.",
      ok: next,
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your availability and preferences.
        </p>
      </div>

      <div className="rounded-xl border bg-background p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold">Availability</p>
            <p className="text-sm text-muted-foreground">
              Toggle this off to stop receiving new bookings. Existing
              appointments are unaffected.
            </p>
          </div>

          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <button
              onClick={toggle}
              disabled={saving}
              className={cn(
                "relative flex h-8 w-14 items-center rounded-full border-2 transition-colors duration-300",
                isAvailable
                  ? "border-green-500 bg-green-500"
                  : "border-muted-foreground bg-muted"
              )}
              aria-label="Toggle availability"
            >
              <span
                className={cn(
                  "absolute h-5 w-5 rounded-full bg-white shadow transition-transform duration-300",
                  isAvailable ? "translate-x-7" : "translate-x-1"
                )}
              />
            </button>
          )}
        </div>

        {!loading && (
          <div
            className={cn(
              "mt-4 flex items-center gap-2 rounded-lg px-4 py-2 text-sm",
              isAvailable
                ? "bg-green-50 text-green-700"
                : "bg-muted text-muted-foreground"
            )}
          >
            <Power className="h-4 w-4" />
            {isAvailable
              ? "Accepting new appointments"
              : "Not accepting new appointments"}
          </div>
        )}

        {message && (
          <p
            className={cn(
              "mt-3 text-sm",
              message.ok ? "text-green-600" : "text-destructive"
            )}
          >
            {message.text}
          </p>
        )}
      </div>
    </div>
  )
}
