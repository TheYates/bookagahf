"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { Loader2, Save, Clock, Power } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { supabaseBrowserClient } from "@/lib/supabase/client"

import { Switch } from "@/components/ui/switch"

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]

type DayAvailability = {
  day_of_week: number
  is_selected: boolean
  start_time: string
  end_time: string
}

export default function DoctorAvailabilityPage() {
  const [dayAvailability, setDayAvailability] = React.useState<
    DayAvailability[]
  >(
    DAYS.map((_, i) => ({
      day_of_week: i,
      is_selected: false,
      start_time: "09:00",
      end_time: "17:00",
    }))
  )
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [isAvailable, setIsAvailable] = React.useState(true)
  const [availabilityLoading, setAvailabilityLoading] = React.useState(true)
  const [availabilitySaving, setAvailabilitySaving] = React.useState(false)
  const [userId, setUserId] = React.useState<string | null>(null)

  React.useEffect(() => {
    Promise.all([
      fetch("/api/availability").then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()),
    ]).then(([availabilityData]) => {
      const existing = availabilityData.availability ?? []
      const newAvailability = DAYS.map((_, i) => {
        const daySlots = existing.filter(
          (s: any) => s.day_of_week === i && s.is_active
        )
        if (daySlots.length > 0) {
          const first = daySlots[0]
          const last = daySlots[daySlots.length - 1]
          return {
            day_of_week: i,
            is_selected: true,
            start_time: first.start_time,
            end_time: last.end_time,
          }
        }
        return {
          day_of_week: i,
          is_selected: false,
          start_time: "09:00",
          end_time: "17:00",
        }
      })
      setDayAvailability(newAvailability)
      setLoading(false)
    })
  }, [])

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
      setAvailabilityLoading(false)
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

  const toggleAvailability = async () => {
    if (!userId) return
    setAvailabilitySaving(true)
    const next = !isAvailable

    const { error } = await supabaseBrowserClient
      .from("doctor_settings")
      .upsert({
        doctor_id: userId,
        is_available: next,
        updated_at: new Date().toISOString(),
      })

    if (!error) {
      await supabaseBrowserClient.channel("doctor-availability").send({
        type: "broadcast" as const,
        event: "availability_changed",
        payload: { doctor_id: userId, is_available: next },
      })
    }

    setAvailabilitySaving(false)
    if (!error) {
      setIsAvailable(next)
    }
  }

  const toggleDay = (day: number) => {
    setDayAvailability((prev) =>
      prev.map((d) =>
        d.day_of_week === day ? { ...d, is_selected: !d.is_selected } : d
      )
    )
  }

  const updateTime = (
    day: number,
    field: "start_time" | "end_time",
    value: string
  ) => {
    setDayAvailability((prev) =>
      prev.map((d) => (d.day_of_week === day ? { ...d, [field]: value } : d))
    )
  }

  const save = async () => {
    setSaving(true)

    const slots = dayAvailability
      .filter((d) => d.is_selected)
      .map(({ day_of_week, start_time, end_time }) => ({
        day_of_week,
        start_time,
        end_time,
        is_active: true,
      }))

    const res = await fetch("/api/availability/replace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(slots),
    })

    setSaving(false)

    if (res.ok) {
      toast.success("Schedule saved", {
        description: "Your weekly availability has been updated successfully.",
      })
    } else {
      const data = await res.json()
      toast.error("Failed to save", {
        description: data.error || "Something went wrong.",
      })
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Weekly Schedule</h1>
          <p className="text-sm text-muted-foreground">
            Set your regular hours for appointments.
          </p>
        </div>
        <Button onClick={save} disabled={saving} className="gap-2">
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>

      <div className="rounded-xl border bg-background p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold">Accepting Appointments</p>
            <p className="text-sm text-muted-foreground">
              Toggle this off to stop receiving new bookings. Existing
              appointments are unaffected.
            </p>
          </div>
          {availabilityLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <button
              onClick={toggleAvailability}
              disabled={availabilitySaving}
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
        {!availabilityLoading && (
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
      </div>

      <div className="overflow-hidden rounded-xl border bg-background text-card-foreground shadow-sm">
        {loading ? (
          <div className="flex flex-col">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 border-b p-5">
                <Skeleton className="h-6 w-10 rounded-full" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="ml-auto hidden h-9 w-[180px] sm:block" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col divide-y">
            {dayAvailability.map((day, i) => {
              const isSelected = day.is_selected
              return (
                <div
                  key={i}
                  className={cn(
                    "flex flex-col gap-4 px-4 py-3 transition-colors hover:bg-muted/20 sm:flex-row sm:items-center",
                    !isSelected && "opacity-80"
                  )}
                >
                  <div className="flex w-40 min-w-[160px] items-center gap-4">
                    <Switch
                      checked={isSelected}
                      onCheckedChange={() => toggleDay(i)}
                    />
                    <span
                      className={cn(
                        "font-medium",
                        isSelected ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {DAYS[i]}
                    </span>
                  </div>

                  <div className="flex-1">
                    {isSelected ? (
                      <div className="flex items-center gap-2">
                        <div className="flex h-10 w-full items-center gap-2 rounded-md border bg-background px-3 py-1 shadow-sm transition-all focus-within:ring-2 focus-within:ring-primary sm:w-auto">
                          <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <input
                            type="time"
                            value={day.start_time}
                            onChange={(e) =>
                              updateTime(i, "start_time", e.target.value)
                            }
                            className="w-full bg-transparent text-sm focus:outline-none"
                          />
                        </div>
                        <span className="px-1 font-medium text-muted-foreground">
                          -
                        </span>
                        <div className="flex h-10 w-full items-center gap-2 rounded-md border bg-background px-3 py-1 shadow-sm transition-all focus-within:ring-2 focus-within:ring-primary sm:w-auto">
                          <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <input
                            type="time"
                            value={day.end_time}
                            onChange={(e) =>
                              updateTime(i, "end_time", e.target.value)
                            }
                            className="w-full bg-transparent text-sm focus:outline-none"
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="flex h-10 items-center text-sm text-muted-foreground italic">
                        Not available
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
