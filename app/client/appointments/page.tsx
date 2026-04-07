"use client"

import * as React from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import {
  CalendarDays,
  Clock,
  RefreshCw,
  XCircle,
  CheckCircle,
  PlusCircle,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
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
}

const STATUS_STYLES: Record<string, string> = {
  scheduled: "bg-yellow-100 text-yellow-700",
  rescheduled: "bg-purple-100 text-purple-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  review: "bg-blue-100 text-blue-700",
}

export default function ClientAppointmentsPage() {
  const [appointments, setAppointments] = React.useState<Appointment[]>([])
  const [loading, setLoading] = React.useState(true)
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

  React.useEffect(() => {
    fetchAppointments()
  }, [fetchAppointments])

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

  const reschedule = async (id: string) => {
    if (!newDate || !newTime) { setError("Please select a new date and time."); return }
    setActionId(id)
    setError(null)
    const scheduledAt = new Date(`${newDate}T${newTime}:00`).toISOString()
    const res = await fetch(`/api/appointments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "rescheduled", scheduled_at: scheduledAt }),
    })
    setActionId(null)
    if (!res.ok) { setError("Failed to reschedule appointment"); return }
    setRescheduleId(null)
    setNewDate("")
    setNewTime("")
    fetchAppointments()
  }

  const upcoming = appointments.filter((a) =>
    ["scheduled", "rescheduled"].includes(a.status),
  )
  const past = appointments.filter((a) =>
    ["completed", "cancelled", "review"].includes(a.status),
  )

  return (
    <div className="flex flex-col gap-6">
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

      {loading ? (
        <div className="flex flex-col gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-xl border bg-background p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-2 flex-1">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <Section title="Upcoming" icon={CalendarDays}>
            {upcoming.length === 0 ? (
              <EmptyState message="No upcoming appointments." href="/client/book" />
            ) : (
              upcoming.map((appt) => (
                <AppointmentCard
                  key={appt.id}
                  appt={appt}
                  actionId={actionId}
                  rescheduleId={rescheduleId}
                  newDate={newDate}
                  newTime={newTime}
                  onCancel={() => cancel(appt.id)}
                  onRescheduleOpen={() => { setRescheduleId(appt.id); setError(null) }}
                  onRescheduleClose={() => { setRescheduleId(null); setNewDate(""); setNewTime("") }}
                  onRescheduleSubmit={() => reschedule(appt.id)}
                  onNewDateChange={setNewDate}
                  onNewTimeChange={setNewTime}
                />
              ))
            )}
          </Section>

          {past.length > 0 && (
            <Section title="Past" icon={Clock}>
              {past.map((appt) => (
                <AppointmentCard key={appt.id} appt={appt} actionId={null} rescheduleId={null} newDate="" newTime="" />
              ))}
            </Section>
          )}
        </>
      )}
    </div>
  )
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function EmptyState({ message, href }: { message: string; href: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border bg-background py-10 text-center">
      <CalendarDays className="h-8 w-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button asChild size="sm" variant="outline">
        <Link href={href}>Book an appointment</Link>
      </Button>
    </div>
  )
}

function AppointmentCard({
  appt,
  actionId,
  rescheduleId,
  newDate,
  newTime,
  onCancel,
  onRescheduleOpen,
  onRescheduleClose,
  onRescheduleSubmit,
  onNewDateChange,
  onNewTimeChange,
}: {
  appt: Appointment
  actionId: string | null
  rescheduleId: string | null
  newDate: string
  newTime: string
  onCancel?: () => void
  onRescheduleOpen?: () => void
  onRescheduleClose?: () => void
  onRescheduleSubmit?: () => void
  onNewDateChange?: (v: string) => void
  onNewTimeChange?: (v: string) => void
}) {
  const isActive = ["scheduled", "rescheduled"].includes(appt.status)
  const isRescheduling = rescheduleId === appt.id
  const isBusy = actionId === appt.id

  return (
    <motion.div
      layout
      className="rounded-xl border bg-background p-4 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="font-medium">{appt.patient_name}</p>
          {appt.dependent_name && (
            <p className="text-xs text-muted-foreground">For: {appt.dependent_name}</p>
          )}
          <p className="text-sm text-muted-foreground">
            {new Date(appt.scheduled_at).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
          {appt.notes && <p className="mt-1 text-xs text-muted-foreground italic">{appt.notes}</p>}
        </div>
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_STYLES[appt.status] ?? "bg-muted text-muted-foreground")}>
          {appt.status}
        </span>
      </div>

      {isRescheduling && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="mt-4 flex flex-wrap gap-2"
        >
          <input
            type="date"
            value={newDate}
            onChange={(e) => onNewDateChange?.(e.target.value)}
            min={new Date().toISOString().split("T")[0]}
            className="rounded-lg border bg-muted/40 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <input
            type="time"
            value={newTime}
            onChange={(e) => onNewTimeChange?.(e.target.value)}
            className="rounded-lg border bg-muted/40 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <Button size="sm" onClick={onRescheduleSubmit} disabled={isBusy} className="gap-1">
            {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
            Confirm
          </Button>
          <Button size="sm" variant="outline" onClick={onRescheduleClose}>Cancel</Button>
        </motion.div>
      )}

      {isActive && !isRescheduling && (
        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1 text-xs"
            onClick={onRescheduleOpen}
            disabled={isBusy}
          >
            <RefreshCw className="h-3 w-3" /> Reschedule
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1 text-xs text-destructive hover:bg-destructive/10"
            onClick={onCancel}
            disabled={isBusy}
          >
            {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
            Cancel
          </Button>
        </div>
      )}
    </motion.div>
  )
}
