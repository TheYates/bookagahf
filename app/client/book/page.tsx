"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  Loader2,
  Search,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import { supabaseBrowserClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// ─── Types ───────────────────────────────────────────────────────────────────

type Specialty = { id: string; name: string; description: string | null }
type Doctor = {
  id: string
  full_name: string
  doctor_specialties: { specialty_id: string }[] | null
  doctor_settings:
    | { is_available: boolean }[]
    | { is_available: boolean }
    | null
}
type BookingFor = "self" | "dependent"

const STEPS = ["Doctor & Specialty", "Date & Time", "Details", "Confirm"]

// ─── Helpers ─────────────────────────────────────────────────────────────────

const slide = {
  hidden: (dir: number) => ({ x: dir * 40, opacity: 0 }),
  visible: {
    x: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 120, damping: 18 },
  },
  exit: (dir: number) => ({
    x: dir * -40,
    opacity: 0,
    transition: { duration: 0.15 },
  }),
}

const isDoctorUnavailable = (doc: Doctor) => {
  const settings = doc.doctor_settings
  if (Array.isArray(settings)) {
    return settings[0]?.is_available === false
  }
  if (settings && "is_available" in settings) {
    return settings.is_available === false
  }
  return false
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function BookAppointmentPage() {
  const [step, setStep] = React.useState(0)
  const [dir, setDir] = React.useState(1)

  // All doctors + specialties
  const [specialties, setSpecialties] = React.useState<Specialty[]>([])
  const [allDoctors, setAllDoctors] = React.useState<Doctor[]>([])
  const [dataLoading, setDataLoading] = React.useState(true)

  // Step 0 selections
  const [doctorSearch, setDoctorSearch] = React.useState("")
  const [selectedSpecialtyId, setSelectedSpecialtyId] = React.useState<
    string | null
  >(null)
  const [doctorId, setDoctorId] = React.useState("")
  const [specialtyId, setSpecialtyId] = React.useState("")

  // Step 1
  const [date, setDate] = React.useState("")
  const [slot, setSlot] = React.useState("")
  const [slots, setSlots] = React.useState<string[]>([])
  const [bookedSlots, setBookedSlots] = React.useState<string[]>([])
  const [slotsLoading, setSlotsLoading] = React.useState(false)
  const [availableDays, setAvailableDays] = React.useState<
    number[] | undefined
  >(undefined)

  // Step 2
  const [bookingFor, setBookingFor] = React.useState<BookingFor>("self")
  const [patientName, setPatientName] = React.useState("")
  const [xNumber, setXNumber] = React.useState("")
  const [companyNumber, setCompanyNumber] = React.useState("")
  const [dependentName, setDependentName] = React.useState("")
  const [dependentXNumber, setDependentXNumber] = React.useState("")
  const [contactPhone, setContactPhone] = React.useState("")
  const [notes, setNotes] = React.useState("")

  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState(false)
  const [profileLoading, setProfileLoading] = React.useState(false)

  const fetchDoctors = React.useCallback(async () => {
    const res = await fetch("/api/doctors")
    const data = await res.json()
    return data.doctors ?? []
  }, [])

  const refreshDoctors = React.useCallback(async () => {
    const doctors = await fetchDoctors()
    setAllDoctors(doctors)
  }, [fetchDoctors])

  // ── Load all doctors + specialties + current user profile on mount
  React.useEffect(() => {
    setProfileLoading(true)
    Promise.all([
      fetch("/api/specialties").then((r) => r.json()),
      fetchDoctors(),
      supabaseBrowserClient.auth
        .getUser()
        .then(({ data: { user } }) =>
          user
            ? supabaseBrowserClient
                .from("profiles")
                .select("full_name, x_number, company_number, phone")
                .eq("id", user.id)
                .single()
            : ({ data: null } as any)
        ),
    ]).then(([s, doctors, profileRes]) => {
      setSpecialties(s.specialties ?? [])
      setAllDoctors(doctors ?? [])
      const profile = (profileRes as any)?.data
      if (profile) {
        setPatientName(profile.full_name ?? "")
        setXNumber(profile.x_number ?? "")
        setCompanyNumber(profile.company_number ?? "")
        setContactPhone(profile.phone ?? "")
      }
      setDataLoading(false)
      setProfileLoading(false)
    })
  }, [fetchDoctors])

  // Manual refresh for doctors
  const [refreshing, setRefreshing] = React.useState(false)
  const handleRefreshDoctors = async () => {
    setRefreshing(true)
    const res = await fetch("/api/doctors")
    const data = await res.json()
    setAllDoctors(data.doctors ?? [])
    setRefreshing(false)
  }

  // ── Derive filtered doctors from search + specialty filter
  const filteredDoctors = React.useMemo(() => {
    let docs = allDoctors
    if (selectedSpecialtyId) {
      docs = docs.filter((d) =>
        d.doctor_specialties?.some(
          (s) => s.specialty_id === selectedSpecialtyId
        )
      )
    }
    if (doctorSearch.trim()) {
      docs = docs.filter((d) =>
        d.full_name.toLowerCase().includes(doctorSearch.toLowerCase())
      )
    }
    return docs
  }, [allDoctors, selectedSpecialtyId, doctorSearch])

  const availableDoctorCount = React.useMemo(
    () => filteredDoctors.filter((doc) => !isDoctorUnavailable(doc)).length,
    [filteredDoctors]
  )

  const doctorAvailabilityLabel =
    availableDoctorCount === 1
      ? "available"
      : `${availableDoctorCount} available`

  const doctorAvailabilitySummary =
    filteredDoctors.length === 0
      ? "No doctors available"
      : `${filteredDoctors.length} doctor${
          filteredDoctors.length !== 1 ? "s" : ""
        } · ${doctorAvailabilityLabel}`

  const doctorAvailabilityHelper =
    availableDoctorCount === 0
      ? "No available doctors for the current filters. Try another specialty or search."
      : "Select an available doctor to continue."

  const showUnavailableDoctorHint =
    filteredDoctors.length > 0 && availableDoctorCount === 0

  React.useEffect(() => {
    const channel = supabaseBrowserClient
      .channel("doctor-availability")
      .on("broadcast", { event: "availability_changed" }, () => {
        void refreshDoctors()
      })
      .subscribe()

    return () => {
      void supabaseBrowserClient.removeChannel(channel)
    }
  }, [refreshDoctors])

  // ── Fetch slots when doctor + date changes
  React.useEffect(() => {
    if (!doctorId || !date) return
    setSlot("")
    setSlots([])
    setBookedSlots([])
    setSlotsLoading(true)
    void fetch(`/api/doctors/${doctorId}/slots?date=${date}`)
      .then((r) => r.json())
      .then((d) => {
        setSlots(d.slots ?? [])
        setBookedSlots(d.bookedSlots ?? [])
      })
      .finally(() => setSlotsLoading(false))
  }, [doctorId, date])

  const selectDoctor = async (doc: Doctor) => {
    setDoctorId(doc.id)
    setDate("")
    setSlot("")
    setAvailableDays(undefined)

    // Auto-set specialty: prefer the filtered specialty, else first linked specialty
    const sid =
      selectedSpecialtyId ?? doc.doctor_specialties?.[0]?.specialty_id ?? ""
    setSpecialtyId(sid)

    // Fetch available days for this doctor
    const res = await fetch(`/api/doctors/${doc.id}/availability`)
    const data = await res.json()
    setAvailableDays(data.availableDays ?? [])

    // Auto-advance to next step
    setDir(1)
    setError(null)
    setStep(1)
  }

  const go = (next: number) => {
    setDir(next > step ? 1 : -1)
    setError(null)
    setStep(next)
  }

  const canNext = () => {
    if (step === 0) return !!doctorId
    if (step === 1) return !!date && !!slot
    if (step === 2)
      return (
        !!patientName &&
        !!contactPhone &&
        (bookingFor === "self" ? !!xNumber : !!dependentName)
      )
    return true
  }

  const selectedDoctor = allDoctors.find((d) => d.id === doctorId)
  const selectedSpecialty = specialties.find((s) => s.id === specialtyId)

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)

    const body = {
      patient_name: patientName,
      x_number: xNumber || null,
      company_number: companyNumber || null,
      dependent_name: bookingFor === "dependent" ? dependentName : null,
      dependent_x_number:
        bookingFor === "dependent" ? dependentXNumber || null : null,
      contact_phone: contactPhone,
      doctor_id: doctorId,
      specialty_id: specialtyId || null,
      scheduled_at: new Date(`${date}T${slot}:00`).toISOString(),
      notes: notes || null,
      created_by: null,
    }

    const res = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error ?? "Failed to book appointment")
      return
    }

    setSuccess(true)
  }

  const reset = () => {
    setSuccess(false)
    setStep(0)
    setDir(1)
    setDoctorId("")
    setSpecialtyId("")
    setSelectedSpecialtyId(null)
    setDoctorSearch("")
    setDate("")
    setSlot("")
    setPatientName("")
    setXNumber("")
    setCompanyNumber("")
    setDependentName("")
    setDependentXNumber("")
    setContactPhone("")
    setNotes("")
    setBookingFor("self")
  }

  // ── Success screen ──────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold">Appointment Booked!</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Your appointment with{" "}
          <span className="font-medium">{selectedDoctor?.full_name}</span>
          {selectedSpecialty && <> ({selectedSpecialty.name})</>} on{" "}
          <span className="font-medium">{date}</span> at{" "}
          <span className="font-medium">{slot}</span> has been confirmed.
        </p>
        <div className="flex gap-3">
          <Button onClick={reset}>Book another</Button>
          <Button
            variant="outline"
            onClick={() => (window.location.href = "/client")}
          >
            My appointments
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Book an Appointment</h1>
        <p className="text-sm text-muted-foreground">
          Follow the steps to schedule your visit.
        </p>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-1">
        {STEPS.map((label, i) => (
          <React.Fragment key={label}>
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                  i < step
                    ? "bg-primary text-primary-foreground"
                    : i === step
                      ? "border-2 border-primary text-primary"
                      : "border-2 border-muted text-muted-foreground"
                )}
              >
                {i < step ? <CheckCircle className="h-4 w-4" /> : i + 1}
              </div>
              <span className="hidden text-xs text-muted-foreground sm:block">
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "mb-4 h-px flex-1 transition-colors",
                  i < step ? "bg-primary" : "bg-muted"
                )}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step content */}
      <div className="overflow-hidden rounded-xl border bg-background p-6 shadow-sm">
        <AnimatePresence mode="wait" custom={dir}>
          {/* ── Step 0: Doctor & Specialty ── */}
          {step === 0 && (
            <motion.div
              key="step0"
              custom={dir}
              variants={slide}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="flex flex-col gap-4"
            >
              <h2 className="font-semibold">Who would you like to see?</h2>

              {/* Search by name */}
              <div className="relative">
                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search doctor by name…"
                  value={doctorSearch}
                  onChange={(e) => {
                    const val = e.target.value
                    setDoctorSearch(val)
                    setDoctorId("")
                    // Clear specialty filter when user starts typing
                    if (val.length === 1) setSelectedSpecialtyId(null)
                  }}
                  className="w-full rounded-lg border bg-muted/40 py-2 pr-4 pl-9 text-sm focus:ring-1 focus:ring-primary focus:outline-none"
                />
                {doctorSearch && (
                  <button
                    onClick={() => setDoctorSearch("")}
                    className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Specialty filter */}
              <div className="-mx-6 overflow-x-auto px-6 md:overflow-visible">
                <div className="flex min-w-max gap-2 pb-2 md:pb-0">
                  <button
                    onClick={() => {
                      setSelectedSpecialtyId(null)
                      setDoctorId("")
                    }}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      !selectedSpecialtyId
                        ? "border-primary bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:border-primary/40"
                    )}
                  >
                    All
                  </button>
                  {specialties.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSelectedSpecialtyId(s.id)
                        setDoctorId("")
                      }}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                        selectedSpecialtyId === s.id
                          ? "border-primary bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:border-primary/40"
                      )}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Doctor list */}
              <div>
                {dataLoading ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[...Array(4)].map((_, i) => (
                      <Skeleton key={i} className="h-14 w-full rounded-lg" />
                    ))}
                  </div>
                ) : filteredDoctors.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No doctors found matching your search.
                  </p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {filteredDoctors.map((doc) => {
                      const docSpecialties = specialties.filter((s) =>
                        doc.doctor_specialties?.some(
                          (ds) => ds.specialty_id === s.id
                        )
                      )
                      const isUnavailable = isDoctorUnavailable(doc)
                      return (
                        <button
                          key={doc.id}
                          onClick={() => !isUnavailable && selectDoctor(doc)}
                          disabled={isUnavailable}
                          className={cn(
                            "flex items-center justify-between rounded-lg border p-3 text-left transition-colors",
                            doctorId === doc.id
                              ? "border-primary bg-primary/5"
                              : isUnavailable
                                ? "cursor-not-allowed bg-muted/30 opacity-50"
                                : "hover:border-primary/40 hover:bg-muted/40"
                          )}
                        >
                          <div>
                            <p
                              className={cn(
                                "text-sm font-medium",
                                doctorId === doc.id && "text-primary"
                              )}
                            >
                              {doc.full_name}
                            </p>
                            {docSpecialties.length > 0 && (
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {docSpecialties.map((s) => s.name).join(", ")}
                              </p>
                            )}
                            {isUnavailable && (
                              <p className="mt-0.5 text-xs font-medium text-red-500">
                                Unavailable
                              </p>
                            )}
                          </div>
                          {doctorId === doc.id && (
                            <CheckCircle className="h-4 w-4 shrink-0 text-primary" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ── Step 1: Date & Time ── */}
          {step === 1 && (
            <motion.div
              key="step1"
              custom={dir}
              variants={slide}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="flex flex-col gap-3"
            >
              <div>
                <h2 className="font-semibold">Choose a date and time</h2>
                <p className="text-sm text-muted-foreground">
                  Booking with{" "}
                  <span className="text-md font-semibold text-primary">
                    {selectedDoctor?.full_name}
                  </span>
                  {selectedSpecialty && <> · {selectedSpecialty.name}</>}
                </p>
              </div>
              <DateTimePicker
                slots={slots}
                bookedSlots={bookedSlots}
                slotsLoading={slotsLoading}
                date={date}
                slot={slot}
                onDateChange={setDate}
                onSlotChange={setSlot}
                minDate={new Date().toISOString().split("T")[0]}
                availableDays={availableDays}
              />
            </motion.div>
          )}

          {/* ── Step 2: Details ── */}
          {step === 2 && (
            <motion.div
              key="step2"
              custom={dir}
              variants={slide}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="flex flex-col gap-4"
            >
              <h2 className="font-semibold">Appointment details</h2>

              <div className="grid grid-cols-2 gap-2">
                {(["self", "dependent"] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setBookingFor(opt)}
                    className={cn(
                      "rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                      bookingFor === opt
                        ? "border-primary bg-primary/5 text-primary"
                        : "text-muted-foreground hover:border-primary/40"
                    )}
                  >
                    {opt === "self" ? "For myself" : "For a dependant"}
                  </button>
                ))}
              </div>

              {/* For myself — show pre-filled read-only card */}
              {bookingFor === "self" && (
                <div className="divide-y rounded-lg border bg-muted/20 text-sm">
                  <ReadOnlyRow label="Full name" value={patientName} />
                  <ReadOnlyRow label="X-number" value={xNumber} />
                  {companyNumber && (
                    <ReadOnlyRow label="Company number" value={companyNumber} />
                  )}
                  <ReadOnlyRow label="Contact phone" value={contactPhone} />
                  {/* <p className="px-4 py-2 text-xs text-muted-foreground">
                    Your details are pre-filled from your profile. To update
                    them, contact reception.
                  </p> */}
                </div>
              )}

              {/* For dependant — editable fields */}
              {bookingFor === "dependent" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Dependant's full name *"
                    value={dependentName}
                    onChange={setDependentName}
                    placeholder="Full name"
                  />
                  <Field
                    label="Dependant's X-number"
                    value={dependentXNumber}
                    onChange={setDependentXNumber}
                    placeholder="X12345/26"
                  />
                  <Field
                    label="Contact phone *"
                    value={contactPhone}
                    onChange={setContactPhone}
                    placeholder="+233..."
                    type="tel"
                    className="sm:col-span-2"
                  />
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Any additional information for the doctor…"
                  className="rounded-lg border bg-muted/40 px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>
            </motion.div>
          )}

          {/* ── Step 3: Confirm ── */}
          {step === 3 && (
            <motion.div
              key="step3"
              custom={dir}
              variants={slide}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="flex flex-col gap-5"
            >
              <h2 className="font-semibold">Confirm your appointment</h2>

              {/* Doctor summary card */}
              <div className="flex items-center gap-4 rounded-lg border bg-muted/30 p-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-lg font-bold text-primary">
                  {selectedDoctor?.full_name?.charAt(0) ?? "D"}
                </div>
                <div>
                  <p className="font-semibold text-foreground">
                    {selectedDoctor?.full_name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedSpecialty?.name ?? "General Practice"}
                  </p>
                </div>
              </div>

              {/* Date/time highlight */}
              <div className="text-center">
                <p className="mb-2 text-xs tracking-wide text-muted-foreground uppercase">
                  Your Appointment
                </p>
                <div className="rounded-lg border border-primary/20 bg-primary/10 p-4">
                  <p className="text-lg font-semibold text-foreground">
                    {date
                      ? new Date(date + "T00:00:00").toLocaleDateString(
                          undefined,
                          {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          }
                        )
                      : "—"}
                  </p>
                  <p className="text-2xl font-bold text-primary">{slot}</p>
                </div>
              </div>

              {/* Details list */}
              <div className="divide-y rounded-lg border text-sm">
                <Row
                  label="Patient"
                  value={
                    bookingFor === "dependent" ? dependentName : patientName
                  }
                />
                {bookingFor === "dependent" && (
                  <Row label="Booked by" value={patientName} />
                )}
                <Row
                  label="X-number"
                  value={
                    bookingFor === "dependent"
                      ? dependentXNumber || xNumber
                      : xNumber
                  }
                />
                {companyNumber && (
                  <Row label="Company number" value={companyNumber} />
                )}
                <Row label="Contact phone" value={contactPhone} />
                {notes && <Row label="Notes" value={notes} />}
              </div>

              {error && <p className="text-xs text-destructive">{error}</p>}

              {/* Confirm button with shine effect */}
              <motion.button
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSubmit}
                disabled={loading}
                className="group relative w-full cursor-pointer overflow-hidden rounded-lg border bg-primary py-3 font-semibold text-primary-foreground transition-all duration-300 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Booking…
                    </>
                  ) : (
                    <>
                      CONFIRM APPOINTMENT
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </>
                  )}
                </span>
                {/* Gradient shine effect */}
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full" />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => go(step - 1)}
          disabled={step === 0}
          className="gap-2"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>
        {step < STEPS.length - 1 && (
          <Button
            onClick={() => go(step + 1)}
            disabled={!canNext()}
            className="gap-2"
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  className,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label className="text-sm font-medium">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-lg border bg-muted/40 px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:outline-none"
      />
    </div>
  )
}

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex justify-between px-4 py-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

function ReadOnlyRow({
  label,
  value,
}: {
  label: string
  value?: string | null
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn("font-medium", !value && "text-muted-foreground italic")}
      >
        {value || "Not on file"}
      </span>
    </div>
  )
}
