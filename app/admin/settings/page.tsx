"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Save } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

export default function AdminSettingsPage() {
  const [bufferHours, setBufferHours] = React.useState("2")
  const [appointmentDuration, setAppointmentDuration] = React.useState("30")
  const [rescheduleStyle, setRescheduleStyle] = React.useState<"dialog" | "inline">("dialog")
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    void fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setBufferHours(String(data.settings?.booking_buffer_hours ?? 2))
        setAppointmentDuration(String(data.settings?.appointment_duration ?? 30))
        setRescheduleStyle(data.settings?.reschedule_style ?? "dialog")
      })
  }, [])

  const save = async () => {
    setLoading(true)
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appointment_duration: Number(appointmentDuration),
      }),
    })
    setLoading(false)
    
    if (res.ok) {
      toast.success("Settings saved", {
        description: "Appointment duration has been updated.",
      })
    } else {
      const data = await res.json()
      toast.error("Failed to save settings", {
        description: data.error || "Something went wrong.",
      })
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Configure global booking rules.</p>
      </div>

      {/* Booking buffer */}
      <div className="rounded-xl border bg-background p-6 shadow-sm">
        <h2 className="font-semibold">Booking Buffer</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Minimum number of hours before an appointment can be booked.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <input
            type="number"
            min="0"
            max="72"
            value={bufferHours}
            onChange={(e) => setBufferHours(e.target.value)}
            className="w-28 rounded-lg border bg-muted/40 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <span className="text-sm text-muted-foreground">hours</span>
        </div>
      </div>

      {/* Appointment duration */}
      <div className="rounded-xl border bg-background p-6 shadow-sm">
        <h2 className="font-semibold">Appointment Duration</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Length of each appointment in minutes. This determines how many slots are available.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <select
            value={appointmentDuration}
            onChange={(e) => setAppointmentDuration(e.target.value)}
            className="w-40 rounded-lg border bg-muted/40 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="15">15 minutes</option>
            <option value="30">30 minutes</option>
            <option value="45">45 minutes</option>
            <option value="60">60 minutes</option>
          </select>
        </div>
      </div>

      {/* Reschedule style */}
      <div className="rounded-xl border bg-background p-6 shadow-sm">
        <h2 className="font-semibold">Reschedule Style</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          How clients reschedule their appointments.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {(["dialog", "inline"] as const).map((style) => (
            <button
              key={style}
              onClick={() => setRescheduleStyle(style)}
              className={cn(
                "rounded-lg border p-4 text-left text-sm transition-colors",
                rescheduleStyle === style
                  ? "border-primary bg-primary/5 text-primary"
                  : "text-muted-foreground hover:border-primary/40",
              )}
            >
              <p className="font-semibold capitalize">{style}</p>
              <p className="mt-0.5 text-xs">
                {style === "dialog"
                  ? "Opens a full date/time picker in a modal"
                  : "Expands inline within the appointments table"}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Save button */}
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={loading} className="gap-2">
          <Save className="h-4 w-4" />
          {loading ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </div>
  )
}
