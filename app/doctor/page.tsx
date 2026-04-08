"use client"

import * as React from "react"
import {
  CheckCircle,
  RefreshCw,
  CalendarDays,
  Loader2,
  Search,
  XCircle,
  Wifi,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { supabaseBrowserClient } from "@/lib/supabase/client"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { DateTimePicker } from "@/components/ui/date-time-picker"

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
  doctor_id: string
  specialties: { name: string } | null
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
  const [search, setSearch] = React.useState("")
  const [actionId, setActionId] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [isRealtime, setIsRealtime] = React.useState(false)
  const [doctorId, setDoctorId] = React.useState<string | null>(null)

  // Confirmation dialog
  const [confirmAction, setConfirmAction] = React.useState<{
    id: string
    status: "completed" | "review"
    patientName: string
  } | null>(null)

  // Reschedule dialog
  const [rescheduleAppt, setRescheduleAppt] = React.useState<Appointment | null>(null)
  const [date, setDate] = React.useState("")
  const [slot, setSlot] = React.useState("")
  const [slots, setSlots] = React.useState<string[]>([])
  const [slotsLoading, setSlotsLoading] = React.useState(false)
  const [availableDays, setAvailableDays] = React.useState<number[] | undefined>(undefined)
  const [rescheduleStep, setRescheduleStep] = React.useState<"datetime" | "confirm">("datetime")
  const [rescheduleSaving, setRescheduleSaving] = React.useState(false)

  const fetchAppointments = React.useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    const res = await fetch("/api/appointments")
    const data = await res.json()
    setAppointments(data.appointments ?? [])
    if (!silent) setLoading(false)
  }, [])

  // Initial load + get doctor ID
  React.useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabaseBrowserClient.auth.getUser()
      if (user) setDoctorId(user.id)
      await fetchAppointments()
    }
    void init()
  }, [fetchAppointments])

  // ── Realtime subscription ─────────────────────────────────────────────────
  React.useEffect(() => {
    const channel = supabaseBrowserClient
      .channel("doctor-appointments-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments" },
        async (payload) => {
          // Silently refresh
          await fetchAppointments(true)

          // Show toast for relevant events
          const appt = payload.new as any
          if (payload.eventType === "INSERT") {
            toast.info("New appointment booked", {
              description: `${appt.patient_name} · ${new Date(appt.scheduled_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`,
            })
          } else if (payload.eventType === "UPDATE") {
            const status = appt.status
            if (status === "cancelled") {
              toast.warning("Appointment cancelled", {
                description: `${appt.patient_name} cancelled their appointment.`,
              })
            } else if (status === "rescheduled") {
              toast.info("Appointment rescheduled", {
                description: `${appt.patient_name} rescheduled to ${new Date(appt.scheduled_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}.`,
              })
            }
          }
        },
      )
      .subscribe((status) => {
        setIsRealtime(status === "SUBSCRIBED")
      })

    return () => { void supabaseBrowserClient.removeChannel(channel) }
  }, [fetchAppointments])

  // Fetch slots when reschedule date changes
  React.useEffect(() => {
    if (!date || !rescheduleAppt) return
    setSlot("")
    setSlots([])
    setSlotsLoading(true)
    void fetch(`/api/doctors/${rescheduleAppt.doctor_id}/slots?date=${date}`)
      .then((r) => r.json())
      .then((d) => setSlots(d.slots ?? []))
      .finally(() => setSlotsLoading(false))
  }, [date, rescheduleAppt])

  const openReschedule = async (appt: Appointment) => {
    setRescheduleAppt(appt)
    setDate("")
    setSlot("")
    setRescheduleStep("datetime")
    setAvailableDays(undefined)
    const res = await fetch(`/api/doctors/${appt.doctor_id}/availability`)
    const data = await res.json()
    setAvailableDays(data.availableDays ?? [])
  }

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
    toast.success(`Appointment marked as ${status}`)
  }

  const confirmReschedule = async () => {
    if (!rescheduleAppt || !date || !slot) return
    setRescheduleSaving(true)
    const res = await fetch(`/api/appointments/${rescheduleAppt.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "rescheduled",
        scheduled_at: new Date(`${date}T${slot}:00`).toISOString(),
      }),
    })
    setRescheduleSaving(false)
    if (!res.ok) { setError("Failed to reschedule"); return }
    setRescheduleAppt(null)
    toast.success("Appointment rescheduled")
  }

  const counts = React.useMemo(() => {
    const c: Record<string, number> = {}
    appointments.forEach((a) => { c[a.status] = (c[a.status] ?? 0) + 1 })
    return c
  }, [appointments])

  const filtered = appointments.filter((a) => {
    const matchFilter = filter === "all" || a.status === filter
    const q = search.toLowerCase()
    const matchSearch = !q ||
      a.patient_name.toLowerCase().includes(q) ||
      a.x_number?.toLowerCase().includes(q) ||
      a.contact_phone?.includes(q) ||
      a.dependent_name?.toLowerCase().includes(q) ||
      a.specialties?.name?.toLowerCase().includes(q)
    return matchFilter && matchSearch
  })

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Appointments</h1>
          <p className="text-sm text-muted-foreground">Manage your patient appointments.</p>
        </div>
        {/* Realtime indicator */}
        <div className={cn(
          "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
          isRealtime ? "border-green-300 bg-green-50 text-green-700" : "border-muted text-muted-foreground",
        )}>
          <Wifi className="h-3 w-3" />
          {isRealtime ? "Live" : "Connecting…"}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1.5">
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

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          placeholder="Search patient, X-number, phone, specialty…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border bg-background py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Table */}
      {loading ? (
        <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs font-medium uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Patient</th>
                <th className="px-4 py-3 hidden sm:table-cell">Date & Time</th>
                <th className="px-4 py-3 hidden md:table-cell">Contact</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[...Array(5)].map((_, i) => (
                <tr key={i}>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                  <td className="px-4 py-3 hidden sm:table-cell"><Skeleton className="h-4 w-36" /></td>
                  <td className="px-4 py-3 hidden md:table-cell"><Skeleton className="h-4 w-24" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-5 w-20 rounded-full" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-6 w-40" /></td>
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
                <th className="px-4 py-3 hidden sm:table-cell">Date & Time</th>
                <th className="px-4 py-3 hidden md:table-cell">Contact</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((a) => {
                const isActive = ["scheduled", "rescheduled"].includes(a.status)
                const isBusy = actionId === a.id
                return (
                  <tr key={a.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium">{a.patient_name}</p>
                      {a.x_number && <p className="text-xs text-muted-foreground">{a.x_number}</p>}
                      {a.dependent_name && <p className="text-xs text-muted-foreground">For: {a.dependent_name}</p>}
                      {a.specialties?.name && <p className="text-xs text-muted-foreground">{a.specialties.name}</p>}
                      {/* Show date on mobile */}
                      <p className="text-xs text-muted-foreground sm:hidden mt-0.5">
                        {new Date(a.scheduled_at).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                      </p>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">
                      {new Date(a.scheduled_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                      {a.contact_phone ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_STYLES[a.status] ?? "bg-muted")}>
                        {a.status}
                      </span>
                      {a.notes && (
                        <p className="mt-0.5 text-xs italic text-muted-foreground line-clamp-1">"{a.notes}"</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isActive ? (
                        <div className="flex flex-wrap gap-1">
                          <button
                            onClick={() => setConfirmAction({ id: a.id, status: "completed", patientName: a.patient_name })}
                            disabled={isBusy}
                            className="flex items-center gap-1 rounded-lg border px-2 py-1 text-xs text-green-600 transition-colors hover:bg-green-50 disabled:opacity-50"
                          >
                            {isBusy && actionId === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                            Done
                          </button>
                          <button
                            onClick={() => setConfirmAction({ id: a.id, status: "review", patientName: a.patient_name })}
                            disabled={isBusy}
                            className="flex items-center gap-1 rounded-lg border px-2 py-1 text-xs text-blue-600 transition-colors hover:bg-blue-50 disabled:opacity-50"
                          >
                            <CalendarDays className="h-3 w-3" /> Review
                          </button>
                          <button
                            onClick={() => openReschedule(a)}
                            disabled={isBusy}
                            className="flex items-center gap-1 rounded-lg border px-2 py-1 text-xs text-purple-600 transition-colors hover:bg-purple-50 disabled:opacity-50"
                          >
                            <RefreshCw className="h-3 w-3" /> Reschedule
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

      {/* Confirmation dialog */}
      <Dialog open={!!confirmAction} onOpenChange={(o) => { if (!o) setConfirmAction(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {confirmAction?.status === "completed" ? "Mark as completed?" : "Set for review?"}
            </DialogTitle>
            <DialogDescription>
              {confirmAction?.status === "completed"
                ? `This will mark ${confirmAction.patientName}'s appointment as completed. This action cannot be undone.`
                : `This will set ${confirmAction?.patientName}'s appointment for review, indicating a follow-up is needed.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmAction(null)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!confirmAction) return
                const { id, status } = confirmAction
                setConfirmAction(null)
                await updateStatus(id, status)
              }}
              className={confirmAction?.status === "completed" ? "bg-green-600 hover:bg-green-700" : ""}
            >
              {confirmAction?.status === "completed" ? (
                <><CheckCircle className="h-4 w-4 mr-1" /> Confirm completion</>
              ) : (
                <><CalendarDays className="h-4 w-4 mr-1" /> Set for review</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reschedule dialog */}
      <Dialog open={!!rescheduleAppt} onOpenChange={(o) => { if (!o) setRescheduleAppt(null) }}>
        <DialogContent className="sm:max-w-xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle>
              {rescheduleStep === "datetime" ? "Choose a new date & time" : "Confirm reschedule"}
            </DialogTitle>
            {rescheduleAppt && (
              <p className="text-sm text-muted-foreground">Patient: {rescheduleAppt.patient_name}</p>
            )}
          </DialogHeader>

          {rescheduleStep === "datetime" && (
            <div className="flex flex-col gap-4 px-6 pb-6 pt-4">
              <DateTimePicker
                slots={slots}
                slotsLoading={slotsLoading}
                date={date}
                slot={slot}
                onDateChange={setDate}
                onSlotChange={setSlot}
                minDate={new Date().toISOString().split("T")[0]}
                availableDays={availableDays}
              />
              <div className="flex justify-end">
                <Button onClick={() => setRescheduleStep("confirm")} disabled={!date || !slot} className="gap-2">
                  Next <CheckCircle className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {rescheduleStep === "confirm" && rescheduleAppt && (
            <div className="flex flex-col gap-5 px-6 pb-6 pt-4">
              <button
                onClick={() => setRescheduleStep("datetime")}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground w-fit"
              >
                ← Back
              </button>

              <div className="text-center">
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">New appointment time</p>
                <div className="rounded-lg border border-primary/20 bg-primary/10 p-4">
                  <p className="text-lg font-semibold">
                    {new Date(date + "T00:00:00").toLocaleDateString(undefined, {
                      weekday: "long", day: "numeric", month: "long", year: "numeric",
                    })}
                  </p>
                  <p className="text-2xl font-bold text-primary">{slot}</p>
                </div>
              </div>

              <p className="text-sm text-muted-foreground text-center">
                Patient: <span className="font-medium text-foreground">{rescheduleAppt.patient_name}</span>
              </p>

              <Button onClick={confirmReschedule} disabled={rescheduleSaving} className="w-full gap-2">
                {rescheduleSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                {rescheduleSaving ? "Rescheduling…" : "Confirm reschedule"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
