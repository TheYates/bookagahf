"use client"

import * as React from "react"
import { format } from "date-fns"
import { Calendar, Clock, User, Stethoscope, FileText, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  status: string
  statusColor: string
  notes?: string | null
}

interface AppointmentModalProps {
  isOpen: boolean
  onClose: () => void
  appointment: Appointment | null
  userRole: "client" | "receptionist" | "admin" | "reviewer"
  currentUserId?: number
  onAppointmentUpdate?: (appointment: Appointment) => void
  onAppointmentDelete?: (appointmentId: number) => void
}

const STATUSES = [
  { value: "scheduled", label: "Scheduled" },
  { value: "confirmed", label: "Confirmed" },
  { value: "arrived", label: "Arrived" },
  { value: "waiting", label: "Waiting" },
  { value: "completed", label: "Completed" },
  { value: "no_show", label: "No Show" },
  { value: "cancelled", label: "Cancelled" },
]

export function AppointmentModal({
  isOpen,
  onClose,
  appointment,
  userRole,
  currentUserId,
  onAppointmentUpdate,
  onAppointmentDelete,
}: AppointmentModalProps) {
  const [loading, setLoading] = React.useState(false)
  const [status, setStatus] = React.useState("")
  const [notes, setNotes] = React.useState("")
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false)

  React.useEffect(() => {
    if (appointment) {
      setStatus(appointment.status)
      setNotes(appointment.notes || "")
    }
  }, [appointment])

  const handleStatusChange = async (newStatus: string) => {
    if (!appointment) return

    setLoading(true)
    try {
      const response = await fetch(`/api/appointments/${appointment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to update status")
      }

      setStatus(newStatus)
      onAppointmentUpdate?.({
        ...appointment,
        status: newStatus,
      })

      toast.success("Status Updated", {
        description: `Appointment marked as ${newStatus}`,
      })
    } catch (error: any) {
      toast.error("Update Failed", {
        description: error.message || "Something went wrong",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleNotesUpdate = async () => {
    if (!appointment) return

    setLoading(true)
    try {
      const response = await fetch(`/api/appointments/${appointment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to update notes")
      }

      onAppointmentUpdate?.({
        ...appointment,
        notes,
      })

      toast.success("Notes Updated")
    } catch (error: any) {
      toast.error("Update Failed", {
        description: error.message || "Something went wrong",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!appointment) return

    setLoading(true)
    try {
      const response = await fetch(`/api/appointments/${appointment.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to delete appointment")
      }

      onAppointmentDelete?.(appointment.id)
      toast.success("Appointment Deleted")
      handleClose()
    } catch (error: any) {
      toast.error("Delete Failed", {
        description: error.message || "Something went wrong",
      })
    } finally {
      setLoading(false)
      setShowDeleteConfirm(false)
    }
  }

  const handleClose = () => {
    setShowDeleteConfirm(false)
    onClose()
  }

  if (!appointment) return null

  const isEditable = userRole === "admin" || userRole === "receptionist"
  const appointmentDate = new Date(appointment.date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const isPast = new Date(appointmentDate.setHours(0, 0, 0, 0)) < today

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Appointment Details</DialogTitle>
            <DialogDescription>
              View and manage appointment information
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Patient</p>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{appointment.clientName}</span>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">X-Number</p>
                <span className="font-mono text-sm">
                  {appointment.clientXNumber || "—"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Date & Time</p>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {format(appointmentDate, "MMM d, yyyy")}
                  </span>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {(() => {
                      const [h, m] = appointment.time.split(":").map(Number)
                      const period = h >= 12 ? "PM" : "AM"
                      const h12 = h % 12 || 12
                      return `${h12}:${m.toString().padStart(2, "0")} ${period}`
                    })()}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Department</p>
                <div className="flex items-center gap-2">
                  <Stethoscope className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{appointment.departmentName}</span>
                </div>
              </div>
            </div>

            {isEditable && !isPast && (
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={handleStatusChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Notes</Label>
              {isEditable && !isPast ? (
                <div className="flex gap-2">
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add notes..."
                    rows={2}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleNotesUpdate}
                    disabled={loading || notes === appointment.notes}
                  >
                    Save
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {appointment.notes || "No notes"}
                </p>
              )}
            </div>

            {isEditable && !isPast && (
              <div className="flex justify-between pt-4 border-t">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>

                <Button variant="outline" onClick={handleClose}>
                  Close
                </Button>
              </div>
            )}
            {isEditable && isPast && (
              <div className="pt-4 border-t">
                <Button variant="outline" onClick={handleClose}>
                  Close
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Appointment?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. Are you sure you want to delete this appointment?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}