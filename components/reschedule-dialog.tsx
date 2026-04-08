"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { Loader2, ChevronLeft, CheckCircle } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type RescheduleAppointment = {
  id: string
  profiles: { full_name: string } | null
  specialties: { name: string } | null
  doctor_id: string
  scheduled_at: string
}

interface RescheduleDialogProps {
  appointment: RescheduleAppointment | null
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function RescheduleDialog({
  appointment,
  open,
  onClose,
  onSuccess,
}: RescheduleDialogProps) {
  const [step, setStep] = React.useState<"datetime" | "confirm">("datetime")
  const [date, setDate] = React.useState("")
  const [slot, setSlot] = React.useState("")
  const [slots, setSlots] = React.useState<string[]>([])
  const [slotsLoading, setSlotsLoading] = React.useState(false)
  const [availableDays, setAvailableDays] = React.useState<number[] | undefined>(undefined)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Fetch available days when dialog opens
  React.useEffect(() => {
    if (!open || !appointment) return
    setStep("datetime")
    setDate("")
    setSlot("")
    setAvailableDays(undefined)
    setError(null)

    void fetch(`/api/doctors/${appointment.doctor_id}/availability`)
      .then((r) => r.json())
      .then((d) => setAvailableDays(d.availableDays ?? []))
  }, [open, appointment])

  // Fetch slots when date changes
  React.useEffect(() => {
    if (!date || !appointment) return
    setSlot("")
    setSlots([])
    setSlotsLoading(true)
    void fetch(`/api/doctors/${appointment.doctor_id}/slots?date=${date}`)
      .then((r) => r.json())
      .then((d) => setSlots(d.slots ?? []))
      .finally(() => setSlotsLoading(false))
  }, [date, appointment])

  const handleConfirm = async () => {
    if (!appointment) return
    setSaving(true)
    setError(null)

    const res = await fetch(`/api/appointments/${appointment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "rescheduled",
        scheduled_at: new Date(`${date}T${slot}:00`).toISOString(),
      }),
    })

    setSaving(false)
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? "Failed to reschedule")
      return
    }

    onSuccess()
    onClose()
  }

  if (!appointment) return null

  const doctorName = appointment.profiles?.full_name ?? "Doctor"
  const specialtyName = appointment.specialties?.name

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-xl p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle>
            {step === "datetime" ? "Choose a new date & time" : "Confirm reschedule"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {doctorName}{specialtyName ? ` · ${specialtyName}` : ""}
          </p>
        </DialogHeader>

        {step === "datetime" && (
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
              <Button
                onClick={() => setStep("confirm")}
                disabled={!date || !slot}
                className="gap-2"
              >
                Next <CheckCircle className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === "confirm" && (
          <div className="flex flex-col gap-5 px-6 pb-6 pt-4">
            {/* Back button */}
            <button
              onClick={() => setStep("datetime")}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
            >
              <ChevronLeft className="h-4 w-4" /> Back
            </button>

            {/* Doctor summary */}
            <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold">
                {doctorName.charAt(0)}
              </div>
              <div>
                <p className="font-semibold">{doctorName}</p>
                {specialtyName && <p className="text-sm text-muted-foreground">{specialtyName}</p>}
              </div>
            </div>

            {/* New date/time highlight */}
            <div className="text-center">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">New appointment time</p>
              <div className="rounded-lg border border-primary/20 bg-primary/10 p-4">
                <p className="text-lg font-semibold text-foreground">
                  {new Date(date + "T00:00:00").toLocaleDateString(undefined, {
                    weekday: "long", day: "numeric", month: "long", year: "numeric",
                  })}
                </p>
                <p className="text-2xl font-bold text-primary">{slot}</p>
              </div>
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            {/* Confirm button with shine */}
            <motion.button
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleConfirm}
              disabled={saving}
              className="relative w-full overflow-hidden rounded-lg border bg-primary py-3 font-semibold text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed group cursor-pointer"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {saving ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Rescheduling…</>
                ) : (
                  <>
                    CONFIRM RESCHEDULE
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </>
                )}
              </span>
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full" />
            </motion.button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
