"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Save } from "lucide-react"

export default function AdminSettingsPage() {
  const [bufferHours, setBufferHours] = React.useState("2")
  const [message, setMessage] = React.useState<{ text: string; ok: boolean } | null>(null)
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    void fetch("/api/settings")
      .then((r) => r.json())
      .then((data) =>
        setBufferHours(String(data.settings?.booking_buffer_hours ?? 2)),
      )
  }, [])

  const save = async () => {
    setLoading(true)
    setMessage(null)
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ booking_buffer_hours: Number(bufferHours) }),
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
        <p className="text-sm text-muted-foreground">
          Configure global booking rules.
        </p>
      </div>

      <div className="rounded-xl border bg-background p-6 shadow-sm">
        <h2 className="font-semibold">Booking Buffer</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Minimum number of hours before an appointment can be booked. Set by admin.
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
          <Button onClick={save} disabled={loading} className="ml-2 gap-2">
            <Save className="h-4 w-4" />
            {loading ? "Saving…" : "Save"}
          </Button>
        </div>
        {message && (
          <p
            className={`mt-3 text-sm ${message.ok ? "text-green-600" : "text-destructive"}`}
          >
            {message.text}
          </p>
        )}
      </div>
    </div>
  )
}
