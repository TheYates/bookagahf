"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface ViewSwitcherProps {
  currentView: "month" | "week" | "day"
  onViewChange: (view: "month" | "week" | "day") => void
}

export function ViewSwitcher({ currentView, onViewChange }: ViewSwitcherProps) {
  const views = [
    { value: "month", label: "Month" },
    { value: "week", label: "Week" },
    { value: "day", label: "Day" },
  ] as const

  return (
    <div className="inline-flex items-center rounded-lg border bg-background p-1">
      {views.map((view) => (
        <button
          key={view.value}
          onClick={() => onViewChange(view.value)}
          className={cn(
            "rounded-md px-3 py-1 text-xs font-medium transition-colors",
            currentView === view.value
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {view.label}
        </button>
      ))}
    </div>
  )
}