"use client"

import * as React from "react"
import {
  CalendarDays,
  Users,
  Stethoscope,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { useRealtimeTable } from "@/lib/hooks/use-realtime-table"

type Stats = {
  total: number
  scheduled: number
  completed: number
  cancelled: number
  rescheduled: number
  doctors: number
  clients: number
}

const STAT_CARDS = (s: Stats) => [
  {
    label: "Total Appointments",
    value: s.total,
    icon: CalendarDays,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    label: "Scheduled",
    value: s.scheduled,
    icon: Clock,
    color: "text-yellow-500",
    bg: "bg-yellow-500/10",
  },
  {
    label: "Completed",
    value: s.completed,
    icon: CheckCircle,
    color: "text-green-500",
    bg: "bg-green-500/10",
  },
  {
    label: "Cancelled",
    value: s.cancelled,
    icon: XCircle,
    color: "text-red-500",
    bg: "bg-red-500/10",
  },
  {
    label: "Rescheduled",
    value: s.rescheduled,
    icon: RefreshCw,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
  },
  {
    label: "Doctors",
    value: s.doctors,
    icon: Stethoscope,
    color: "text-teal-500",
    bg: "bg-teal-500/10",
  },
  {
    label: "Clients",
    value: s.clients,
    icon: Users,
    color: "text-orange-500",
    bg: "bg-orange-500/10",
  },
]

export default function AdminDashboard() {
  const [stats, setStats] = React.useState<Stats>({
    total: 0,
    scheduled: 0,
    completed: 0,
    cancelled: 0,
    rescheduled: 0,
    doctors: 0,
    clients: 0,
  })
  const [recentAppointments, setRecentAppointments] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)

  const refreshStats = React.useCallback(() => {
    void fetch("/api/admin/stats")
      .then((r) => r.json())
      .then((data) => {
        if (data.stats) setStats(data.stats)
        if (data.recentAppointments) setRecentAppointments(data.recentAppointments)
      })
  }, [])

  React.useEffect(() => {
    refreshStats()
    setLoading(false)
  }, [refreshStats])

  // Realtime: refresh stats when appointments change
  useRealtimeTable({
    table: "appointments",
    onchange: refreshStats,
  })

  const cards = STAT_CARDS(stats)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Overview of all appointments and activity.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, color, bg }) => (
          <div
            key={label}
            className="flex items-center gap-4 rounded-xl border bg-background p-5 shadow-sm"
          >
            <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${bg}`}>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-2xl font-bold">
                {loading ? "—" : value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Recent appointments */}
      <div className="rounded-xl border bg-background shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold">Recent Appointments</h2>
        </div>
        <div className="divide-y">
          {loading ? (
            <div className="divide-y">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-3">
                  <div className="flex flex-col gap-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-44" />
                  </div>
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
              ))}
            </div>
          ) : recentAppointments.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">
              No appointments yet.
            </p>
          ) : (
            recentAppointments.map((appt) => (
              <div
                key={appt.id}
                className="flex items-center justify-between px-5 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">{appt.patient_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(appt.scheduled_at).toLocaleString()}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    appt.status === "completed"
                      ? "bg-green-100 text-green-700"
                      : appt.status === "cancelled"
                        ? "bg-red-100 text-red-700"
                        : appt.status === "rescheduled"
                          ? "bg-purple-100 text-purple-700"
                          : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {appt.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
