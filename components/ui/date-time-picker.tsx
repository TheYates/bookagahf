"use client"

import * as React from "react"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export interface DateTimePickerProps {
  slots: string[]
  bookedSlots?: string[]
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
  bookedSlots = [],
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
  const selectedDate = date ? new Date(date + "T00:00:00") : undefined

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
      const minCheck = new Date(
        min.getFullYear(),
        min.getMonth(),
        min.getDate()
      )
      if (check < minCheck) return true
    }

    // Explicitly disabled dates
    if (
      disabledDates.some(
        (dd) =>
          dd.getFullYear() === d.getFullYear() &&
          dd.getMonth() === d.getMonth() &&
          dd.getDate() === d.getDate()
      )
    )
      return true

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

      <div className="flex flex-col gap-8 md:flex-row md:gap-0">
        {/* Calendar on left - 60% */}
        <div className="flex w-full justify-center p-6 md:w-[60%] md:p-6">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            disabled={isDateDisabled}
            showOutsideDays={false}
            className="bg-transparent p-0 [--cell-size:--spacing(10)] md:[--cell-size:--spacing(12)]"
          />
        </div>

        {/* Time slots panel on right - 40% */}
        <div className="no-scrollbar flex w-full flex-col gap-3 overflow-y-auto border-t p-6 md:max-h-none md:w-[40%] md:border-t-0 md:border-l md:p-6">
          {/* Section header */}
          <div className="shrink-0">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {date
                ? `Available for ${new Date(date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}`
                : "Select a date"}
            </p>
          </div>
          {slotsLoading ? (
            // Show 6 skeleton items while loading
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : slots.length === 0 && bookedSlots.length === 0 ? (
            // Show message when no slots available
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              No slots available. Try another date.
            </div>
          ) : (
            // Show slot buttons in two columns, sorted chronologically
            <div className="grid grid-cols-2 gap-2">
              {[...slots, ...bookedSlots]
                .sort((a, b) => a.localeCompare(b))
                .map((timeSlot) => {
                  const isBooked = bookedSlots.includes(timeSlot)
                  return (
                    <Button
                      key={timeSlot}
                      variant={slot === timeSlot ? "default" : "outline"}
                      disabled={isBooked}
                      onClick={() => !isBooked && onSlotChange(timeSlot)}
                      className={cn(
                        "w-full",
                        isBooked &&
                          "cursor-not-allowed line-through decoration-slate-400 decoration-wavy opacity-40"
                      )}
                    >
                      {timeSlot}
                    </Button>
                  )
                })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export { DateTimePicker }
