"use client"

import * as React from "react"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { MobileAppointmentsList } from "@/components/appointments/mobile-appointments-list"
import { RescheduleDialog } from "@/components/reschedule-dialog"
import { supabaseBrowserClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  PlusCircle,
  Search,
  Calendar,
  Building,
  Clock,
  CheckCircle2,
  CircleDashed,
  XCircle,
  RefreshCw,
  Check,
  AlertTriangle,
  MapPin,
  UserX,
} from "lucide-react"

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
  created_at?: string | null
  booked_at?: string | null
}

const FILTERS = [
  { value: "all", label: "All" },
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
  { value: "completed", label: "Done" },
  { value: "cancelled", label: "Cancelled" },
] as const

export default function ClientAppointmentsPage() {
  const [appointments, setAppointments] = React.useState<Appointment[]>([])
  const [loading, setLoading] = React.useState(true)
  const [filter, setFilter] = React.useState("all")
  const [searchQuery, setSearchQuery] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)

  const [rescheduleAppt, setRescheduleAppt] =
    React.useState<Appointment | null>(null)
  const [actionId, setActionId] = React.useState<string | null>(null)

  const fetchAppointments = React.useCallback(() => {
    setLoading(true)
    void fetch("/api/appointments")
      .then((r) => r.json())
      .then((d) => setAppointments(d.appointments ?? []))
      .finally(() => setLoading(false))
  }, [])

  const cancel = async (id: string) => {
    const confirmCancel = window.confirm(
      "Are you sure you want to cancel this appointment?"
    )
    if (!confirmCancel) return

    setActionId(id)
    setError(null)
    const res = await fetch(`/api/appointments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    })
    setActionId(null)
    if (!res.ok) {
      setError("Failed to cancel appointment")
      return
    }
    fetchAppointments()
  }

  const handleReschedule = (id: string) => {
    const appointment = appointments.find((item) => item.id === id) ?? null
    setRescheduleAppt(appointment)
  }
  const handleCancelAppointment = (id: string) => cancel(id)

  React.useEffect(() => {
    const channel = supabaseBrowserClient
      .channel("client-appointments-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments" },
        async (payload) => {
          await fetchAppointments()

          const appt = payload.new as any
          if (payload.eventType === "UPDATE" && appt) {
            const oldStatus = payload.old?.status
            const newStatus = appt.status

            if (oldStatus === newStatus) return

            const doctorName = appt.profiles?.full_name ?? "the doctor"
            const dateStr = new Date(appt.scheduled_at).toLocaleString(
              undefined,
              {
                dateStyle: "medium",
                timeStyle: "short",
              }
            )

            if (newStatus === "completed") {
              toast.success("Appointment completed", {
                description: `Your appointment with ${doctorName} on ${dateStr} has been marked as completed.`,
              })
            } else if (newStatus === "rescheduled") {
              toast.info("Appointment rescheduled", {
                description: `Your appointment with ${doctorName} has been rescheduled to ${dateStr}.`,
              })
            } else if (newStatus === "review") {
              toast.info("Appointment marked for review", {
                description: `${doctorName} has marked your appointment for follow-up review.`,
              })
            } else if (newStatus === "cancelled" && oldStatus !== "cancelled") {
              toast.warning("Appointment cancelled", {
                description: `Your appointment with ${doctorName} has been cancelled.`,
              })
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabaseBrowserClient.removeChannel(channel)
    }
  }, [fetchAppointments])

  React.useEffect(() => {
    fetchAppointments()
  }, [fetchAppointments])

  const handleRescheduleSuccess = () => {
    setRescheduleAppt(null)
    fetchAppointments()
  }

  const filteredAppointments = React.useMemo(() => {
    return appointments.filter((appointment) => {
      const appointmentDate = new Date(appointment.scheduled_at)
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      let matchesFilter = true
      switch (filter) {
        case "upcoming":
          matchesFilter =
            appointmentDate >= today &&
            appointment.status !== "completed" &&
            appointment.status !== "cancelled"
          break
        case "past":
          matchesFilter = appointmentDate < today
          break
        case "completed":
          matchesFilter = appointment.status === "completed"
          break
        case "cancelled":
          matchesFilter = appointment.status === "cancelled"
          break
        default:
          matchesFilter = true
      }

      const query = searchQuery.toLowerCase()
      const searchMatch =
        !query ||
        appointment.profiles?.full_name?.toLowerCase().includes(query) ||
        appointment.specialties?.name?.toLowerCase().includes(query) ||
        appointment.status.includes(query) ||
        appointment.dependent_name?.toLowerCase().includes(query)

      return matchesFilter && searchMatch
    })
  }, [appointments, filter, searchQuery])

  const groupedAppointments = filteredAppointments.reduce(
    (groups, appointment) => {
      const date = new Date(appointment.scheduled_at)
      date.setHours(0, 0, 0, 0)

      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)

      const sevenDaysAgo = new Date(today)
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      let groupKey = "Older"
      if (date.getTime() === today.getTime()) {
        groupKey = "Today"
      } else if (date > today) {
        groupKey = "Upcoming"
      } else if (date.getTime() === yesterday.getTime()) {
        groupKey = "Yesterday"
      } else if (date > sevenDaysAgo && date < today) {
        groupKey = "Last Week"
      }

      if (!groups[groupKey]) groups[groupKey] = []
      groups[groupKey].push(appointment)
      return groups
    },
    {} as Record<string, Appointment[]>
  )

  const groupedEntries = Object.entries(groupedAppointments).sort((a, b) => {
    const order = ["Today", "Upcoming", "Yesterday", "Last Week", "Older"]
    return order.indexOf(a[0]) - order.indexOf(b[0])
  })

  const statusConfig: Record<
    string,
    { icon: typeof CircleDashed; label: string; className: string }
  > = {
    review: {
      icon: Clock,
      label: "Pending",
      className:
        "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400",
    },
    scheduled: {
      icon: CheckCircle2,
      label: "Confirmed",
      className:
        "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-400",
    },
    rescheduled: {
      icon: RefreshCw,
      label: "Moved",
      className:
        "bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-950/30 dark:border-orange-800 dark:text-orange-400",
    },
    completed: {
      icon: Check,
      label: "Done",
      className:
        "bg-green-50 border-green-200 text-green-700 dark:bg-green-950/30 dark:border-green-800 dark:text-green-400",
    },
    cancelled: {
      icon: XCircle,
      label: "Cancelled",
      className:
        "bg-zinc-100 border-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400",
    },
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Appointments</h1>
          <p className="text-sm text-muted-foreground">
            View, reschedule or cancel your appointments.
          </p>
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

      {/* Mobile Filter & Search */}
      <div className="space-y-3 md:hidden">
        <div className="relative">
          <Search className="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Find appointments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-12 w-full rounded-full border-zinc-200 bg-white pl-11 text-base shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          />
        </div>
        <div className="scrollbar-hide -mx-4 flex gap-2 overflow-x-auto px-4 pb-2 md:overflow-visible">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "rounded-full border px-5 py-2 text-sm font-bold whitespace-nowrap shadow-sm transition-all",
                filter === f.value
                  ? "border-zinc-900 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                  : "border-zinc-200 bg-white text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop Filter & Search */}
      <div className="hidden flex-row items-center justify-between gap-4 md:flex">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                filter === f.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:border-primary/40 hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative w-72">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search doctor or specialty..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Mobile View */}
      <div className="md:hidden">
        <MobileAppointmentsList
          appointments={filteredAppointments.map((a) => ({
            id: a.id,
            date: a.scheduled_at,
            status: a.status,
            doctorName: a.profiles?.full_name || undefined,
            departmentName: a.specialties?.name || undefined,
            notes: a.notes || undefined,
            scheduled_at: a.scheduled_at,
            specialties: a.specialties,
            profiles: a.profiles,
          }))}
          isLoading={loading}
          onCancel={handleCancelAppointment}
          onReschedule={handleReschedule}
        />
      </div>

      {/* Desktop View */}
      <div className="hidden md:block">
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
        ) : error ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center text-red-600">
              <p className="text-sm">Error: {error}</p>
            </div>
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center text-muted-foreground">
              <Calendar className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p className="mb-2 text-lg font-medium">No appointments found</p>
              <p className="text-sm">
                Try adjusting your filters or search query.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="grid grid-cols-[2fr_1.25fr_1fr_1fr_1.25fr] gap-4 border-b border-zinc-100 bg-zinc-50/50 px-6 py-4 text-xs font-semibold tracking-wider text-muted-foreground uppercase dark:border-zinc-800 dark:bg-zinc-900/50">
              <div>Title</div>
              <div>Status</div>
              <div>Date</div>
              <div>Booked On</div>
              <div>Actions</div>
            </div>

            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {groupedEntries.map(([groupName, groupAppointments]) => (
                <div key={groupName}>
                  <div className="bg-zinc-50/30 px-6 py-3 text-[10px] font-bold tracking-widest text-muted-foreground uppercase dark:bg-zinc-900/30">
                    {groupName}
                  </div>
                  <div>
                    {groupAppointments.map((appointment) => (
                      <div
                        key={appointment.id}
                        className="grid grid-cols-[2fr_1.25fr_1fr_1fr_1.25fr] items-center gap-4 px-6 py-4 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-400 dark:bg-zinc-800">
                            <Building className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                              {appointment.profiles?.full_name ?? "Appointment"}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {appointment.specialties?.name ?? "—"} • {""}
                              {new Date(
                                appointment.scheduled_at
                              ).toLocaleTimeString("en-US", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center">
                          {(() => {
                            const config = statusConfig[appointment.status] || {
                              icon: CircleDashed,
                              label: appointment.status,
                              className:
                                "bg-zinc-50 border-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400",
                            }

                            const StatusIcon = config.icon

                            return (
                              <div
                                className={cn(
                                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium shadow-sm transition-colors",
                                  config.className
                                )}
                              >
                                <StatusIcon className="h-3.5 w-3.5" />
                                <span className="capitalize">
                                  {config.label}
                                </span>
                              </div>
                            )
                          })()}
                        </div>

                        <div className="text-sm text-zinc-500">
                          {new Date(
                            appointment.scheduled_at
                          ).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </div>

                        <div className="text-sm text-zinc-500">
                          {appointment.booked_at || appointment.created_at ? (
                            <div className="flex flex-col">
                              <span>
                                {new Date(
                                  appointment.booked_at ??
                                    appointment.created_at!
                                ).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                })}
                              </span>
                              <span className="text-xs text-zinc-400">
                                {new Date(
                                  appointment.booked_at ??
                                    appointment.created_at!
                                ).toLocaleTimeString("en-US", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                          ) : (
                            <span className="text-zinc-400">—</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {["scheduled", "rescheduled", "review"].includes(
                            appointment.status
                          ) && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 text-xs"
                                onClick={() => handleReschedule(appointment.id)}
                                disabled={actionId === appointment.id}
                              >
                                Reschedule
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                                onClick={() =>
                                  handleCancelAppointment(appointment.id)
                                }
                                disabled={actionId === appointment.id}
                              >
                                Cancel
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <RescheduleDialog
        appointment={rescheduleAppt}
        open={!!rescheduleAppt}
        onClose={() => setRescheduleAppt(null)}
        onSuccess={handleRescheduleSuccess}
      />
    </div>
  )
}
