"use client"

import * as React from "react"
import { motion } from "framer-motion"
import {
  CheckCircle,
  RefreshCw,
  CalendarDays,
  Loader2,
  Clock,
  User,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

type Appointment = {
  id: string
  patient_name: string
  dependent_name: string | null
  scheduled_at: string
  status: string
  notes: string | null
  contact_phone: string | null
  x_number: string | null
  company_number: string | null
}

const STATUS_STYLES: Record<string, string> = {
  scheduled: "bg-yellow-100 text-yellow-700",
  rescheduled: "bg-purple-100 text-purple-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  review: "bg-blue-100 text-blue-700",
}

const FILTERS = ["all", "scheduled", "rescheduled", "completed", "review", "cancelled"] as const
type Filter = (typeof FILTERS)[number]

export default function DoctorAppointmentsPage() {
  const [appointments, setAppointments] = React.useState<Appointment[]>([])
  const [loading, setLoading] = React.useState(true)
  const [filter, setFilter] = React.useState<Filter>("all")
  const [actionId, setActionId] = React.useState<string | null>(null)
  const [rescheduleId, setRescheduleId] = React.useState<string | null>(null)
  const [newDate, setNewDate] = React.useState("")
  const [newTime, setNewTime] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)

  const fetchAppointments = React.useCallback(() => {
    setLoading(true)
    void fetch("/api/appointments")
      .then((r) => r.json())
      .then((d) => setAppointments(d.appointments ?? []))
      .finally(() => setLoading(false))
  }, [])

  React.useEffect(() => { fetchAppointments() }, [fetchAppointments])

  const updateStatus = async (id: string, status: string, extra?: Record<string, string>) => {
    setActionId(id)
    setError(null)
    const res = await fetch(`/api/appointments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, ...extra }),
    })
    setActionId(null)
    if (!res.ok) { setError("Failed to update appointment"); return }
    if (rescheduleId === id) { setRescheduleId(null); setNewDate(""); setNewTime("") }
    fetchAppointments()
  }

  const reschedule = async (id: string) => {
    if (!newDate || !newTime) { setError("Please pick a new date and time."); return }
    const scheduledAt = new Date(`${newDate}T${newTime}:00`).toISOString()
    await updateStatus(id, "rescheduled", { scheduled_at: scheduledAt })
  }

  const filtered = filter === "all" ? appointments : appointments.filter((a) => a.status === filter)

  const counts = React.useMemo(() => {
    const c: Record<string, number> = {}
    appointments.forEach((a) => { c[a.status] = (c[a.status] ?? 0) + 1 })
    return c
  }, [appointments])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Appointments</h1>
        <p className="text-sm text-muted-foreground">Manage your patient appointments.</p>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors",
              filter === f
                ? "border-primary bg-primary text-primary-foreground"
                : "text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            {f}{f !== "all" && counts[f] ? ` (${counts[f]})` : ""}
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex flex-col gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-xl border bg-background p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-2 flex-1">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-40" />
                </div>
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border bg-background py-16 text-center">
          <CalendarDays className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No appointments found.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((appt) => {
            const isActive = ["scheduled", "rescheduled"].includes(appt.status)
            const isBusy = actionId === appt.id
            const isRescheduling = rescheduleId === appt.id

            return (
              <motion.div layout key={appt.id} className="rounded-xl border bg-background p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <p className="font-medium">{appt.patient_name}</p>
                      {appt.x_number && <span className="text-xs text-muted-foreground">({appt.x_number})</span>}
                    </div>
                    {appt.dependent_name && (
                      <p className="pl-6 text-xs text-muted-foreground">For dependant: {appt.dependent_name}</p>
                    )}
                    <div className="flex items-center gap-2 pl-6 text-sm text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      {new Date(appt.scheduled_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                    </div>
                    {appt.contact_phone && (
                      <p className="pl-6 text-xs text-muted-foreground">📞 {appt.contact_phone}</p>
                    )}
                    {appt.notes && (
                      <p className="mt-1 pl-6 text-xs italic text-muted-foreground">"{appt.notes}"</p>
                    )}
                  </div>
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium shrink-0", STATUS_STYLES[appt.status] ?? "bg-muted")}>
                    {appt.status}
                  </span>
                </div>

                {/* Reschedule form */}
                {isRescheduling && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 flex flex-wrap gap-2">
                    <input
                      type="date"
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                      className="rounded-lg border bg-muted/40 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <input
                      type="time"
                      value={newTime}
                      onChange={(e) => setNewTime(e.target.value)}
                      className="rounded-lg border bg-muted/40 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <Button size="sm" onClick={() => reschedule(appt.id)} disabled={isBusy} className="gap-1">
                      {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                      Confirm
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setRescheduleId(null); setNewDate(""); setNewTime("") }}>
                      Cancel
                    </Button>
                  </motion.div>
                )}

                {/* Action buttons */}
                {isActive && !isRescheduling && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => updateStatus(appt.id, "completed")} disabled={isBusy}>
                      {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3 text-green-600" />}
                      Mark completed
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => updateStatus(appt.id, "review")} disabled={isBusy}>
                      <CalendarDays className="h-3 w-3 text-blue-600" />
                      Set for review
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => { setRescheduleId(appt.id); setError(null) }} disabled={isBusy}>
                      <RefreshCw className="h-3 w-3 text-purple-600" />
                      Reschedule
                    </Button>
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
