"use client"

import * as React from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

interface Appointment {
  id: string
  clientId: string
  clientName: string
  clientXNumber: string | null
  departmentId: string
  departmentName: string
  date: string
  time: string
  status: string
  statusColor: string
  notes?: string | null
}

interface DayAppointmentsPopoverProps {
  appointments: Appointment[]
  date: Date
  getDepartmentColor: (departmentId: number) => string
  maskXNumber: (xNumber: string, isOwnAppointment: boolean) => string
  currentUserId?: number
  userRole: string
  onAppointmentClick: (appointment: Appointment) => void
  onDragStart: (e: React.DragEvent, appointment: Appointment) => void
  isPast?: boolean
  children: React.ReactNode
}

export function DayAppointmentsPopover({
  appointments,
  date,
  getDepartmentColor,
  maskXNumber,
  currentUserId,
  userRole,
  onAppointmentClick,
  onDragStart,
  isPast,
  children,
}: DayAppointmentsPopoverProps) {
  const [open, setOpen] = React.useState(false)

  const dateStr = date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  })

  return (
    <Popover open={open} onOpenChange={isPast ? undefined : setOpen}>
      <PopoverTrigger 
        asChild 
        onClick={(e) => e.stopPropagation()}
        className={isPast ? "cursor-not-allowed" : ""}
      >
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start" side="top">
        <div className="border-b px-3 py-2">
          <p className="font-medium text-sm">{dateStr}</p>
          <p className="text-xs text-muted-foreground">
            {appointments.length} appointment{appointments.length !== 1 ? "s" : ""}
          </p>
        </div>
        <ScrollArea className="h-64">
          <div className="p-2 space-y-2">
            {appointments.map((apt) => (
              <div
                key={apt.id}
                className={cn(
                  "p-2 rounded-lg border transition-colors",
                  isPast 
                    ? "opacity-50 cursor-not-allowed"
                    : "cursor-pointer hover:bg-muted/50"
                )}
                style={{
                  borderLeftColor: getDepartmentColor(apt.departmentId),
                  borderLeftWidth: 4,
                }}
                onClick={() => {
                  if (!isPast) {
                    onAppointmentClick(apt)
                    setOpen(false)
                  }
                }}
                draggable={!isPast && (userRole !== "client" || apt.clientId === currentUserId)}
                onDragStart={(e) => {
                  if (!isPast) onDragStart(e, apt)
                }}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-sm">
                      {userRole === "client" && apt.clientId !== currentUserId
                        ? maskXNumber(apt.clientXNumber, false)
                        : apt.clientName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(() => {
                        const [h, m] = apt.time.split(":").map(Number)
                        const period = h >= 12 ? "PM" : "AM"
                        const h12 = h % 12 || 12
                        return `${h12}:${m.toString().padStart(2, "0")} ${period}`
                      })()}
                    </p>
                  </div>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: getDepartmentColor(apt.departmentId) + "20",
                      color: getDepartmentColor(apt.departmentId),
                    }}
                  >
                    {apt.departmentName}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}