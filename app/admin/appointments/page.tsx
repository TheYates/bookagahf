"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { CalendarDays, Search, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { useRealtimeTable } from "@/lib/hooks/use-realtime-table"

type Appointment = {
  id: string
  patient_name: string
  x_number: string | null
  company_number: string | null
  dependent_name: string | null
  contact_phone: string | null
  doctor_id: string
  status: string
  scheduled_at: string
  notes: string | null
}

const STATUS_STYLES: Record<string, string> = {
  scheduled: "bg-yellow-100 text-yellow-700",
  rescheduled: "bg-purple-100 text-purple-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  review: "bg-blue-100 text-blue-700",
}

const STATUSES = ["all", "scheduled", "rescheduled", "completed", "review", "cancelled"]

export default function AdminAppointmentsPage() {
  const [appointments, setAppointments] = React.useState<Appointment[]>([])
  const [loading, setLoading] = React.useState(true)
  const [filter, setFilter] = React.useState("all")
  const [search, setSearch] = React.useState("")

  const fetchAppointments = React.useCallback(() => {
    void fetch("/api/appointments")
      .then((r) => r.json())
      .then((d) => setAppointments(d.appointments ?? []))
      .finally(() => setLoading(false))
  }, [])

  React.useEffect(() => { fetchAppointments() }, [fetchAppointments])

  useRealtimeTable({
    table: "appointments",
    onchange: fetchAppointments,
  })

  const filtered = appointments.filter((a) => {
    const matchStatus = filter === "all" || a.status === filter
    const q = search.toLowerCase()
    const matchSearch =
      !q ||
      a.patient_name.toLowerCase().includes(q) ||
      a.x_number?.toLowerCase().includes(q) ||
      a.contact_phone?.includes(q) ||
      a.dependent_name?.toLowerCase().includes(q)
    return matchStatus && matchSearch
  })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Appointments</h1>
        <p className="text-sm text-muted-foreground">All appointments across all doctors.</p>
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Search by name, X-number, phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border bg-background py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex flex-wrap gap-2">
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

      {loading ? (
        <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs font-medium uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Patient</th>
                <th className="px-4 py-3">X-Number</th>
                <th className="px-4 py-3">Scheduled</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-32" />
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-24" />
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-40" />
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-28" />
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border bg-background py-16 text-center">
          <CalendarDays className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No appointments found.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs font-medium uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Patient</th>
                <th className="px-4 py-3">X-Number</th>
                <th className="px-4 py-3">Scheduled</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((a) => (
                <motion.tr layout key={a.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <p className="font-medium">{a.patient_name}</p>
                    {a.dependent_name && (
                      <p className="text-xs text-muted-foreground">For: {a.dependent_name}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{a.x_number ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(a.scheduled_at).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{a.contact_phone ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_STYLES[a.status] ?? "bg-muted")}>
                      {a.status}
                    </span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
