"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { Loader2, Save, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

import { Switch } from "@/components/ui/switch"

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

type DayAvailability = {
  day_of_week: number
  is_selected: boolean
  start_time: string
  end_time: string
}

export default function DoctorAvailabilityPage() {
  const [dayAvailability, setDayAvailability] = React.useState<DayAvailability[]>(
    DAYS.map((_, i) => ({
      day_of_week: i,
      is_selected: false,
      start_time: "09:00",
      end_time: "17:00",
    }))
  )
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    Promise.all([
      fetch("/api/availability").then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()),
    ]).then(([availabilityData]) => {
      const existing = availabilityData.availability ?? []
      const newAvailability = DAYS.map((_, i) => {
        const daySlots = existing.filter((s: any) => s.day_of_week === i && s.is_active)
        if (daySlots.length > 0) {
          const first = daySlots[0]
          const last = daySlots[daySlots.length - 1]
          return {
            day_of_week: i,
            is_selected: true,
            start_time: first.start_time,
            end_time: last.end_time,
          }
        }
        return {
          day_of_week: i,
          is_selected: false,
          start_time: "09:00",
          end_time: "17:00",
        }
      })
      setDayAvailability(newAvailability)
      setLoading(false)
    })
  }, [])

  const toggleDay = (day: number) => {
    setDayAvailability((prev) =>
      prev.map((d) =>
        d.day_of_week === day ? { ...d, is_selected: !d.is_selected } : d
      )
    )
  }

  const updateTime = (day: number, field: "start_time" | "end_time", value: string) => {
    setDayAvailability((prev) =>
      prev.map((d) =>
        d.day_of_week === day ? { ...d, [field]: value } : d
      )
    )
  }

  const save = async () => {
    setSaving(true)
    
    const slots = dayAvailability
      .filter((d) => d.is_selected)
      .map(({ day_of_week, start_time, end_time }) => ({
        day_of_week,
        start_time,
        end_time,
        is_active: true,
      }))

    const res = await fetch("/api/availability/replace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(slots),
    })

    setSaving(false)
    
    if (res.ok) {
      toast.success("Schedule saved", {
        description: "Your weekly availability has been updated successfully.",
      })
    } else {
      const data = await res.json()
      toast.error("Failed to save", {
        description: data.error || "Something went wrong.",
      })
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Weekly Schedule</h1>
          <p className="text-sm text-muted-foreground">Set your regular hours for appointments.</p>
        </div>
        <Button onClick={save} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border bg-background shadow-sm text-card-foreground">
        {loading ? (
          <div className="flex flex-col">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 border-b p-5">
                <Skeleton className="h-6 w-10 rounded-full" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-9 w-[180px] ml-auto hidden sm:block" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col divide-y">
            {dayAvailability.map((day, i) => {
              const isSelected = day.is_selected;
              return (
                <div 
                  key={i} 
                  className={cn(
                    "flex flex-col sm:flex-row sm:items-center gap-4 px-4 py-3 hover:bg-muted/20 transition-colors",
                    !isSelected && "opacity-80"
                  )}
                >
                  <div className="flex items-center gap-4 w-40 min-w-[160px]">
                    <Switch 
                      checked={isSelected}
                      onCheckedChange={() => toggleDay(i)}
                    />
                    <span className={cn(
                      "font-medium",
                      isSelected ? "text-foreground" : "text-muted-foreground"
                    )}>
                      {DAYS[i]}
                    </span>
                  </div>

                  <div className="flex-1">
                    {isSelected ? (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-1 shadow-sm transition-all focus-within:ring-2 focus-within:ring-primary h-10 w-full sm:w-auto">
                           <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                           <input
                             type="time"
                             value={day.start_time}
                             onChange={(e) => updateTime(i, "start_time", e.target.value)}
                             className="bg-transparent text-sm focus:outline-none w-full"
                           />
                        </div>
                        <span className="text-muted-foreground font-medium px-1">-</span>
                        <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-1 shadow-sm transition-all focus-within:ring-2 focus-within:ring-primary h-10 w-full sm:w-auto">
                           <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                           <input
                             type="time"
                             value={day.end_time}
                             onChange={(e) => updateTime(i, "end_time", e.target.value)}
                             className="bg-transparent text-sm focus:outline-none w-full"
                           />
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground italic h-10 flex items-center">
                        Not available
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  )
}