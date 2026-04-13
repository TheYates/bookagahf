"use client"

import * as React from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { CalendarDays, Clock, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { supabaseBrowserClient } from "@/lib/supabase/client"

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
}

const STATUS_STYLES: Record<string, string> = {
  scheduled: "bg-yellow-100 text-yellow-700",
  rescheduled: "bg-purple-100 text-purple-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  review: "bg-blue-100 text-blue-700",
}

const getGreeting = () => {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

export default function ClientDashboardPage() {
  const [appointments, setAppointments] = React.useState<Appointment[]>([])
  const [loading, setLoading] = React.useState(true)
  const [userName, setUserName] = React.useState("")

  React.useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabaseBrowserClient.auth.getUser()
      if (user) {
        // Fetch full name from profiles table (more reliable than user_metadata)
        const { data: profile } = await supabaseBrowserClient
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single()

        const fullName =
          profile?.full_name ?? user.user_metadata?.full_name ?? ""
        const firstName = fullName.split(" ")[0] || "there"
        setUserName(firstName)
      }

      fetch("/api/appointments")
        .then((r) => r.json())
        .then((d) => setAppointments(d.appointments ?? []))
        .finally(() => setLoading(false))
    }
    void init()
  }, [])

  const upcoming = appointments
    .filter((a) => ["scheduled", "rescheduled"].includes(a.status))
    .sort(
      (a, b) =>
        new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
    )

  const past = appointments.filter((a) =>
    ["completed", "cancelled", "review"].includes(a.status)
  )

  const nextAppointment = upcoming[0]

  return (
    <div className="flex flex-col gap-8">
      {/* Hero Section */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {getGreeting()}, {userName}!
          </h1>
          <p className="mt-1 text-muted-foreground">
            Here is a summary of your health journey.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="mt-4 h-48 rounded-2xl md:col-span-2" />
        </div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid gap-4 md:grid-cols-2">
            <Link href="/client/appointments" className="group">
              <motion.div
                whileHover={{ y: -4 }}
                className="relative overflow-hidden rounded-2xl border p-6 shadow-sm transition-shadow group-hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="flex items-center text-sm font-medium text-muted-foreground">
                      <CalendarDays className="mr-2 h-4 w-4 text-primary" />
                      Book an Appointment
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Schedule a new visit with your doctor
                    </p>
                  </div>
                  <div className="rounded-full bg-primary/10 p-4 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <ArrowRight className="h-6 w-6" />
                  </div>
                </div>
              </motion.div>
            </Link>

            <Link href="/client/appointments" className="group">
              <motion.div
                whileHover={{ y: -4 }}
                className="relative overflow-hidden rounded-2xl border p-6 shadow-sm transition-shadow group-hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="flex items-center text-sm font-medium text-muted-foreground">
                      <Clock className="mr-2 h-4 w-4 text-emerald-500" />
                      View All Appointments
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      See your appointment history
                    </p>
                  </div>
                  <div className="rounded-full bg-emerald-500/10 p-4 text-emerald-600 transition-colors group-hover:bg-emerald-500 group-hover:text-white">
                    <ArrowRight className="h-6 w-6" />
                  </div>
                </div>
              </motion.div>
            </Link>
          </div>

          {/* Next Appointment Widget */}
          {nextAppointment ? (
            <div className="mt-2 flex flex-col gap-4">
              <h2 className="flex items-center gap-2 text-xl font-semibold">
                <CalendarDays className="h-5 w-5 text-muted-foreground" /> Your
                Next Appointment
              </h2>
              <div className="group relative overflow-hidden rounded-2xl border bg-card p-6 shadow-sm transition-colors hover:border-primary/50">
                <div className="absolute top-0 right-0 h-full w-2 bg-primary transition-all group-hover:w-3"></div>
                <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
                  <div>
                    <p className="mb-1 text-sm font-medium text-primary">
                      {new Date(
                        nextAppointment.scheduled_at
                      ).toLocaleDateString(undefined, {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                    <p className="mb-2 text-3xl font-bold">
                      {new Date(
                        nextAppointment.scheduled_at
                      ).toLocaleTimeString(undefined, {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                    {nextAppointment.profiles?.full_name && (
                      <p className="font-semibold text-foreground">
                        {nextAppointment.profiles.full_name}
                      </p>
                    )}
                    {nextAppointment.specialties?.name && (
                      <p className="text-sm text-muted-foreground">
                        {nextAppointment.specialties.name}
                      </p>
                    )}
                    {nextAppointment.dependent_name && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        For: {nextAppointment.dependent_name}
                      </p>
                    )}
                  </div>
                  <div className="flex min-w-[140px] flex-col items-start gap-3 border-t pt-4 sm:items-end sm:border-t-0 sm:pt-0">
                    <span
                      className={cn(
                        "inline-flex w-fit items-center justify-center rounded-full px-3 py-1 text-xs font-medium",
                        STATUS_STYLES[nextAppointment.status] ??
                          "bg-muted text-muted-foreground"
                      )}
                    >
                      {nextAppointment.status.charAt(0).toUpperCase() +
                        nextAppointment.status.slice(1)}
                    </span>
                    <Button
                      asChild
                      variant="outline"
                      className="w-full sm:w-auto"
                    >
                      <Link href="/client/appointments">
                        Manage Appointment
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/10 px-4 py-16 transition-all">
              <div className="mb-5 rounded-full bg-muted p-5 shadow-inner">
                <CalendarDays className="h-10 w-10 text-muted-foreground/70" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">
                No upcoming appointments
              </h3>
              <p className="mb-8 max-w-sm text-center text-sm text-muted-foreground">
                You do not have any appointments scheduled right now. Book a new
                one when you're ready to see a doctor.
              </p>
              <Button asChild size="lg" className="rounded-full px-8">
                <Link href="/client/book">Book Now</Link>
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
