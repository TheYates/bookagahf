"use client"

import * as React from "react"
import {
  Plus,
  Search,
  Stethoscope,
  X,
  Pencil,
  Calendar,
  ChevronDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

type Doctor = {
  id: string
  full_name: string
  email: string
  phone: string | null
  is_active: boolean
  doctor_settings: { is_available: boolean }[] | null
  doctor_specialties:
    | { specialties: { name: string } | null; specialty_id: string }[]
    | null
}

type Specialty = { id: string; name: string; description: string | null }

type ScheduleSlot = {
  day_of_week: number
  start_time: string
  end_time: string
}

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]

export default function AdminDoctorsPage() {
  const [doctors, setDoctors] = React.useState<Doctor[]>([])
  const [specialties, setSpecialties] = React.useState<Specialty[]>([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState("")
  const [showForm, setShowForm] = React.useState(false)
  const [showSpecialtyForm, setShowSpecialtyForm] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [specError, setSpecError] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  // New doctor form
  const [fullName, setFullName] = React.useState("")
  const [username, setUsername] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [phone, setPhone] = React.useState("")
  const [selectedSpecialties, setSelectedSpecialties] = React.useState<
    string[]
  >([])

  // New specialty form
  const [specName, setSpecName] = React.useState("")
  const [specDesc, setSpecDesc] = React.useState("")

  // Edit doctor state
  const [editDoctor, setEditDoctor] = React.useState<Doctor | null>(null)
  const [editName, setEditName] = React.useState("")
  const [editPhone, setEditPhone] = React.useState("")
  const [editActive, setEditActive] = React.useState(true)
  const [editSpecialties, setEditSpecialties] = React.useState<string[]>([])
  const [editError, setEditError] = React.useState<string | null>(null)

  // Schedule modal state
  const [scheduleDoctor, setScheduleDoctor] = React.useState<Doctor | null>(
    null
  )
  const [schedule, setSchedule] = React.useState<ScheduleSlot[]>([])
  const [scheduleLoading, setScheduleLoading] = React.useState(false)
  const [openDropdown, setOpenDropdown] = React.useState<string | null>(null)

  const fetchAll = () => {
    setLoading(true)
    Promise.all([
      fetch("/api/admin/doctors").then((r) => r.json()),
      fetch("/api/admin/specialties").then((r) => r.json()),
    ]).then(([d, s]) => {
      setDoctors(d.doctors ?? [])
      setSpecialties(s.specialties ?? [])
      setLoading(false)
    })
  }

  React.useEffect(() => {
    fetchAll()
  }, [])

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = () => setOpenDropdown(null)
    if (openDropdown) {
      document.addEventListener("click", handleClickOutside)
      return () => document.removeEventListener("click", handleClickOutside)
    }
  }, [openDropdown])

  const createDoctor = async () => {
    if (!fullName || !username || !password) {
      setError("Full name, username, and password are required.")
      return
    }
    setSaving(true)
    setError(null)
    const res = await fetch("/api/admin/doctors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: fullName,
        email: username,
        password,
        phone: phone || null,
        specialty_ids: selectedSpecialties,
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? "Failed to create doctor")
      return
    }
    setShowForm(false)
    setFullName("")
    setUsername("")
    setPassword("")
    setPhone("")
    setSelectedSpecialties([])
    fetchAll()
  }

  const createSpecialty = async () => {
    if (!specName) {
      setSpecError("Specialty name is required.")
      return
    }
    setSaving(true)
    setSpecError(null)
    const res = await fetch("/api/admin/specialties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: specName, description: specDesc || null }),
    })
    setSaving(false)
    if (!res.ok) {
      const d = await res.json()
      setSpecError(d.error ?? "Failed to create specialty")
      return
    }
    setShowSpecialtyForm(false)
    setSpecName("")
    setSpecDesc("")
    fetchAll()
  }

  const deleteSpecialty = async (id: string) => {
    if (!confirm("Delete this specialty?")) return
    await fetch("/api/admin/specialties", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    fetchAll()
  }

  const closeSpecialtyDialog = () => {
    setShowSpecialtyForm(false)
    setSpecName("")
    setSpecDesc("")
    setSpecError(null)
  }

  const filtered = doctors.filter(
    (d) => !search || d.full_name.toLowerCase().includes(search.toLowerCase())
  )

  const handleCloseDialog = () => {
    setShowForm(false)
    setError(null)
  }

  const openEdit = (doctor: Doctor) => {
    setEditDoctor(doctor)
    setEditName(doctor.full_name)
    setEditPhone(doctor.phone ?? "")
    setEditActive(doctor.is_active)
    setEditSpecialties(
      doctor.doctor_specialties?.map((ds) => ds.specialty_id) ?? []
    )
    setEditError(null)
  }

  const openSchedule = async (doctor: Doctor) => {
    setScheduleDoctor(doctor)
    setScheduleLoading(true)
    try {
      const res = await fetch(`/api/doctors/${doctor.id}/availability`)
      const data = await res.json()
      setSchedule(data.schedule ?? [])
    } catch {
      setSchedule([])
    }
    setScheduleLoading(false)
  }

  const closeSchedule = () => {
    setScheduleDoctor(null)
    setSchedule([])
  }

  const closeEdit = () => {
    setEditDoctor(null)
    setEditError(null)
  }

  const saveEdit = async () => {
    if (!editDoctor) return
    setSaving(true)
    setEditError(null)
    const res = await fetch(`/api/admin/doctors/${editDoctor.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: editName,
        phone: editPhone || null,
        is_active: editActive,
        specialty_ids: editSpecialties,
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const d = await res.json()
      setEditError(d.error ?? "Failed to update doctor")
      return
    }
    closeEdit()
    fetchAll()
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Doctors</h1>
          <p className="text-sm text-muted-foreground">
            Manage doctors and their specialties.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSpecialtyForm(true)}
            className="gap-2"
          >
            <Plus className="h-4 w-4" /> Add specialty
          </Button>
          <Button size="sm" onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Add doctor
          </Button>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Specialty Dialog */}
      <Dialog
        open={showSpecialtyForm}
        onOpenChange={(open) => {
          if (!open) closeSpecialtyDialog()
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage specialties</DialogTitle>
            <DialogDescription>
              Add new specialties or remove existing ones.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-2">
            <Field
              label="Specialty name *"
              value={specName}
              onChange={setSpecName}
              placeholder="e.g. Cardiology"
            />
            <Field
              label="Description (optional)"
              value={specDesc}
              onChange={setSpecDesc}
              placeholder="Brief description of this specialty"
            />
            {specError && (
              <p className="text-xs text-destructive">{specError}</p>
            )}
          </div>

          {/* Existing specialties list */}
          {specialties.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Existing specialties
              </p>
              <div className="flex flex-wrap gap-2">
                {specialties.map((s) => (
                  <span
                    key={s.id}
                    className="flex items-center gap-1 rounded-full border bg-muted/30 px-3 py-1 text-xs"
                  >
                    {s.name}
                    <button
                      onClick={() => deleteSpecialty(s.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeSpecialtyDialog}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={createSpecialty} disabled={saving}>
              {saving ? "Creating…" : "Create specialty"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Doctor Dialog */}
      <Dialog
        open={!!editDoctor}
        onOpenChange={(open) => {
          if (!open) closeEdit()
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit doctor</DialogTitle>
            <DialogDescription>
              Update details and specialty assignments for{" "}
              {editDoctor?.full_name}.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-2 sm:grid-cols-2">
            <Field
              label="Full name"
              value={editName}
              onChange={setEditName}
              placeholder="Dr. Jane Doe"
            />
            <Field
              label="Phone"
              value={editPhone}
              onChange={setEditPhone}
              placeholder="+233..."
              type="tel"
            />
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between rounded-lg border px-4 py-3">
            <div>
              <p className="text-sm font-medium">Account active</p>
              <p className="text-xs text-muted-foreground">
                Inactive doctors cannot be booked
              </p>
            </div>
            <button
              onClick={() => setEditActive((v) => !v)}
              className={cn(
                "relative flex h-7 w-12 items-center rounded-full border-2 transition-colors duration-300",
                editActive
                  ? "border-green-500 bg-green-500"
                  : "border-muted-foreground bg-muted"
              )}
            >
              <span
                className={cn(
                  "absolute h-4 w-4 rounded-full bg-white shadow transition-transform duration-300",
                  editActive ? "translate-x-6" : "translate-x-1"
                )}
              />
            </button>
          </div>

          {/* Specialties */}
          <div>
            <p className="mb-2 text-sm font-medium">Specialties</p>
            <div className="flex flex-wrap gap-2">
              {specialties.map((s) => (
                <button
                  key={s.id}
                  onClick={() =>
                    setEditSpecialties((prev) =>
                      prev.includes(s.id)
                        ? prev.filter((id) => id !== s.id)
                        : [...prev, s.id]
                    )
                  }
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition-colors",
                    editSpecialties.includes(s.id)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:border-primary/40"
                  )}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>

          {editError && <p className="text-xs text-destructive">{editError}</p>}

          <DialogFooter>
            <Button variant="outline" onClick={closeEdit} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Dialog */}
      <Dialog
        open={!!scheduleDoctor}
        onOpenChange={(open) => {
          if (!open) closeSchedule()
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Availability Schedule</DialogTitle>
            <DialogDescription>
              {scheduleDoctor?.full_name}'s weekly availability
            </DialogDescription>
          </DialogHeader>

          {scheduleLoading ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          ) : schedule.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-sm text-muted-foreground">
                No schedule set or doctor is unavailable for booking.
              </p>
            </div>
          ) : (
            <div className="space-y-2 py-2">
              {DAY_NAMES.map((dayName, dayIndex) => {
                const daySlots = schedule.filter(
                  (s) => s.day_of_week === dayIndex
                )
                if (daySlots.length === 0) return null
                return (
                  <div
                    key={dayIndex}
                    className="flex items-center justify-between rounded-lg border px-3 py-2"
                  >
                    <span className="text-sm font-medium">{dayName}</span>
                    <div className="text-sm text-muted-foreground">
                      {daySlots.map((slot, i) => (
                        <span key={i}>
                          {formatTime(slot.start_time)} -{" "}
                          {formatTime(slot.end_time)}
                          {i < daySlots.length - 1 ? ", " : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeSchedule}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Doctor Dialog */}
      <Dialog open={showForm} onOpenChange={handleCloseDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add doctor</DialogTitle>
            <DialogDescription>
              Create a new doctor account and assign specialties.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-4 sm:grid-cols-2">
            <Field
              label="Full name"
              value={fullName}
              onChange={setFullName}
              placeholder="Dr. Jane Doe"
            />
            <Field
              label="Username (login)"
              value={username}
              onChange={setUsername}
              placeholder="dr.jane"
            />
            <Field
              label="Password"
              value={password}
              onChange={setPassword}
              placeholder="••••••••"
              type="password"
            />
            <Field
              label="Phone"
              value={phone}
              onChange={setPhone}
              placeholder="+233..."
              type="tel"
            />
          </div>

          <div className="py-2">
            <p className="mb-2 text-sm font-medium">Specialties</p>
            <div className="flex flex-wrap gap-2">
              {specialties.map((s) => (
                <button
                  key={s.id}
                  onClick={() =>
                    setSelectedSpecialties((prev) =>
                      prev.includes(s.id)
                        ? prev.filter((id) => id !== s.id)
                        : [...prev, s.id]
                    )
                  }
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition-colors",
                    selectedSpecialties.includes(s.id)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:border-primary/40"
                  )}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button onClick={createDoctor} disabled={saving}>
              {saving ? "Creating…" : "Create doctor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Search */}
      <div className="relative">
        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          placeholder="Search doctors…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border bg-background py-2 pr-4 pl-9 text-sm focus:ring-1 focus:ring-primary focus:outline-none"
        />
      </div>

      {loading ? (
        <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs font-medium text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3">Doctor</th>
                <th className="px-4 py-3">Specialties</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Availability</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton className="h-5 w-24" />
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-20" />
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton className="h-5 w-20" />
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton className="h-6 w-12" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border bg-background py-16 text-center">
          <Stethoscope className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No doctors found.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs font-medium text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3">Doctor</th>
                <th className="px-4 py-3">Specialties</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Availability</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((d) => (
                <tr key={d.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <p className="font-medium">{d.full_name}</p>
                    <p className="text-xs text-muted-foreground">{d.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {d.doctor_specialties &&
                      d.doctor_specialties.length > 0 ? (
                        d.doctor_specialties.map((ds, i) => (
                          <span
                            key={i}
                            className="rounded-full bg-muted px-2 py-0.5 text-xs"
                          >
                            {ds.specialties?.name}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          No specialties
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {d.phone ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        d.doctor_settings?.[0]?.is_available !== false
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      )}
                    >
                      {d.doctor_settings?.[0]?.is_available !== false
                        ? "Available"
                        : "Unavailable"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpenDropdown(openDropdown === d.id ? null : d.id)
                        }}
                        className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        Actions <ChevronDown className="h-3 w-3" />
                      </button>
                      {openDropdown === d.id && (
                        <div className="absolute top-full right-0 z-10 mt-1 w-40 rounded-lg border bg-background shadow-lg">
                          <button
                            onClick={() => {
                              openSchedule(d)
                              setOpenDropdown(null)
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted"
                          >
                            <Calendar className="h-3 w-3" /> View Schedule
                          </button>
                          <button
                            onClick={() => {
                              openEdit(d)
                              setOpenDropdown(null)
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted"
                          >
                            <Pencil className="h-3 w-3" /> Edit Details
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(":")
  const h = parseInt(hours, 10)
  const ampm = h >= 12 ? "PM" : "AM"
  const h12 = h % 12 || 12
  return `${h12}:${minutes} ${ampm}`
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-lg border bg-muted/40 px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:outline-none"
      />
    </div>
  )
}
