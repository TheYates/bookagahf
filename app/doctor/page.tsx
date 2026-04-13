"use client"

import * as React from "react"
import Link from "next/link"
import { User, ArrowRight, Clock } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { supabaseBrowserClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

const TODAY_START = () => {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  return start
}

const TODAY_END = () => {
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  return end
}

const STATUSES = ["scheduled", "rescheduled"] as const

type Status = (typeof STATUSES)[number]

type TodayAppointment = {
  id: string
  patient_name: string
  scheduled_at: string
  status: Status
  specialties?: { name?: string | null } | null
}

const isWithinToday = (date: string) => {
  const parsed = new Date(date)
  return parsed >= TODAY_START() && parsed <= TODAY_END()
}

const isActiveStatus = (status: string): status is Status =>
  STATUSES.includes(status as Status)

const appointmentStatusStyles: Record<Status, string> = {
  scheduled: "bg-yellow-100 text-yellow-700",
  rescheduled: "bg-purple-100 text-purple-700",
}

const appointmentStatusLabels: Record<Status, string> = {
  scheduled: "Scheduled",
  rescheduled: "Rescheduled",
}

const availabilityStyles = (available: boolean) =>
  cn(
    "relative flex h-8 w-14 items-center rounded-full border-2 transition-colors duration-300",
    available
      ? "border-green-500 bg-green-500"
      : "border-muted-foreground bg-muted"
  )

const availabilityThumbStyles = (available: boolean) =>
  cn(
    "absolute h-5 w-5 rounded-full bg-white shadow transition-transform duration-300",
    available ? "translate-x-7" : "translate-x-1"
  )

const availabilityMessageStyles = (available: boolean) =>
  cn(
    "mt-3 flex items-center gap-2 rounded-lg px-4 py-2 text-sm",
    available ? "bg-green-50 text-green-700" : "bg-muted text-muted-foreground"
  )

const availabilityMessage = (available: boolean) =>
  available ? "Accepting new appointments" : "Not accepting new appointments"

const availabilityDetails = (available: boolean) =>
  available
    ? "You are now available for bookings."
    : "You are now unavailable. Clients cannot book you."

const availabilityError = "Failed to update availability."

const availabilityDescription =
  "Toggle this off to stop receiving new bookings. Existing appointments are unaffected."

const availabilityTitle = "Availability"

const appointmentTitle = "Today’s Appointments"

const appointmentEmpty = "No appointments scheduled for today."

const appointmentViewAll = "View all →"

const appointmentViewAllHref = "/doctor/appointments"

const appointmentListDescription = "Patients scheduled for today."

const EMPTY_NAME = "Doctor"

const formatDoctorName = (fullName: string) => {
  const firstWord = fullName.split(" ")[0]
  let nameToShow = firstWord.toLowerCase().startsWith("dr")
    ? fullName.split(" ")[1] || EMPTY_NAME
    : firstWord
  if (!nameToShow.toLowerCase().startsWith("dr")) {
    nameToShow = `Dr. ${nameToShow}`
  }
  return nameToShow
}

const toTodayAppointments = (appointments: any[]) =>
  appointments
    .filter((appt) => isWithinToday(appt.scheduled_at))
    .filter((appt) => isActiveStatus(appt.status))
    .map((appt) => ({
      id: appt.id,
      patient_name: appt.patient_name,
      scheduled_at: appt.scheduled_at,
      status: appt.status,
      specialties: appt.specialties,
    }))

const availabilityUpdatePayload = (userId: string, next: boolean) => ({
  doctor_id: userId,
  is_available: next,
  updated_at: new Date().toISOString(),
})

const availabilityBroadcastPayload = (userId: string, next: boolean) => ({
  type: "broadcast" as const,
  event: "availability_changed",
  payload: { doctor_id: userId, is_available: next },
})

const appointmentSecondary = (appointment: TodayAppointment) =>
  `${new Date(appointment.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}${appointment.specialties?.name ? ` · ${appointment.specialties.name}` : ""}`

const loadingPlaceholderRows = Array.from({ length: 5 })

const availabilitySkeleton = () => (
  <Skeleton className="h-8 w-14 rounded-full" />
)

const loadingAppointmentRow = (key: number) => (
  <div key={key} className="flex items-center justify-between px-5 py-3">
    <div className="flex flex-col gap-1.5">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-3 w-44" />
    </div>
    <Skeleton className="h-5 w-20 rounded-full" />
  </div>
)

const availabilityStatusBadge = (available: boolean) => (
  <div className={availabilityMessageStyles(available)}>
    <Clock className="h-4 w-4" />
    {availabilityMessage(available)}
  </div>
)

const renderAppointmentStatus = (status: Status) => (
  <span
    className={cn(
      "rounded-full px-2 py-0.5 text-xs font-medium",
      appointmentStatusStyles[status]
    )}
  >
    {appointmentStatusLabels[status]}
  </span>
)

const availabilityToggleButton = (
  available: boolean,
  saving: boolean,
  onToggle: () => void
) => (
  <button
    onClick={onToggle}
    disabled={saving}
    className={availabilityStyles(available)}
    aria-label="Toggle availability"
  >
    <span className={availabilityThumbStyles(available)} />
  </button>
)

const availabilityNotice = (message: { text: string; ok: boolean }) => (
  <p
    className={cn(
      "text-sm",
      message.ok ? "text-green-600" : "text-destructive"
    )}
  >
    {message.text}
  </p>
)

const appointmentsHeader = () => (
  <div className="flex items-center justify-between px-4 py-4">
    <div>
      <h2 className="text-lg font-semibold">{appointmentTitle}</h2>
      <p className="text-sm text-muted-foreground">
        {appointmentListDescription}
      </p>
    </div>
    <Link
      href={appointmentViewAllHref}
      className="flex items-center gap-1 text-sm text-primary hover:underline"
    >
      <span>{appointmentViewAll}</span>
      <ArrowRight className="h-4 w-4" />
    </Link>
  </div>
)

const appointmentsLoading = () => (
  <div className="flex flex-col">
    <Separator />
    {loadingPlaceholderRows.map((_, i) => (
      <React.Fragment key={i}>
        <div className="grid items-center gap-4 px-4 py-5 md:grid-cols-4">
          <div className="order-2 flex items-center gap-2 md:order-none">
            <Skeleton className="h-14 w-16 rounded-md" />
            <div className="flex flex-col gap-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
          <Skeleton className="order-1 h-5 w-20 md:order-none md:col-span-2" />
          <Skeleton className="order-3 h-6 w-20 rounded-full md:order-none" />
        </div>
        <Separator />
      </React.Fragment>
    ))}
  </div>
)

const appointmentsEmpty = () => (
  <div className="flex flex-col">
    <Separator />
    <p className="px-4 py-6 text-sm text-muted-foreground">
      {appointmentEmpty}
    </p>
    <Separator />
  </div>
)

const appointmentRows = (loading: boolean, appts: TodayAppointment[]) => {
  if (loading) return appointmentsLoading()
  if (appts.length === 0) return appointmentsEmpty()
  return (
    <div className="flex flex-col">
      <Separator />
      {appts.map((appt) => (
        <React.Fragment key={appt.id}>
          <div className="grid items-center gap-4 px-4 py-5 md:grid-cols-4">
            <div className="order-2 flex items-center gap-3 md:order-none">
              <div className="flex h-14 w-16 shrink-0 items-center justify-center rounded-md bg-muted">
                <User className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="font-semibold">{appt.patient_name}</h3>
                <p className="text-sm text-muted-foreground">
                  {appointmentSecondary(appt)}
                </p>
              </div>
            </div>
            <p className="order-1 text-lg font-medium md:order-none md:col-span-2">
              {appt.specialties?.name || "General"}
            </p>
            <div className="order-3 md:order-none">
              {renderAppointmentStatus(appt.status)}
            </div>
          </div>
          <Separator />
        </React.Fragment>
      ))}
    </div>
  )
}

const headerAvailabilityCard = (
  available: boolean,
  loading: boolean,
  saving: boolean,
  onToggle: () => void,
  message: { text: string; ok: boolean } | null
) => (
  <div className="flex flex-col gap-1">
    <div className="flex items-center gap-3 rounded-full border bg-background px-4 py-2 shadow-sm">
      <span className="text-sm font-medium">{availabilityTitle}</span>
      {loading ? (
        <Skeleton className="h-6 w-10 rounded-full" />
      ) : (
        availabilityToggleButton(available, saving, onToggle)
      )}
    </div>
    {message ? availabilityNotice(message) : null}
  </div>
)

const greetingBlock = (name: string) => (
  <div>
    <h1 className="text-2xl font-bold">
      {getGreeting()}, {name}!
    </h1>
    <p className="text-sm text-muted-foreground">{greetingDescription}</p>
  </div>
)

const dashboardLayout = (
  name: string,
  available: boolean,
  loading: boolean,
  saving: boolean,
  onToggle: () => void,
  message: { text: string; ok: boolean } | null,
  appts: TodayAppointment[]
) => (
  <div className="flex flex-col gap-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      {greetingBlock(name)}
      {headerAvailabilityCard(available, loading, saving, onToggle, message)}
    </div>
    <div className="rounded-xl border bg-background shadow-sm">
      {appointmentsHeader()}
      {appointmentRows(loading, appts)}
    </div>
  </div>
)

const greetingDescription = "Here are your appointments for today."

const getGreeting = () => {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

export default function DoctorDashboardPage() {
  const [appointments, setAppointments] = React.useState<TodayAppointment[]>([])
  const [loading, setLoading] = React.useState(true)
  const [userName, setUserName] = React.useState("")
  const [isAvailable, setIsAvailable] = React.useState(true)
  const [availabilityLoading, setAvailabilityLoading] = React.useState(true)
  const [savingAvailability, setSavingAvailability] = React.useState(false)
  const [availabilityMessage, setAvailabilityMessage] = React.useState<{
    text: string
    ok: boolean
  } | null>(null)
  const [userId, setUserId] = React.useState<string | null>(null)

  const refreshDashboard = React.useCallback(async () => {
    const {
      data: { user },
    } = await supabaseBrowserClient.auth.getUser()
    if (!user) return

    setUserId(user.id)

    const { data: profile } = await supabaseBrowserClient
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single()

    const fullName = profile?.full_name ?? user.user_metadata?.full_name ?? ""
    setUserName(formatDoctorName(fullName))

    const settings = await supabaseBrowserClient
      .from("doctor_settings")
      .select("is_available")
      .eq("doctor_id", user.id)
      .single()

    if (settings.data) {
      setIsAvailable(settings.data.is_available)
    }
    setAvailabilityLoading(false)

    const res = await fetch("/api/appointments")
    const data = await res.json()
    const allAppointments = data.appointments ?? []

    setAppointments(toTodayAppointments(allAppointments))
  }, [])

  const toggleAvailability = React.useCallback(async () => {
    if (!userId) return
    setSavingAvailability(true)
    setAvailabilityMessage(null)
    const next = !isAvailable

    const { error } = await supabaseBrowserClient
      .from("doctor_settings")
      .upsert(availabilityUpdatePayload(userId, next))

    if (!error) {
      await supabaseBrowserClient
        .channel("doctor-availability")
        .send(availabilityBroadcastPayload(userId, next))
    }

    setSavingAvailability(false)
    if (error) {
      setAvailabilityMessage({ text: availabilityError, ok: false })
      return
    }
    setIsAvailable(next)
    setAvailabilityMessage({ text: availabilityDetails(next), ok: next })
  }, [userId, isAvailable])

  React.useEffect(() => {
    refreshDashboard().finally(() => setLoading(false))
  }, [refreshDashboard])

  React.useEffect(() => {
    if (!userId) return
    const channel = supabaseBrowserClient
      .channel(`doctor-availability-${userId}`)
      .on("broadcast", { event: "availability_changed" }, ({ payload }) => {
        if (
          payload?.doctor_id === userId &&
          typeof payload.is_available === "boolean"
        ) {
          setIsAvailable(payload.is_available)
        }
      })
      .subscribe()

    return () => {
      void supabaseBrowserClient.removeChannel(channel)
    }
  }, [userId])

  React.useEffect(() => {
    if (!userId) return
    const channel = supabaseBrowserClient
      .channel("doctor-settings-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "doctor_settings",
          filter: `doctor_id=eq.${userId}`,
        },
        (payload: any) => {
          const next = payload?.new?.is_available
          if (typeof next === "boolean") {
            setIsAvailable(next)
          }
        }
      )
      .subscribe()

    return () => {
      void supabaseBrowserClient.removeChannel(channel)
    }
  }, [userId])

  return dashboardLayout(
    userName,
    isAvailable,
    availabilityLoading,
    savingAvailability,
    toggleAvailability,
    availabilityMessage,
    appointments
  )
}
