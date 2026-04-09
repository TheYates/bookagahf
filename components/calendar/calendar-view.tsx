"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"

import { cn } from "@/lib/utils"
import { BookingModal } from "./booking-modal"
import { ViewSwitcher } from "./view-switcher"
import { AppointmentModal } from "./appointment-modal"
import { ScrollArea } from "@/components/ui/scroll-area"
import { DayAppointmentsPopover } from "./day-appointments-popover"
import {
  isValidBookingDate,
  isWorkingDayForAnyDepartment,
} from "@/lib/working-days-utils"
import { toast } from "sonner"

interface Appointment {
  id: string
  clientId: string
  clientName: string
  clientXNumber: string | null
  departmentId: string
  departmentName: string
  date: string
  time: string
  endTime?: string
  status: string
  statusColor: string
  notes?: string | null
}

interface Department {
  id: string
  name: string
  description: string | null
  slots_per_day: number
  working_days: string[]
  working_hours: { start: string; end: string }
  is_active: boolean
}

interface CalendarViewProps {
  userRole: "client" | "receptionist" | "admin" | "reviewer"
  currentUserId?: number
}

export function CalendarView({ userRole, currentUserId }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<"month" | "week" | "day">("month")
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [appointmentDuration, setAppointmentDuration] = useState(30)
  const [draggedAppointment, setDraggedAppointment] =
    useState<Appointment | null>(null)
  const [bookingModal, setBookingModal] = useState({
    isOpen: false,
    selectedDate: null as Date | null,
    selectedTime: null as string | null,
  })
  const [appointmentModal, setAppointmentModal] = useState({
    isOpen: false,
    appointment: null as Appointment | null,
  })

  useEffect(() => {
    fetchDepartments()
    fetchAppointments()
    fetchSettings()
  }, [currentDate, view, userRole, currentUserId])

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/settings")
      const data = await response.json()
      if (data.settings?.appointment_duration) {
        setAppointmentDuration(data.settings.appointment_duration)
      }
    } catch (error) {
      console.error("Error fetching settings:", error)
    }
  }

  const fetchDepartments = async () => {
    try {
      const response = await fetch("/api/departments")
      const data = await response.json()
      if (data.success || data.departments) {
        setDepartments(data.departments || data.data || [])
      }
    } catch (error) {
      console.error("Error fetching departments:", error)
    }
  }

  const fetchAppointments = async () => {
    try {
      let startDate: string
      let endDate: string

      if (view === "month") {
        const firstDay = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          1
        )
        const lastDay = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth() + 1,
          0
        )
        startDate = firstDay.toISOString().split("T")[0]
        endDate = lastDay.toISOString().split("T")[0]
      } else if (view === "week") {
        const startOfWeek = new Date(currentDate)
        startOfWeek.setDate(currentDate.getDate() - currentDate.getDay())
        const endOfWeek = new Date(startOfWeek)
        endOfWeek.setDate(startOfWeek.getDate() + 6)
        startDate = startOfWeek.toISOString().split("T")[0]
        endDate = endOfWeek.toISOString().split("T")[0]
      } else {
        startDate = currentDate.toISOString().split("T")[0]
        endDate = startDate
      }

      const url = new URL("/api/appointments", window.location.origin)
      url.searchParams.set("startDate", startDate)
      url.searchParams.set("endDate", endDate)

      const response = await fetch(url.toString())
      const data = await response.json()

      if (data.appointments) {
        const transformedAppointments = data.appointments.map((apt: any) => {
          const scheduledDate = new Date(apt.scheduled_at)
          const hours = scheduledDate.getHours()
          const minutes = scheduledDate.getMinutes()
          const timeString = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`
          
          return {
            id: apt.id,
            clientId: apt.created_by || apt.clientId || "",
            clientName: apt.patient_name || apt.clientName,
            clientXNumber: apt.x_number || apt.clientXNumber,
            departmentId: apt.doctor_id || apt.departmentId,
            departmentName:
              apt.specialties?.name || apt.departmentName || "Unknown",
            date: apt.scheduled_at
              ? new Date(apt.scheduled_at).toISOString().split("T")[0]
              : apt.date,
            time: timeString,
            status: apt.status,
            statusColor: getStatusColor(apt.status),
            notes: apt.notes,
          }
        })
        setAppointments(transformedAppointments)
      }
    } catch (error) {
      console.error("Error fetching appointments:", error)
    }
  }

  const getStatusColor = (status: string) => {
    const statusColors: { [key: string]: string } = {
      pending_review: "#F59E0B",
      reschedule_requested: "#DC2626",
      booked: "#3B82F6",
      scheduled: "#3B82F6",
      confirmed: "#10B981",
      arrived: "#10B981",
      waiting: "#F59E0B",
      completed: "#059669",
      no_show: "#EF4444",
      cancelled: "#6B7280",
      rescheduled: "#F97316",
      review: "#F59E0B",
    }
    return statusColors[status] || "#6B7280"
  }

  const isPastDate = (date: Date) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const checkDate = new Date(date)
    checkDate.setHours(0, 0, 0, 0)
    return checkDate < today
  }

  const isPastAppointment = (appointment: Appointment) => {
    return isPastDate(new Date(appointment.date))
  }

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const days = []

    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }

    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day))
    }

    return days
  }

  const getWeekDays = (date: Date) => {
    const startOfWeek = new Date(date)
    const day = startOfWeek.getDay()
    const diff = startOfWeek.getDate() - day
    startOfWeek.setDate(diff)

    const weekDays = []
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek)
      day.setDate(startOfWeek.getDate() + i)
      weekDays.push(day)
    }

    return weekDays
  }

  const getAppointmentsForDate = (date: Date) => {
    const dateString = date.toISOString().split("T")[0]
    return appointments.filter((apt) => apt.date === dateString)
  }

  const getMaxSlots = () => {
    if (departments.length === 0) return 10
    return Math.max(...departments.map((d) => d.slots_per_day || 10))
  }

  const getDepartmentColor = (departmentId: string) => {
    const colors: { [key: string]: string } = {
      "1": "#3B82F6",
      "2": "#EF4444",
      "3": "#10B981",
      "4": "#8B5CF6",
      "5": "#F59E0B",
    }
    return colors[departmentId] || "#6B7280"
  }

  const maskXNumber = (xNumber: string | null, _isOwnAppointment: boolean) => {
    if (!xNumber) return "—"
    if (userRole === "client") return xNumber.substring(0, 4) + "**/**"
    return xNumber
  }

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev)
      if (direction === "prev") {
        newDate.setMonth(prev.getMonth() - 1)
      } else {
        newDate.setMonth(prev.getMonth() + 1)
      }
      return newDate
    })
  }

  const navigateWeek = (direction: "prev" | "next") => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev)
      if (direction === "prev") {
        newDate.setDate(prev.getDate() - 7)
      } else {
        newDate.setDate(prev.getDate() + 7)
      }
      return newDate
    })
  }

  const navigateDay = (direction: "prev" | "next") => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev)
      if (direction === "prev") {
        newDate.setDate(prev.getDate() - 1)
      } else {
        newDate.setDate(prev.getDate() + 1)
      }
      return newDate
    })
  }

  const handleBookSlot = (date: Date, time: string) => {
    if (!isValidBookingDate(date, undefined, departments as any)) {
      return
    }

    setBookingModal({
      isOpen: true,
      selectedDate: date,
      selectedTime: time,
    })
  }

  const handleAppointmentClick = (appointment: Appointment) => {
    setAppointmentModal({
      isOpen: true,
      appointment,
    })
  }

  const handleAppointmentBooked = () => {
    fetchAppointments()
  }

  const handleAppointmentUpdate = (updatedAppointment: Appointment) => {
    setAppointments((prev) =>
      prev.map((apt) =>
        apt.id === updatedAppointment.id ? updatedAppointment : apt
      )
    )
  }

  const handleAppointmentDelete = (appointmentId: string) => {
    setAppointments((prev) => prev.filter((apt) => apt.id !== appointmentId))
  }

  const handleDragStart = (e: React.DragEvent, appointment: Appointment) => {
    if (isPastAppointment(appointment)) {
      e.preventDefault()
      return
    }
    setDraggedAppointment(appointment)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }

  const handleDrop = (
    e: React.DragEvent,
    targetDate: Date,
    targetTime: string,
  ) => {
    e.preventDefault()
    if (!draggedAppointment) return

    const dateString = targetDate.toISOString().split("T")[0]

    const existingAppointment = appointments.find(
      (apt) =>
        apt.date === dateString &&
        apt.time === targetTime &&
        apt.id !== draggedAppointment.id
    )

    if (existingAppointment) {
      toast.error("Time Slot Occupied", {
        description: "This time slot is already occupied by another appointment",
        duration: 4000,
      })
      setDraggedAppointment(null)
      return
    }

    const [hours, minutes] = targetTime.split(":").map(Number)
    const newScheduledAt = new Date(targetDate)
    newScheduledAt.setHours(hours, minutes, 0, 0)

    const updatedAppointment = {
      ...draggedAppointment,
      date: dateString,
      time: targetTime,
      scheduledAt: newScheduledAt.toISOString(),
    }

    setAppointments((prev) =>
      prev.map((apt) =>
        apt.id === draggedAppointment.id ? updatedAppointment : apt
      )
    )

    const newDate = targetDate.toLocaleDateString()
    toast.success("Appointment Moved!", {
      description: `${draggedAppointment.clientName}'s appointment moved to ${newDate} at ${targetTime}`,
      duration: 4000,
    })

    setDraggedAppointment(null)
  }

  const renderMonthView = () => {
    const days = getDaysInMonth(currentDate)
    const monthName = currentDate.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    })

    return (
      <div className="flex flex-col h-full min-h-0">
        <div className="flex-none flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
          <h2 className="text-xl sm:text-2xl font-bold">{monthName}</h2>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateMonth("prev")}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateMonth("next")}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentDate(new Date())}
              >
                Today
              </Button>
            </div>
            <ViewSwitcher currentView={view} onViewChange={setView} />
          </div>
        </div>

        <div className="flex flex-col flex-1 min-h-0">
          {/* Header row */}
          <div className="grid grid-cols-7 gap-1">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div
                key={day}
                className="p-2 text-center font-medium text-sm text-muted-foreground h-10"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid - fills remaining space */}
          <div className="grid grid-cols-7 gap-1 flex-1 auto-rows-fr">
            {days.map((day, index) => {
              if (!day) {
                return <div key={index} className="border rounded-lg" />
              }

              const dayAppointments = getAppointmentsForDate(day)
              const isToday = new Date().toDateString() === day.toDateString()
              const isPast = isPastDate(day)
              const isWorkingDay = isWorkingDayForAnyDepartment(departments as any, day)
              const isValidForBooking = isValidBookingDate(
                day,
                undefined,
                departments as any
              )

              return (
                <div
                  key={index}
                  className={cn(
                    "p-2 border rounded-lg flex flex-col min-h-0 overflow-hidden",
                    isPast && "hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-600 cursor-not-allowed",
                    !isWorkingDay && !isPast && "bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed",
                    !isPast && isWorkingDay && "cursor-pointer"
                  )}
                  onClick={() => isValidForBooking && !isPast && handleBookSlot(day, "08:00")}
                  onDragOver={isValidForBooking && !isPast ? handleDragOver : undefined}
                  onDrop={
                    isValidForBooking && !isPast ? (e) => handleDrop(e, day, "08:00") : undefined
                  }
                >
                  <div className="flex justify-between items-start mb-1">
                    <span
                      className={cn(
                        "text-sm font-medium text-foreground",
                        isToday && "font-bold text-green-600 dark:text-green-400",
                        isPast && "text-gray-400 dark:text-gray-500"
                      )}
                    >
                      {day.getDate()}
                    </span>
                  </div>

                  <div className="space-y-1 flex-1 overflow-hidden">
                    {dayAppointments.slice(0, 2).map((apt) => {
                      const isPastApt = isPastAppointment(apt)
                      return (
                        <div
                          key={apt.id}
                          className={cn(
                            "text-xs p-1 rounded truncate border-l-2",
                            isPastApt
                              ? "cursor-not-allowed opacity-50"
                              : "cursor-pointer"
                          )}
                          style={{
                            backgroundColor:
                              getDepartmentColor(apt.departmentId) + "20",
                            color: getDepartmentColor(apt.departmentId),
                            borderLeftColor: getDepartmentColor(apt.departmentId),
                          }}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (!isPastApt) handleAppointmentClick(apt)
                          }}
                          draggable={!isPastApt}
                          onDragStart={(e) => {
                            if (!isPastApt) handleDragStart(e, apt)
                          }}
                        >
                        <div className="font-medium text-xs truncate">
                          {userRole === "client" && apt.clientId !== currentUserId?.toString()
                            ? `${maskXNumber(apt.clientXNumber, false)} - ***`
                            : `${apt.clientXNumber ?? "—"} - ${apt.clientName}`}
                        </div>
                        <div className="opacity-60 text-xs truncate">
                          {apt.departmentName}
                        </div>
                      </div>
                      )
                    })}
                    {dayAppointments.length > 2 && (
                      <DayAppointmentsPopover
                        appointments={dayAppointments}
                        date={day}
                        getDepartmentColor={(id) => getDepartmentColor(id.toString())}
                        maskXNumber={maskXNumber}
                        currentUserId={currentUserId}
                        userRole={userRole}
                        onAppointmentClick={handleAppointmentClick}
                        onDragStart={handleDragStart}
                        isPast={isPast}
                      >
                        <div className="text-xs text-muted-foreground cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                          +{dayAppointments.length - 2} more
                        </div>
                      </DayAppointmentsPopover>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  const renderWeekView = () => {
    const weekDays = getWeekDays(currentDate)
    const weekStart = weekDays[0]
    const weekEnd = weekDays[6]
    const weekRange = `${weekStart.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })} - ${weekEnd.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}`

    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h2 className="text-xl sm:text-2xl font-bold">{weekRange}</h2>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateWeek("prev")}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateWeek("next")}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentDate(new Date())}
              >
                Today
              </Button>
            </div>
            <ViewSwitcher currentView={view} onViewChange={setView} />
          </div>
        </div>

        <div className="flex flex-col">
          <div className="grid grid-cols-8 gap-2 mb-2">
            <div className="h-16 flex items-center justify-center font-medium text-sm text-muted-foreground">
              Slots
            </div>
            {weekDays.map((day, dayIndex) => {
              const isToday = new Date().toDateString() === day.toDateString()
              const isPast = isPastDate(day)
              const isWorkingDay = isWorkingDayForAnyDepartment(departments as any, day)
              const isValidForBooking = isValidBookingDate(
                day,
                undefined,
                departments as any
              )

              return (
                <div
                  key={dayIndex}
                  className={cn(
                    "h-16 p-2 border rounded-lg transition-colors flex flex-col items-center justify-center",
                    isPast
                      ? "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed hover:bg-red-100 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-600"
                      : !isWorkingDay
                      ? "bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed opacity-60"
                      : "cursor-pointer hover:bg-green-50 dark:hover:bg-green-900/20 hover:border-green-300 dark:hover:border-green-600",
                    isToday &&
                      !isPast &&
                      isWorkingDay &&
                      "bg-blue-50 dark:bg-blue-900/20"
                  )}
                  onClick={() => isValidForBooking && handleBookSlot(day, "08:00")}
                >
                  <div className="text-xs text-muted-foreground">
                    {day.toLocaleDateString("en-US", { weekday: "short" })}
                  </div>
                  <div
                    className={cn(
                      "text-lg font-semibold text-foreground",
                      isToday && "text-blue-600 dark:text-blue-400",
                      isPast && "text-gray-400 dark:text-gray-500"
                    )}
                  >
                    {day.getDate()}
                  </div>
                </div>
              )
            })}
          </div>

          <ScrollArea className="h-[calc(100vh-20rem)]">
            <div className="grid grid-cols-8 gap-2">
              <div className="space-y-2">
                {generateTimeSlotsDisplay().map((timeDisplay) => (
                  <div
                    key={timeDisplay}
                    className="h-16 flex items-center justify-center text-sm font-medium bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded"
                  >
                    {timeDisplay}
                  </div>
                ))}
              </div>

              {weekDays.map((day, dayIndex) => {
                const dayAppointments = getAppointmentsForDate(day)
                const isPast = isPastDate(day)
                const isWorkingDay = isWorkingDayForAnyDepartment(departments as any, day)
                const isValidForBooking = isValidBookingDate(
                  day,
                  undefined,
                  departments as any
                )

                return (
                  <div key={dayIndex} className="space-y-2">
                    {generateTimeSlots().map((time) => {
                      const timeAppointments = dayAppointments.filter(
                        (apt) => apt.time === time
                      )
                      const appointment = timeAppointments[0]

                      return (
                        <div
                          key={time}
                          className={cn(
                            "h-16 p-2 border rounded transition-colors",
                            appointment
                              ? "border-l-4 cursor-pointer"
                              : isPast
                              ? "cursor-not-allowed"
                              : !isWorkingDay
                              ? "cursor-not-allowed bg-gray-50 dark:bg-gray-800 opacity-60"
                              : "cursor-pointer"
                          )}
                          style={
                            appointment
                              ? {
                                  borderLeftColor: getDepartmentColor(
                                    appointment.departmentId
                                  ),
                                  backgroundColor:
                                    getDepartmentColor(
                                      appointment.departmentId
                                    ) + "10",
                                }
                              : {}
                          }
                          onClick={() => {
                            if (isPast) return
                            if (appointment && timeAppointments.length === 1) {
                              handleAppointmentClick(appointment)
                            } else if (!appointment && isValidForBooking) {
                              handleBookSlot(day, time)
                            }
                          }}
                          onDragOver={!isPast && isValidForBooking ? handleDragOver : undefined}
                          onDrop={!isPast && isValidForBooking ? (e) => handleDrop(e, day, time) : undefined}
                        >
                          {appointment ? (
                            timeAppointments.length > 1 ? (
                              <DayAppointmentsPopover
                                appointments={timeAppointments}
                                date={day}
                                getDepartmentColor={(id) => getDepartmentColor(id.toString())}
                                maskXNumber={maskXNumber}
                                currentUserId={currentUserId}
                                userRole={userRole}
                                onAppointmentClick={handleAppointmentClick}
                                onDragStart={handleDragStart}
                                isPast={isPast}
                              >
                                <div className="h-full flex flex-col justify-center relative cursor-pointer">
                                  <div className="text-xs font-medium truncate">
                                    {maskXNumber(
                                      appointment.clientXNumber,
                                      appointment.clientId === currentUserId?.toString()
                                    )}
                                  </div>
                                  <div
                                    className="text-xs truncate"
                                    style={{
                                      color: getDepartmentColor(
                                        appointment.departmentId
                                      ),
                                    }}
                                  >
                                    {appointment.departmentName}
                                  </div>
                                  <div className="absolute top-1 right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                                    {timeAppointments.length}
                                  </div>
                                </div>
                              </DayAppointmentsPopover>
                            ) : (
                              <div
                                className={cn(
                                  "h-full flex flex-col justify-center",
                                  isPastAppointment(appointment)
                                    ? "cursor-not-allowed opacity-50"
                                    : ""
                                )}
                                draggable={!isPastAppointment(appointment)}
                                onDragStart={(e) => {
                                  if (!isPastAppointment(appointment)) {
                                    handleDragStart(e, appointment)
                                  }
                                }}
                              >
                                <div className="text-xs font-medium truncate">
                                  {maskXNumber(
                                    appointment.clientXNumber,
                                    appointment.clientId === currentUserId?.toString()
                                  )}
                                </div>
                                <div
                                  className="text-xs truncate"
                                  style={{
                                    color: getDepartmentColor(
                                      appointment.departmentId
                                    ),
                                  }}
                                >
                                  {appointment.departmentName}
                                </div>
                              </div>
                            )
                          ) : (
                            <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                              {isPast ? "Empty" : "Available"}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </div>
      </div>
    )
  }

  const formatTime12hr = (time24: string) => {
    const [hours, minutes] = time24.split(":").map(Number)
    const period = hours >= 12 ? "PM" : "AM"
    const hours12 = hours % 12 || 12
    return `${hours12}:${minutes.toString().padStart(2, "0")} ${period}`
  }

  const generateTimeSlots = () => {
    const defaultStart = 8
    const defaultEnd = 17
    
    if (departments.length === 0) {
      const slots: string[] = []
      for (let mins = defaultStart * 60; mins < defaultEnd * 60; mins += appointmentDuration) {
        const h = Math.floor(mins / 60)
        const m = mins % 60
        slots.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`)
      }
      return slots
    }
    
    const allSlots: string[] = []
    departments.forEach((dept) => {
      if (dept.working_hours && dept.is_active) {
        const [startH, startM] = dept.working_hours.start.split(":").map(Number)
        const [endH, endM] = dept.working_hours.end.split(":").map(Number)
        
        const startMinutes = startH * 60 + startM
        const endMinutes = endH * 60 + endM
        
        for (let mins = startMinutes; mins < endMinutes; mins += appointmentDuration) {
          const h = Math.floor(mins / 60)
          const m = mins % 60
          const timeStr = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`
          if (!allSlots.includes(timeStr)) {
            allSlots.push(timeStr)
          }
        }
      }
    })
    
    return allSlots.sort()
  }

  const generateTimeSlotsDisplay = () => {
    return generateTimeSlots().map(time => formatTime12hr(time))
  }

  const getAppointmentsForTimeSlot = (date: Date, timeSlot: string) => {
    const dateStr = date.toISOString().split("T")[0]

    return appointments.filter(
      (apt) => apt.date === dateStr && apt.time === timeSlot
    )
  }

  const renderDayView = () => {
    const dayAppointments = getAppointmentsForDate(currentDate)
    const dateString = currentDate.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
    const timeSlots = generateTimeSlotsDisplay()
    const timeSlots24 = generateTimeSlots()
    const isPast = isPastDate(currentDate)
    const isWorkingDay = isWorkingDayForAnyDepartment(departments as any, currentDate)
    const isValidForBooking = isValidBookingDate(
      currentDate,
      undefined,
      departments as any
    )

    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h2 className="text-xl sm:text-2xl font-bold">{dateString}</h2>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateDay("prev")}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateDay("next")}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentDate(new Date())}
              >
                Today
              </Button>
            </div>
            <ViewSwitcher currentView={view} onViewChange={setView} />
          </div>
        </div>

        <div className="space-y-2 h-[600px] overflow-y-auto pr-2">
          {timeSlots.map((timeSlot, index) => {
            const time24 = timeSlots24[index]
            const slotAppointments = getAppointmentsForTimeSlot(
              currentDate,
              time24
            )

            return (
              <div key={timeSlot} className="flex items-start gap-4">
                <div className="w-16 text-sm text-gray-500 dark:text-gray-400 text-right pt-2">
                  {timeSlot}
                </div>
                <div
                  className={cn(
                    "flex-1 p-3 border dark:border-gray-700 rounded-lg transition-colors min-h-[60px]",
                    isPast && "opacity-60 cursor-not-allowed",
                    !isWorkingDay &&
                      !isPast &&
                      "bg-gray-50 dark:bg-gray-800 opacity-60 cursor-not-allowed",
                    !isPast && isValidForBooking && "cursor-pointer"
                  )}
                  onClick={() => {
                    if (isPast || !isValidForBooking) return
                    handleBookSlot(currentDate, time24)
                  }}
                  onDragOver={!isPast && isValidForBooking ? handleDragOver : undefined}
                  onDrop={!isPast && isValidForBooking ? (e) => {
                    handleDrop(e, currentDate, time24)
                  } : undefined}
                >
                  {slotAppointments.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-600">
                      <Plus className="w-4 h-4 mr-2" />
                      {isPast ? "Empty" : "Available"}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {slotAppointments.map((appointment) => (
                        <div
                          key={appointment.id}
                          className={cn(
                            "p-2 rounded-lg text-white flex-1 min-w-[160px] max-w-[220px]",
                            isPastAppointment(appointment)
                              ? "opacity-50 cursor-not-allowed"
                              : "cursor-pointer"
                          )}
                          style={{
                            backgroundColor: getDepartmentColor(
                              appointment.departmentId
                            ),
                          }}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (!isPastAppointment(appointment)) {
                              handleAppointmentClick(appointment)
                            }
                          }}
                          draggable={!isPastAppointment(appointment)}
                          onDragStart={(e) => {
                            if (!isPastAppointment(appointment)) {
                              handleDragStart(e, appointment)
                            }
                          }}
                        >
                          <div className="font-medium text-sm flex items-center gap-1">
                            <span className="opacity-75">
                              {maskXNumber(
                                appointment.clientXNumber,
                                appointment.clientId === currentUserId?.toString()
                              )}
                            </span>
                          </div>
                          <div className="truncate text-sm mt-1">
                            {userRole === "client" &&
                            appointment.clientId !== currentUserId?.toString()
                              ? "*** ***"
                              : appointment.clientName}
                          </div>
                          {appointment.notes && (
                            <div className="opacity-75 text-xs mt-1 truncate">
                              {userRole === "client" &&
                              appointment.clientId !== currentUserId?.toString()
                                ? "***"
                                : appointment.notes}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 flex flex-col h-full min-h-0">
      {view === "month" && renderMonthView()}
      {view === "week" && renderWeekView()}
      {view === "day" && renderDayView()}

      <BookingModal
        isOpen={bookingModal.isOpen}
        onClose={() =>
          setBookingModal({
            isOpen: false,
            selectedDate: null,
            selectedTime: null,
          })
        }
        selectedDate={bookingModal.selectedDate}
        selectedTime={bookingModal.selectedTime}
        userRole={userRole}
        currentUserId={currentUserId}
        onAppointmentBooked={handleAppointmentBooked}
      />

      <AppointmentModal
        isOpen={appointmentModal.isOpen}
        onClose={() =>
          setAppointmentModal({ isOpen: false, appointment: null })
        }
        appointment={appointmentModal.appointment as any}
        userRole={userRole}
        currentUserId={currentUserId}
        onAppointmentUpdate={handleAppointmentUpdate as any}
        onAppointmentDelete={handleAppointmentDelete as any}
      />
    </div>
  )
}