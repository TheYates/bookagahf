"use client"

import * as React from "react"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export interface DateTimePickerProps {
  slots: string[]
  slotsLoading: boolean
  date: string
  slot: string
  onDateChange: (date: string) => void
  onSlotChange: (slot: string) => void
  minDate?: string
  disabledDates?: Date[]
  /** Days of week the doctor works: 0=Sun, 1=Mon ... 6=Sat. If undefined, all days enabled. */
  availableDays?: number[]
}

function DateTimePicker({
  slots,
  slotsLoading,
  date,
  slot,
  onDateChange,
  onSlotChange,
  minDate,
  disabledDates = [],
  availableDays,
}: DateTimePickerProps) {
  // Parse the date string (YYYY-MM-DD) to Date object using local time
  const selectedDate = date
    ? new Date(date + "T00:00:00")
    : undefined

  // Handle date selection from calendar
  const handleDateSelect = (selectedDay: Date | undefined) => {
    if (selectedDay) {
      const year = selectedDay.getFullYear()
      const month = String(selectedDay.getMonth() + 1).padStart(2, "0")
      const day = String(selectedDay.getDate()).padStart(2, "0")
      onDateChange(`${year}-${month}-${day}`)
    }
  }

  // Disable a date if:
  // 1. It's before minDate
  // 2. It's in disabledDates
  // 3. The doctor doesn't work on that day of week
  const isDateDisabled = (d: Date) => {
    // Past dates
    if (minDate) {
      const min = new Date(minDate + "T00:00:00")
      const check = new Date(d.getFullYear(), d.getMonth(), d.getDate())
      const minCheck = new Date(min.getFullYear(), min.getMonth(), min.getDate())
      if (check < minCheck) return true
    }

    // Explicitly disabled dates
    if (disabledDates.some(
      (dd) =>
        dd.getFullYear() === d.getFullYear() &&
        dd.getMonth() === d.getMonth() &&
        dd.getDate() === d.getDate(),
    )) return true

    // Doctor not available on this day of week
    if (availableDays !== undefined && !availableDays.includes(d.getDay())) {
      return true
    }

    return false
  }

  return (
    <>
      <style>{`
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      <div className="relative p-0 md:pr-48">
        {/* Calendar on left */}
        <div className="p-6">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            disabled={isDateDisabled}
            showOutsideDays={false}
            className="bg-transparent p-0 [--cell-size:--spacing(10)] md:[--cell-size:--spacing(12)]"
          />
        </div>

        {/* Time slots panel on right (absolute on md+) */}
        <div className="no-scrollbar inset-y-0 right-0 flex max-h-72 w-full scroll-pb-6 flex-col gap-3 overflow-y-auto border-t p-6 md:absolute md:max-h-none md:w-48 md:border-t-0 md:border-l">
          {/* Section header */}
          <div className="shrink-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {date
                ? `Available for ${new Date(date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}`
                : "Select a date"}
            </p>
          </div>
          {slotsLoading ? (
            // Show 6 skeleton items while loading
            <>
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </>
          ) : slots.length === 0 ? (
            // Show message when no slots available
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              No slots available. Try another date.
            </div>
          ) : (
            // Show slot buttons
            slots.map((timeSlot) => (
              <Button
                key={timeSlot}
                variant={slot === timeSlot ? "default" : "outline"}
                onClick={() => onSlotChange(timeSlot)}
                className="w-full"
              >
                {timeSlot}
              </Button>
            ))
          )}
        </div>
      </div>
    </>
  )
}

export { DateTimePicker }
