"use client"

import * as React from "react"
import Link from "next/link"
import { PlusCircle, Loader2, Search, XCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { RescheduleDialog } from "@/components/reschedule-dialog"
import { useRealtimeTable } from "@/lib/hooks/use-realtime-table"
import { cn } from "@/lib/utils"

type Appointment = {
  id: string
  patient_name: string
  doctor_id: string
  specialty_id: string | null
  status: string
  scheduled_at: string
  notes: string | null
  dependent_name: string | null
  specialties: { name: string } | null
  profiles: { full_name: string } | null
}

const STATUS_STYLES: Record<string, string> = {
  scheduled: "bg-yellow-100 text-yellow-700",
  rescheduled: "bg-purple-100 text-purple-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  review: "bg-blue-100 text-blue-700",
}

const STATUSES = ["all", "scheduled", "rescheduled", "completed", "review", "cancelled"] as const
type Filter = (typeof STATUSES)[number]

export default function ClientAppointmentsPage() {
  const [appointments, setAppointments] = React.useState<Appointment[]>([])
  const [loading, setLoading] = React.useState(true)
  const [filter, setFilter] = React.useState<Filter>("all")
  const [search, setSearch] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)

  // Reschedule dialog state
  const [rescheduleAppt, setRescheduleAppt] = React.useState<Appointment | null>(null)
  const [actionId, setActionId] = React.useState<string | null>(null)

  const fetchAppointments = React.useCallback(() => {
    setLoading(true)
    void fetch("/api/appointments")
      .then((r) => r.json())
      .then((d) => setAppointments(d.appointments ?? []))
      .finally(() => setLoading(false))
  }, [])

  // Realtime: refresh appointments when anything changes
  useRealtimeTable({
    table: "appointments",
    onchange: () => void fetchAppointments(),
  })

  React.useEffect(() => { fetchAppointments() }, [fetchAppointments])

  const cancel = async (id: string) => {
    setActionId(id)
    setError(null)
    const res = await fetch(`/api/appointments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    })
    setActionId(null)
    if (!res.ok) { setError("Failed to cancel appointment"); return }
    fetchAppointments()
  }

  const handleRescheduleSuccess = () => {
    setRescheduleAppt(null)
    fetchAppointments()
  }

  const filtered = appointments.filter((a) => {
    const matchStatus = filter === "all" || a.status === filter
    const q = search.toLowerCase()
    const matchSearch =
      !q ||
      a.profiles?.full_name?.toLowerCase().includes(q) ||
      a.specialties?.name?.toLowerCase().includes(q) ||
      a.status.includes(q) ||
      a.dependent_name?.toLowerCase().includes(q)
    return matchStatus && matchSearch
  })

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Appointments</h1>
          <p className="text-sm text-muted-foreground">View, reschedule or cancel your appointments.</p>
        </div>
        <Button asChild className="gap-2">
          <Link href="/client/book">
            <PlusCircle className="h-4 w-4" /> Book new
          </Link>
        </Button>
      </div>

      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Search + filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Search doctor, specialty…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border bg-background py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors",
                filter === s
                  ? "border-primary bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs font-medium uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Doctor</th>
                <th className="px-4 py-3">Specialty</th>
                <th className="px-4 py-3">Date & Time</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[...Array(4)].map((_, i) => (
                <tr key={i}>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-36" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-5 w-20 rounded-full" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-6 w-24" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border bg-background py-14 text-center">
          <p className="text-sm text-muted-foreground">No appointments found.</p>
          <Button asChild size="sm" variant="outline">
            <Link href="/client/book">Book an appointment</Link>
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs font-medium uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Doctor</th>
                <th className="px-4 py-3">Specialty</th>
                <th className="px-4 py-3 hidden sm:table-cell">Date & Time</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((a) => {
                const isActive = ["scheduled", "rescheduled"].includes(a.status)
                const isBusy = actionId === a.id
                return (
                  <tr key={a.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <p className="font-medium">{a.profiles?.full_name ?? "—"}</p>
                      {a.dependent_name && (
                        <p className="text-xs text-muted-foreground">For: {a.dependent_name}</p>
                      )}
                      {/* Show date on mobile */}
                      <p className="text-xs text-muted-foreground sm:hidden mt-0.5">
                        {new Date(a.scheduled_at).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {a.specialties?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                      {new Date(a.scheduled_at).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_STYLES[a.status] ?? "bg-muted")}>
                        {a.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {isActive ? (
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => setRescheduleAppt(a)}
                            disabled={isBusy}
                            className="flex items-center gap-1 rounded-lg border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-50"
                          >
                            <RefreshCw className="h-3 w-3" /> Reschedule
                          </button>
                          <button
                            onClick={() => cancel(a.id)}
                            disabled={isBusy}
                            className="flex items-center gap-1 rounded-lg border px-2 py-1 text-xs text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                          >
                            {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <RescheduleDialog
        appointment={rescheduleAppt}
        open={!!rescheduleAppt}
        onClose={() => setRescheduleAppt(null)}
        onSuccess={handleRescheduleSuccess}
      />
    </div>
  )
}
