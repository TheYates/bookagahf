"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { Plus, Trash2, Loader2, Save, CalendarDays } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { AvailabilityCard, Slot } from "@/components/ui/availability-card"
import { cn } from "@/lib/utils"

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

type AvailabilitySlot = {
  id?: string
  day_of_week: number
  start_time: string
  end_time: string
  is_active: boolean
}

export default function DoctorAvailabilityPage() {
  const [slots, setSlots] = React.useState<AvailabilitySlot[]>([])
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState(false)
  const [selectedSlotId, setSelectedSlotId] = React.useState<string | number | null>(null)
  const [appointmentDuration, setAppointmentDuration] = React.useState(30)

  React.useEffect(() => {
    Promise.all([
      fetch("/api/availability").then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()),
    ]).then(([availabilityData, settingsData]) => {
      setSlots(availabilityData.availability ?? [])
      setAppointmentDuration(settingsData.settings?.appointment_duration ?? 30)
      setLoading(false)
    })
  }, [])

  const addSlot = (day: number) => {
    setSlots((prev) => [
      ...prev,
      { day_of_week: day, start_time: "08:00", end_time: "17:00", is_active: true },
    ])
  }

  const removeSlot = (index: number) => {
    setSlots((prev) => prev.filter((_, i) => i !== index))
  }

  const updateSlot = (index: number, field: keyof AvailabilitySlot, value: any) => {
    setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)))
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    setSuccess(false)

    const res = await fetch("/api/availability/replace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(slots.map(({ id: _id, ...s }) => s)),
    })

    setSaving(false)
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? "Failed to save availability")
      return
    }

    setSuccess(true)
    setTimeout(() => setSuccess(false), 3000)
  }

  const activeSlots = slots.filter((s) => s.is_active)
  
  const availableDates: Slot[] = React.useMemo(() => {
    if (activeSlots.length === 0) return []
    
    const dates: Slot[] = []
    const today = new Date()
    const daysAhead = 30

    for (let i = 1; i <= daysAhead; i++) {
      const date = new Date(today)
      date.setDate(today.getDate() + i)
      const dayOfWeek = date.getDay()
      
      const hasAvailability = activeSlots.some((s) => s.day_of_week === dayOfWeek)
      if (hasAvailability) {
        dates.push({
          id: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
          day: date.getDate(),
          month: MONTHS[date.getMonth()],
        })
      }
    }
    
    return dates.slice(0, 12)
  }, [activeSlots])

  const slotsByDay = DAYS.map((_, day) => ({
    day,
    slots: slots.map((s, i) => ({ ...s, index: i })).filter((s) => s.day_of_week === day),
  }))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Availability Schedule</h1>
          <p className="text-sm text-muted-foreground">
            Set the days and hours you are available for appointments.
          </p>
        </div>
        <Button onClick={save} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>

      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700">
          Availability saved successfully.
        </p>
      )}

      {loading ? (
        <div className="flex flex-col gap-3">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="rounded-xl border bg-background p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-6 w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                Weekly Schedule
              </h2>
              <span className="text-xs text-muted-foreground">
                {appointmentDuration} min per appointment
              </span>
            </div>
            {slotsByDay.map(({ day, slots: daySlots }) => {
              const totalSlots = daySlots.reduce((total, slot) => {
                if (!slot.is_active) return total
                const [startH, startM] = slot.start_time.split(":").map(Number)
                const [endH, endM] = slot.end_time.split(":").map(Number)
                const startMinutes = startH * 60 + startM
                const endMinutes = endH * 60 + endM
                const windowMinutes = endMinutes - startMinutes
                const slotsInWindow = Math.floor(windowMinutes / appointmentDuration)
                return total + slotsInWindow
              }, 0)

              return (
                <motion.div
                  key={day}
                  layout
                  className="rounded-xl border bg-background p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{DAYS[day]}</p>
                      {totalSlots > 0 && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                          {totalSlots} slot{totalSlots !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  <button
                    onClick={() => addSlot(day)}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-primary transition-colors hover:bg-primary/10"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add window
                  </button>
                </div>

                {daySlots.length === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">Not available</p>
                ) : (
                  <div className="mt-3 flex flex-col gap-2">
                    {daySlots.map(({ index, ...slot }) => (
                      <motion.div
                        key={index}
                        layout
                        className="flex flex-wrap items-center gap-2"
                      >
                        <input
                          type="time"
                          value={slot.start_time}
                          onChange={(e) => updateSlot(index, "start_time", e.target.value)}
                          className="rounded-lg border bg-muted/40 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <span className="text-sm text-muted-foreground">to</span>
                        <input
                          type="time"
                          value={slot.end_time}
                          onChange={(e) => updateSlot(index, "end_time", e.target.value)}
                          className="rounded-lg border bg-muted/40 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <button
                          onClick={() => updateSlot(index, "is_active", !slot.is_active)}
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-xs font-medium transition-colors",
                            slot.is_active
                              ? "border-green-300 bg-green-50 text-green-700"
                              : "border-muted text-muted-foreground",
                          )}
                        >
                          {slot.is_active ? "Active" : "Inactive"}
                        </button>
                        <button
                          onClick={() => removeSlot(index)}
                          className="ml-auto text-muted-foreground transition-colors hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
              )
            })}
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Available Dates Preview</h2>
            <div className="flex justify-center">
              <AvailabilityCard
                title="Available for Bookings (Next 30 Days)"
                slots={availableDates}
                selectedSlotId={selectedSlotId}
                onSlotSelect={setSelectedSlotId}
              />
            </div>
            {availableDates.length === 0 && (
              <p className="text-center text-sm text-muted-foreground">
                Set your weekly schedule above to see available dates
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}