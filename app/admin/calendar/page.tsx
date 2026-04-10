"use client"

import * as React from "react"
import { CalendarView } from "@/components/calendar/calendar-view"

export default function AdminCalendarPage() {
  const [userRole] = React.useState<"admin" | "receptionist" | "reviewer">(
    "admin"
  )
  const [currentUserId] = React.useState<string | undefined>(undefined)

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col">
      <div className="mb-2 flex-none">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <p className="text-sm text-muted-foreground">
          View and manage appointments in calendar view.
        </p>
      </div>

      <CalendarView userRole={userRole} currentUserId={currentUserId} />
    </div>
  )
}
