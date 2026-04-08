"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Save } from "lucide-react"
import { cn } from "@/lib/utils"

export default function AdminSettingsPage() {
  const [bufferHours, setBufferHours] = React.useState("2")
  const [rescheduleStyle, setRescheduleStyle] = React.useState<"dialog" | "inline">("dialog")
  const [message, setMessage] = React.useState<{ text: string; ok: boolean } | null>(null)
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    void fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setBufferHours(String(data.settings?.booking_buffer_hours ?? 2))
        setRescheduleStyle(data.settings?.reschedule_style ?? "dialog")
      })
  }, [])

  const save = async () => {
    setLoading(true)
    setMessage(null)
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        booking_buffer_hours: Number(bufferHours),
        reschedule_style: rescheduleStyle,
      }),
    })
    setLoading(false)
    setMessage(
      res.ok
        ? { text: "Settings saved.", ok: true }
        : { text: "Failed to save settings.", ok: false },
    )
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
        {message && (
          <p className={`text-sm ${message.ok ? "text-green-600" : "text-destructive"}`}>
            {message.text}
          </p>
        )}
      </div>
    </div>
  )
}
