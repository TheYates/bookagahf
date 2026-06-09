"use client"

import * as React from "react"
import { Database, RefreshCw, AlertTriangle, HardDrive, Table2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

type TableInfo = {
  table_name: string
  row_count: number
  total_bytes: number
}

type DbStatus = {
  totalBytes: number
  limitBytes: number
  usagePercent: number
  tables: TableInfo[]
  note?: string
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const units = ["B", "KB", "MB", "GB"]
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / Math.pow(1024, i)
  return `${value.toFixed(i === 0 ? 0 : 2)} ${units[i]}`
}

function getUsageColor(percent: number): {
  bar: string
  text: string
  bg: string
  glow: string
} {
  if (percent >= 80) {
    return {
      bar: "bg-red-500",
      text: "text-red-500",
      bg: "bg-red-500/10",
      glow: "shadow-red-500/20",
    }
  }
  if (percent >= 60) {
    return {
      bar: "bg-yellow-500",
      text: "text-yellow-500",
      bg: "bg-yellow-500/10",
      glow: "shadow-yellow-500/20",
    }
  }
  return {
    bar: "bg-emerald-500",
    text: "text-emerald-500",
    bg: "bg-emerald-500/10",
    glow: "shadow-emerald-500/20",
  }
}

export default function AdminDatabasesPage() {
  const [data, setData] = React.useState<DbStatus | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(() => {
    setLoading(true)
    setError(null)

    void fetch("/api/admin/db-status")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((d) => {
        if (d.error) {
          setError(d.error)
        } else {
          setData(d)
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  React.useEffect(() => {
    load()
  }, [load])

  const colors = data ? getUsageColor(data.usagePercent) : getUsageColor(0)
  const maxTableBytes = data?.tables?.[0]?.total_bytes ?? 1

  return (
    <div className="flex flex-col gap-6">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Database Storage</h1>
          <p className="text-sm text-muted-foreground">
            Monitor your Supabase database usage against the free-tier limit.
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

      {/* ── Error state ── */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">Failed to load database status</p>
            <p className="mt-0.5 text-xs opacity-80">{error}</p>
          </div>
        </div>
      )}

      {/* ── Overall Usage Card ── */}
      <div
        className={cn(
          "rounded-xl border bg-background p-6 shadow-sm",
          data && data.usagePercent >= 80 && "shadow-lg",
          data && colors.glow,
        )}
      >
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-full rounded-full" />
            <Skeleton className="h-3 w-48" />
          </div>
        ) : data ? (
          <>
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-lg",
                  colors.bg,
                )}
              >
                <HardDrive className={cn("h-5 w-5", colors.text)} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Overall Usage</p>
                <p className="text-2xl font-bold">
                  {formatBytes(data.totalBytes)}{" "}
                  <span className="text-base font-normal text-muted-foreground">
                    / {formatBytes(data.limitBytes)}
                  </span>
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-4">
              <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-700 ease-out",
                    colors.bar,
                  )}
                  style={{ width: `${Math.min(data.usagePercent, 100)}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span className={cn("font-semibold", colors.text)}>
                  {data.usagePercent}% used
                </span>
                <span>{formatBytes(data.limitBytes - data.totalBytes)} remaining</span>
              </div>
            </div>

            {/* Upgrade recommendation */}
            {data.usagePercent >= 80 && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm dark:border-yellow-900/50 dark:bg-yellow-950/30">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600 dark:text-yellow-400" />
                <div>
                  <p className="font-medium text-yellow-800 dark:text-yellow-300">
                    Storage running low
                  </p>
                  <p className="mt-0.5 text-xs text-yellow-700 dark:text-yellow-400">
                    Consider upgrading to Supabase Pro ($25/mo) for 8 GB of database storage.
                    This is a zero-code-change upgrade — same URL, same keys.
                  </p>
                </div>
              </div>
            )}

            {data.note && (
              <p className="mt-3 text-xs italic text-muted-foreground">{data.note}</p>
            )}
          </>
        ) : null}
      </div>

      {/* ── Summary Cards ── */}
      {!loading && data && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border bg-background p-4 shadow-sm">
            <p className="text-sm text-muted-foreground">Tables</p>
            <p className="mt-1 text-2xl font-bold">{data.tables.length}</p>
          </div>
          <div className="rounded-xl border bg-background p-4 shadow-sm">
            <p className="text-sm text-muted-foreground">Total Rows</p>
            <p className="mt-1 text-2xl font-bold">
              {data.tables
                .reduce((sum, t) => sum + t.row_count, 0)
                .toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl border bg-background p-4 shadow-sm">
            <p className="text-sm text-muted-foreground">Avg Row Size</p>
            <p className="mt-1 text-2xl font-bold">
              {(() => {
                const totalRows = data.tables.reduce((s, t) => s + t.row_count, 0)
                const totalTableBytes = data.tables.reduce((s, t) => s + t.total_bytes, 0)
                return totalRows > 0
                  ? formatBytes(Math.round(totalTableBytes / totalRows))
                  : "—"
              })()}
            </p>
          </div>
        </div>
      )}

      {/* ── Per-Table Breakdown ── */}
      <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
        <div className="flex items-center gap-3 border-b px-5 py-4">
          <Table2 className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold">Per-Table Breakdown</h2>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-5 py-3 text-left font-medium">Table</th>
              <th className="px-5 py-3 text-right font-medium">Rows</th>
              <th className="px-5 py-3 text-right font-medium">Size</th>
              <th className="hidden px-5 py-3 text-right font-medium sm:table-cell">
                % of Total
              </th>
              <th className="hidden px-5 py-3 text-left font-medium md:table-cell">
                Relative
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-5 py-3" colSpan={5}>
                    <Skeleton className="h-4 w-full" />
                  </td>
                </tr>
              ))
            ) : !data || data.tables.length === 0 ? (
              <tr>
                <td
                  className="px-5 py-12 text-center text-muted-foreground"
                  colSpan={5}
                >
                  <Database className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  No table data available.
                </td>
              </tr>
            ) : (
              data.tables.map((table) => {
                const pct =
                  data.totalBytes > 0
                    ? Math.round((table.total_bytes / data.totalBytes) * 10000) / 100
                    : 0
                const relativePct =
                  maxTableBytes > 0
                    ? Math.round((table.total_bytes / maxTableBytes) * 100)
                    : 0

                return (
                  <tr key={table.table_name} className="hover:bg-muted/30">
                    <td className="px-5 py-3">
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
                        {table.table_name}
                      </code>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {table.row_count.toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums font-medium">
                      {formatBytes(table.total_bytes)}
                    </td>
                    <td className="hidden px-5 py-3 text-right tabular-nums text-muted-foreground sm:table-cell">
                      {pct}%
                    </td>
                    <td className="hidden px-5 py-3 md:table-cell">
                      <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary/60 transition-all duration-500"
                          style={{ width: `${relativePct}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
