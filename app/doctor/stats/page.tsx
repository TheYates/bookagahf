"use client"

import * as React from "react"
import {
  CalendarDays,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  AlertCircle,
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { useRealtimeTable } from "@/lib/hooks/use-realtime-table"
import { supabaseBrowserClient } from "@/lib/supabase/client"

type Stats = {
  total: number
  scheduled: number
  completed: number
  cancelled: number
  rescheduled: number
  review: number
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
    label: "Pending Review",
    value: s.review,
    icon: AlertCircle,
    color: "text-cyan-500",
    bg: "bg-cyan-500/10",
  },
]

export default function DoctorStatsPage() {
  const [stats, setStats] = React.useState<Stats>({
    total: 0,
    scheduled: 0,
    completed: 0,
    cancelled: 0,
    rescheduled: 0,
    review: 0,
  })
  const [loading, setLoading] = React.useState(true)

  const refreshStats = React.useCallback(async () => {
    const res = await fetch("/api/appointments")
    const data = await res.json()
    const appointments = data.appointments ?? []

    setStats({
      total: appointments.length,
      scheduled: appointments.filter((a: any) => a.status === "scheduled")
        .length,
      completed: appointments.filter((a: any) => a.status === "completed")
        .length,
      cancelled: appointments.filter((a: any) => a.status === "cancelled")
        .length,
      rescheduled: appointments.filter((a: any) => a.status === "rescheduled")
        .length,
      review: appointments.filter((a: any) => a.status === "review").length,
    })
  }, [])

  React.useEffect(() => {
    refreshStats().finally(() => setLoading(false))
  }, [refreshStats])

  useRealtimeTable({
    table: "appointments",
    onchange: refreshStats,
  })

  const cards = STAT_CARDS(stats)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Stats</h1>
        <p className="text-sm text-muted-foreground">
          Snapshot of your appointment activity.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ label, value, icon: Icon, color, bg }) => (
          <div
            key={label}
            className="flex items-center gap-4 rounded-xl border bg-background p-5 shadow-sm"
          >
            <div
              className={`flex h-11 w-11 items-center justify-center rounded-lg ${bg}`}
            >
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-2xl font-bold">{loading ? "—" : value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
