"use client"

import { useState } from "react"
import { ChevronRight, Calendar as CalendarX } from "lucide-react"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface Appointment {
  id: string
  date: string
  status: string
  departmentName?: string
  departmentColor?: string
  notes?: string | null
  doctorName?: string
  slotStartTime?: string
  slotEndTime?: string
  slotNumber?: number
  scheduled_at?: string
  specialties?: { name: string } | null
  profiles?: { full_name: string } | null
}

interface MobileAppointmentsListProps {
  appointments: Appointment[]
  isLoading: boolean
  onCancel: (id: string) => void
  onReschedule?: (id: string) => void
}

function AppointmentRow({
  apt,
  onCancel,
  onReschedule,
  getStatusColor,
  getStatusLabel,
  getStatusTooltip,
}: {
  apt: Appointment
  onCancel: (id: string) => void
  onReschedule?: (id: string) => void
  getStatusColor: (s: string) => string
  getStatusLabel: (s: string) => string
  getStatusTooltip: (s: string) => string
}) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="bg-card transition-all duration-200">
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex cursor-pointer items-center p-4 transition-colors active:bg-zinc-50 dark:active:bg-white/[0.02]"
      >
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border shadow-sm",
            getStatusColor(apt.status)
          )}
        >
          <span className="mb-0.5 text-[10px] leading-none font-bold uppercase opacity-60">
            {format(new Date(apt.scheduled_at || apt.date), "MMM")}
          </span>
          <span className="text-lg leading-none font-black">
            {format(new Date(apt.scheduled_at || apt.date), "d")}
          </span>
        </div>

        <div className="ml-4 min-w-0 flex-1">
          <div className="mb-0.5 flex items-center justify-between">
            <h4 className="truncate pr-2 text-sm font-bold text-foreground">
              {apt.specialties?.name || apt.doctorName || "Appointment"}
            </h4>
            {apt.status === "review" && (
              <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
            )}
            {(apt.status === "scheduled" || apt.status === "confirmed") && (
              <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
            )}
            {apt.status === "cancelled" && (
              <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-300" />
            )}
          </div>

          <p className="truncate text-xs text-muted-foreground">
            {apt.profiles?.full_name ? `${apt.profiles.full_name} • ` : ""}
            {apt.slotStartTime && apt.slotEndTime
              ? `${apt.slotStartTime.slice(0, 5)} - ${apt.slotEndTime.slice(0, 5)}`
              : apt.scheduled_at
                ? new Date(apt.scheduled_at).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : `Slot #${apt.slotNumber || "—"}`}
          </p>
        </div>

        <div className="ml-2 text-muted-foreground/30">
          <ChevronRight
            className={cn(
              "h-5 w-5 transition-transform duration-200",
              isExpanded && "rotate-90"
            )}
          />
        </div>
      </div>

      <div
        className={cn(
          "grid overflow-hidden px-4 transition-all duration-200 ease-in-out",
          isExpanded
            ? "grid-rows-[1fr] pb-4 opacity-100"
            : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="min-h-0 border-t border-dashed border-zinc-100 pt-2 dark:border-zinc-800">
          <div className="mt-2 mb-4 flex items-center justify-between">
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="secondary"
                  className="h-5 cursor-help px-1.5 text-[10px] font-bold tracking-widest uppercase"
                >
                  {getStatusLabel(apt.status)}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>{getStatusTooltip(apt.status)}</p>
              </TooltipContent>
            </Tooltip>
            <span className="text-xs font-medium text-muted-foreground">
              {format(new Date(apt.scheduled_at || apt.date), "EEEE")}
            </span>
          </div>

          {["scheduled", "rescheduled", "review", "confirmed"].includes(
            apt.status
          ) ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="h-9 flex-1 rounded-lg text-xs font-semibold"
                onClick={(e) => {
                  e.stopPropagation()
                  onReschedule?.(apt.id)
                }}
              >
                Reschedule
              </Button>
              <Button
                variant="destructive"
                className="h-9 flex-1 rounded-lg border-red-100 bg-red-50 text-xs text-red-600 shadow-none dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-400"
                onClick={(e) => {
                  e.stopPropagation()
                  onCancel(apt.id)
                }}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <p className="py-2 text-center text-xs text-muted-foreground">
              No actions available for this appointment.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export function MobileAppointmentsList({
  appointments,
  isLoading,
  onCancel,
  onReschedule,
}: MobileAppointmentsListProps) {
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      review:
        "bg-amber-50/50 text-amber-700 border-amber-200 dark:bg-amber-900/10 dark:text-amber-400 dark:border-amber-800",
      reschedule_requested:
        "bg-red-50/50 text-red-700 border-red-200 dark:bg-red-900/10 dark:text-red-400 dark:border-red-800",
      booked:
        "bg-blue-50/50 text-blue-700 border-blue-200 dark:bg-blue-900/10 dark:text-blue-400 dark:border-blue-800",
      confirmed:
        "bg-green-50/50 text-green-700 border-green-200 dark:bg-green-900/10 dark:text-green-400 dark:border-green-800",
      arrived:
        "bg-yellow-50/50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/10 dark:text-yellow-400 dark:border-yellow-800",
      waiting:
        "bg-purple-50/50 text-purple-700 border-purple-200 dark:bg-purple-900/10 dark:text-purple-400 dark:border-purple-800",
      completed:
        "bg-emerald-50/50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/10 dark:text-emerald-400 dark:border-emerald-800",
      no_show:
        "bg-red-50/50 text-red-700 border-red-200 dark:bg-red-900/10 dark:text-red-400 dark:border-red-800",
      cancelled:
        "bg-zinc-100/50 text-zinc-500 border-zinc-200 dark:bg-zinc-800/30 dark:text-zinc-500 dark:border-zinc-700",
      rescheduled:
        "bg-orange-50/50 text-orange-700 border-orange-200 dark:bg-orange-900/10 dark:text-orange-400 dark:border-orange-800",
      scheduled:
        "bg-blue-50/50 text-blue-700 border-blue-200 dark:bg-blue-900/10 dark:text-blue-400 dark:border-blue-800",
    }
    return colors[status] || "bg-zinc-50 border-zinc-200"
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      review: "Pending",
      reschedule_requested: "Reschedule",
      booked: "Confirmed",
      confirmed: "Confirmed",
      arrived: "Arrived",
      waiting: "Waiting",
      completed: "Done",
      no_show: "Missed",
      cancelled: "Cancelled",
      rescheduled: "Moved",
      scheduled: "Pending",
    }
    return labels[status] || status
  }

  const getStatusTooltip = (status: string) => {
    const tooltips: Record<string, string> = {
      review: "Awaiting staff confirmation",
      reschedule_requested: "Staff requested a new time",
      booked: "Appointment confirmed",
      confirmed: "Appointment confirmed",
      arrived: "Patient has arrived",
      waiting: "Patient is waiting",
      completed: "Appointment completed",
      no_show: "Patient did not show up",
      cancelled: "Appointment cancelled",
      rescheduled: "Moved to a new time",
      scheduled: "Awaiting confirmation",
    }
    return tooltips[status] || status
  }

  if (isLoading) {
    return (
      <div className="divide-y divide-zinc-100 border-t border-b border-zinc-100 pb-24 dark:divide-zinc-800 dark:border-zinc-800">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-4 p-4">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (appointments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-50 dark:bg-zinc-800/50">
          <CalendarX className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />
        </div>
        <h3 className="text-base font-bold text-foreground">
          No appointments found
        </h3>
        <p className="mt-1.5 max-w-[200px] text-xs text-muted-foreground">
          No appointments match your current filter.
        </p>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="pb-24">
        <div className="divide-y divide-zinc-100 border-t border-b border-zinc-100 dark:divide-zinc-800 dark:border-zinc-800">
          {appointments.map((apt) => (
            <AppointmentRow
              key={apt.id}
              apt={apt}
              onCancel={onCancel}
              onReschedule={onReschedule}
              getStatusColor={getStatusColor}
              getStatusLabel={getStatusLabel}
              getStatusTooltip={getStatusTooltip}
            />
          ))}
        </div>
      </div>
    </TooltipProvider>
  )
}
