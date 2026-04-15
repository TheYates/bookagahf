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
  User,
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
  created_at?: string | null
}

const STATUS_STYLES: Record<string, string> = {
  scheduled: "bg-yellow-100 text-yellow-700",
  rescheduled: "bg-purple-100 text-purple-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  review: "bg-blue-100 text-blue-700",
}

const FILTERS = [
  "all",
  "scheduled",
  "rescheduled",
  "completed",
  "review",
  "cancelled",
] as const
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
  const [rescheduleAppt, setRescheduleAppt] =
    React.useState<Appointment | null>(null)
  const [date, setDate] = React.useState("")
  const [slot, setSlot] = React.useState("")
  const [slots, setSlots] = React.useState<string[]>([])
  const [slotsLoading, setSlotsLoading] = React.useState(false)
  const [availableDays, setAvailableDays] = React.useState<
    number[] | undefined
  >(undefined)
  const [rescheduleStep, setRescheduleStep] = React.useState<
    "datetime" | "confirm"
  >("datetime")
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
      const {
        data: { user },
      } = await supabaseBrowserClient.auth.getUser()
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
        }
      )
      .subscribe((status) => {
        setIsRealtime(status === "SUBSCRIBED")
      })

    return () => {
      void supabaseBrowserClient.removeChannel(channel)
    }
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

  const updateStatus = async (
    id: string,
    status: string,
    extra?: Record<string, string>
  ) => {
    setActionId(id)
    setError(null)
    const res = await fetch(`/api/appointments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, ...extra }),
    })
    setActionId(null)
    if (!res.ok) {
      setError("Failed to update appointment")
      return
    }
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
    if (!res.ok) {
      setError("Failed to reschedule")
      return
    }
    setRescheduleAppt(null)
    toast.success("Appointment rescheduled")
  }

  const counts = React.useMemo(() => {
    const c: Record<string, number> = {}
    appointments.forEach((a) => {
      c[a.status] = (c[a.status] ?? 0) + 1
    })
    return c
  }, [appointments])

  const filtered = appointments.filter((a) => {
    const matchFilter = filter === "all" || a.status === filter
    const q = search.toLowerCase()
    const matchSearch =
      !q ||
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
          <p className="text-sm text-muted-foreground">
            Manage your patient appointments.
          </p>
        </div>
        {/* Realtime indicator */}
        <div
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
            isRealtime
              ? "border-green-300 bg-green-50 text-green-700"
              : "border-muted text-muted-foreground"
          )}
        >
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
                : "text-muted-foreground hover:border-primary/40 hover:text-foreground"
            )}
          >
            {f}
            {f !== "all" && counts[f] ? ` (${counts[f]})` : ""}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          placeholder="Search patient, X-number, phone, specialty…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border bg-background py-2 pr-4 pl-9 text-sm focus:ring-1 focus:ring-primary focus:outline-none"
        />
      </div>

      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Table */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-lg border p-4"
            >
              <Skeleton className="h-10 w-10" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center text-muted-foreground">
            <CalendarDays className="mx-auto mb-4 h-12 w-12 opacity-50" />
            <p className="mb-2 text-lg font-medium">No appointments found</p>
            <p className="text-sm">
              Try adjusting your filters or search query.
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          {/* Header Row */}
          <div className="grid grid-cols-[2fr_1.25fr_1fr_1fr_1.25fr] gap-4 border-b border-zinc-100 bg-zinc-50/50 px-6 py-4 text-xs font-semibold tracking-wider text-muted-foreground uppercase dark:border-zinc-800 dark:bg-zinc-900/50">
            <div>Patient</div>
            <div>Status</div>
            <div>Date</div>
            <div>Booked On</div>
            <div>Actions</div>
          </div>

          {/* Appointment Rows */}
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {filtered.map((a) => {
              const isActive = ["scheduled", "rescheduled"].includes(a.status)
              const isBusy = actionId === a.id
              const displayId =
                a.company_number || a.x_number || a.contact_phone || "—"

              return (
                <div
                  key={a.id}
                  className="grid grid-cols-[2fr_1.25fr_1fr_1fr_1.25fr] items-center gap-4 px-6 py-4 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                >
                  {/* Patient Column */}
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-400 dark:bg-zinc-800">
                      <User className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {displayId}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {a.patient_name}
                        {a.dependent_name && ` (For: ${a.dependent_name})`}
                        {a.specialties?.name && ` · ${a.specialties.name}`}
                      </p>
                    </div>
                  </div>

                  {/* Status Column */}
                  <div className="flex items-center">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                        STATUS_STYLES[a.status] ?? "bg-muted"
                      )}
                    >
                      {a.status}
                    </span>
                    {a.notes && (
                      <p className="mt-0.5 ml-2 line-clamp-1 max-w-[150px] text-xs text-muted-foreground italic">
                        "{a.notes}"
                      </p>
                    )}
                  </div>

                  {/* Date Column */}
                  <div className="text-sm text-zinc-500">
                    {new Date(a.scheduled_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                    <p className="text-xs text-zinc-400">
                      {new Date(a.scheduled_at).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>

                  {/* Booked On Column */}
                  <div className="text-sm text-zinc-500">
                    {a.created_at ? (
                      <div className="flex flex-col">
                        <span>
                          {new Date(a.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                        <span className="text-xs text-zinc-400">
                          {new Date(a.created_at).toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </div>

                  {/* Actions Column */}
                  <div className="flex items-center gap-2">
                    {isActive ? (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-xs"
                          onClick={() =>
                            setConfirmAction({
                              id: a.id,
                              status: "completed",
                              patientName: a.patient_name,
                            })
                          }
                          disabled={isBusy}
                        >
                          {isBusy && actionId === a.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <CheckCircle className="h-3 w-3" />
                          )}
                          Done
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-xs"
                          onClick={() =>
                            setConfirmAction({
                              id: a.id,
                              status: "review",
                              patientName: a.patient_name,
                            })
                          }
                          disabled={isBusy}
                        >
                          <CalendarDays className="h-3 w-3" /> Review
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-xs text-purple-600 hover:bg-purple-50 hover:text-purple-700"
                          onClick={() => openReschedule(a)}
                          disabled={isBusy}
                        >
                          <RefreshCw className="h-3 w-3" /> Reschedule
                        </Button>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Confirmation dialog */}
      <Dialog
        open={!!confirmAction}
        onOpenChange={(o) => {
          if (!o) setConfirmAction(null)
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {confirmAction?.status === "completed"
                ? "Mark as completed?"
                : "Set for review?"}
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
              className={
                confirmAction?.status === "completed"
                  ? "bg-green-600 hover:bg-green-700"
                  : ""
              }
            >
              {confirmAction?.status === "completed" ? (
                <>
                  <CheckCircle className="mr-1 h-4 w-4" /> Confirm completion
                </>
              ) : (
                <>
                  <CalendarDays className="mr-1 h-4 w-4" /> Set for review
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reschedule dialog */}
      <Dialog
        open={!!rescheduleAppt}
        onOpenChange={(o) => {
          if (!o) setRescheduleAppt(null)
        }}
      >
        <DialogContent className="overflow-hidden p-0 sm:max-w-xl">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle>
              {rescheduleStep === "datetime"
                ? "Choose a new date & time"
                : "Confirm reschedule"}
            </DialogTitle>
            {rescheduleAppt && (
              <p className="text-sm text-muted-foreground">
                Patient: {rescheduleAppt.patient_name}
              </p>
            )}
          </DialogHeader>

          {rescheduleStep === "datetime" && (
            <div className="flex flex-col gap-4 px-6 pt-4 pb-6">
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
                <Button
                  onClick={() => setRescheduleStep("confirm")}
                  disabled={!date || !slot}
                  className="gap-2"
                >
                  Next <CheckCircle className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {rescheduleStep === "confirm" && rescheduleAppt && (
            <div className="flex flex-col gap-5 px-6 pt-4 pb-6">
              <button
                onClick={() => setRescheduleStep("datetime")}
                className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                ← Back
              </button>

              <div className="text-center">
                <p className="mb-2 text-xs tracking-wide text-muted-foreground uppercase">
                  New appointment time
                </p>
                <div className="rounded-lg border border-primary/20 bg-primary/10 p-4">
                  <p className="text-lg font-semibold">
                    {new Date(date + "T00:00:00").toLocaleDateString(
                      undefined,
                      {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      }
                    )}
                  </p>
                  <p className="text-2xl font-bold text-primary">{slot}</p>
                </div>
              </div>

              <p className="text-center text-sm text-muted-foreground">
                Patient:{" "}
                <span className="font-medium text-foreground">
                  {rescheduleAppt.patient_name}
                </span>
              </p>

              <Button
                onClick={confirmReschedule}
                disabled={rescheduleSaving}
                className="w-full gap-2"
              >
                {rescheduleSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                {rescheduleSaving ? "Rescheduling…" : "Confirm reschedule"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
