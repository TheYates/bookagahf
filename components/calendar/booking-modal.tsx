"use client"

import * as React from "react"
import { format } from "date-fns"
import {
  Calendar as CalendarIcon,
  Clock,
  User,
  Stethoscope,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"

interface Department {
  id: number
  name: string
  description: string
  slots_per_day: number
  working_days: string[]
  working_hours: { start: string; end: string }
  is_active: boolean
}

interface BookingModalProps {
  isOpen: boolean
  onClose: () => void
  selectedDate: Date | null
  selectedTime: string | null
  userRole: "client" | "receptionist" | "admin" | "reviewer"
  currentUserId?: string
  onAppointmentBooked?: () => void
}

export function BookingModal({
  isOpen,
  onClose,
  selectedDate,
  selectedTime,
  userRole,
  currentUserId,
  onAppointmentBooked,
}: BookingModalProps) {
  const [departments, setDepartments] = React.useState<Department[]>([])
  const [loading, setLoading] = React.useState(false)
  const [formData, setFormData] = React.useState({
    clientName: "",
    clientXNumber: "",
    contactPhone: "",
    departmentId: "",
    notes: "",
  })

  React.useEffect(() => {
    if (isOpen) {
      fetchDepartments()
    }
  }, [isOpen])

  const fetchDepartments = async () => {
    try {
      const response = await fetch("/api/departments")
      const data = await response.json()
      if (data.success || data.departments) {
        setDepartments(data.departments || data)
      }
    } catch (error) {
      console.error("Error fetching departments:", error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedDate || !selectedTime || !formData.departmentId) {
      toast.error("Please fill in all required fields")
      return
    }

    setLoading(true)
    try {
      const [hours, minutes] = selectedTime.split(":").map(Number)
      const scheduledAt = new Date(selectedDate)
      scheduledAt.setHours(hours, minutes, 0, 0)

      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_name: formData.clientName,
          x_number: formData.clientXNumber || null,
          contact_phone: formData.contactPhone || null,
          doctor_id: formData.departmentId,
          scheduled_at: scheduledAt.toISOString(),
          notes: formData.notes || null,
          created_by: currentUserId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to book appointment")
      }

      toast.success("Appointment Booked!", {
        description: `Booked for ${format(selectedDate, "MMMM d, yyyy")} at ${selectedTime}`,
      })

      onAppointmentBooked?.()
      handleClose()
    } catch (error: any) {
      toast.error("Booking Failed", {
        description: error.message || "Something went wrong",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setFormData({
      clientName: "",
      clientXNumber: "",
      contactPhone: "",
      departmentId: "",
      notes: "",
    })
    onClose()
  }

  if (!selectedDate) return null

  const dateStr = format(selectedDate, "EEEE, MMMM d, yyyy")

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Book Appointment</DialogTitle>
        </DialogHeader>

        <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarIcon className="h-4 w-4" />
          <span>{dateStr}</span>
          {selectedTime && (
            <span className="font-medium text-primary">• {selectedTime}</span>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="clientName">Patient Name *</Label>
            <Input
              id="clientName"
              value={formData.clientName}
              onChange={(e) =>
                setFormData({ ...formData, clientName: e.target.value })
              }
              placeholder="Enter patient name"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="clientXNumber">X-Number</Label>
              <Input
                id="clientXNumber"
                value={formData.clientXNumber}
                onChange={(e) =>
                  setFormData({ ...formData, clientXNumber: e.target.value })
                }
                placeholder="X12345/26"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contactPhone">Phone</Label>
              <Input
                id="contactPhone"
                type="tel"
                value={formData.contactPhone}
                onChange={(e) =>
                  setFormData({ ...formData, contactPhone: e.target.value })
                }
                placeholder="+233 XX XXX XXXX"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="department">Department *</Label>
            <Select
              value={formData.departmentId}
              onValueChange={(value) =>
                setFormData({ ...formData, departmentId: value })
              }
            >
              <SelectTrigger id="department">
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id.toString()}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Input
              id="notes"
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="Optional notes"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Booking..." : "Book Appointment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
