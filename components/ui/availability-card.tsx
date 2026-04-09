"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

export interface Slot {
  id: string | number
  day: number
  month: string
}

export interface AvailabilityCardProps {
  title?: string
  slots: Slot[]
  selectedSlotId: string | number | null
  onSlotSelect: (id: string | number) => void
  className?: string
}

export const AvailabilityCard = ({
  title = "Free Slots Available",
  slots,
  selectedSlotId,
  onSlotSelect,
  className,
}: AvailabilityCardProps) => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
      },
    },
  }

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 },
  }

  return (
    <div
      className={cn(
        "w-full max-w-md rounded-xl border bg-card text-card-foreground shadow-lg",
        className
      )}
    >
      <div className="p-6">
        <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      </div>
      <motion.div
        className="grid grid-cols-2 gap-4 p-6 pt-0 sm:grid-cols-3"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {slots.map((slot) => (
          <motion.button
            key={slot.id}
            onClick={() => onSlotSelect(slot.id)}
            variants={itemVariants}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            aria-pressed={slot.id === selectedSlotId}
            className={cn(
              "flex aspect-square flex-col items-center justify-center rounded-lg border text-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              slot.id === selectedSlotId
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-card hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <span className="text-3xl font-bold leading-none">
              {slot.day.toString().padStart(2, "0")}
            </span>
            <span
              className={cn(
                "mt-1",
                slot.id === selectedSlotId
                  ? "text-primary-foreground/80"
                  : "text-muted-foreground"
              )}
            >
              {slot.month}
            </span>
          </motion.button>
        ))}
      </motion.div>
    </div>
  )
}