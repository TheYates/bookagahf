"use client"

import * as React from "react"
import { Activity, CheckCircle, XCircle, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

type HealthLog = {
  id: string
  check_type: "daily_health" | "supabase_keepalive"
  status: "ok" | "error"
  response_ms: number | null
  message: string | null
  created_at: string
}

type SummaryEntry = {
  check_type: "daily_health" | "supabase_keepalive"
  status: "ok" | "error"
  response_ms: number | null
  created_at: string
} | null

type Summary = {
  lastDaily: SummaryEntry
  lastKeepalive: SummaryEntry
  errorsLast7Days: number
}

const FILTERS = [
  { value: "all", label: "All" },
  { value: "daily_health", label: "Daily Health" },
  { value: "supabase_keepalive", label: "Supabase Keep-alive" },
] as const

const CHECK_TYPE_LABELS: Record<HealthLog["check_type"], string> = {
  daily_health: "Daily Health",
  supabase_keepalive: "Supabase Keep-alive",
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

function SummaryCard({
  label,
  entry,
  loading,
}: {
  label: string
  entry: SummaryEntry
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="rounded-xl border bg-background p-4 shadow-sm">
        <Skeleton className="mb-2 h-4 w-24" />
        <Skeleton className="h-6 w-32" />
      </div>
    )
  }

  return (
    <div className="rounded-xl border bg-background p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      {entry ? (
        <div className="mt-1 flex items-center gap-2">
          {entry.status === "ok" ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : (
            <XCircle className="h-4 w-4 text-red-500" />
          )}
          <span className="font-semibold capitalize">{entry.status}</span>
          <span className="text-sm text-muted-foreground">
            · {entry.response_ms ?? "—"} ms · {formatDateTime(entry.created_at)}
          </span>
        </div>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">No checks yet</p>
      )}
    </div>
  )
}

export default function AdminHealthPage() {
  const [logs, setLogs] = React.useState<HealthLog[]>([])
  const [summary, setSummary] = React.useState<Summary>({
    lastDaily: null,
    lastKeepalive: null,
    errorsLast7Days: 0,
  })
  const [loading, setLoading] = React.useState(true)
  const [filter, setFilter] = React.useState<(typeof FILTERS)[number]["value"]>("all")

  const load = React.useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ limit: "50" })
    if (filter !== "all") {
      params.set("type", filter)
    }

    void fetch(`/api/admin/health-logs?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setLogs(d.logs ?? [])
        setSummary(
          d.summary ?? {
            lastDaily: null,
            lastKeepalive: null,
            errorsLast7Days: 0,
          },
        )
      })
      .finally(() => setLoading(false))
  }, [filter])

  React.useEffect(() => {
    load()
  }, [load])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">System Health</h1>
          <p className="text-sm text-muted-foreground">
            Database health checks and Supabase keep-alive logs.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard label="Last Daily Check" entry={summary.lastDaily} loading={loading} />
        <SummaryCard
          label="Last Keep-alive"
          entry={summary.lastKeepalive}
          loading={loading}
        />
        <div className="rounded-xl border bg-background p-4 shadow-sm">
          {loading ? (
            <>
              <Skeleton className="mb-2 h-4 w-24" />
              <Skeleton className="h-6 w-16" />
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">Errors (7 days)</p>
              <p
                className={cn(
                  "mt-1 text-2xl font-bold",
                  summary.errorsLast7Days > 0 ? "text-red-500" : "text-green-500",
                )}
              >
                {summary.errorsLast7Days}
              </p>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
              filter === value
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:bg-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Time</th>
              <th className="px-4 py-3 text-left font-medium">Type</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Response</th>
              <th className="px-4 py-3 text-left font-medium">Message</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-4 py-3" colSpan={5}>
                    <Skeleton className="h-4 w-full" />
                  </td>
                </tr>
              ))
            ) : logs.length === 0 ? (
              <tr>
                <td className="px-4 py-12 text-center text-muted-foreground" colSpan={5}>
                  <Activity className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  No health checks logged yet.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatDateTime(log.created_at)}
                  </td>
                  <td className="px-4 py-3">{CHECK_TYPE_LABELS[log.check_type]}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                        log.status === "ok"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700",
                      )}
                    >
                      {log.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">{log.response_ms ?? "—"} ms</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {log.message ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
