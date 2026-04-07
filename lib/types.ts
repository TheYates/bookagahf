export type UserRole = "client" | "doctor" | "admin"

export type AppointmentStatus =
  | "scheduled"
  | "rescheduled"
  | "cancelled"
  | "completed"
  | "review"

export type Appointment = {
  id: string
  patient_name: string
  x_number: string
  company_number: string | null
  dependent_name: string | null
  dependent_x_number: string | null
  contact_phone: string | null
  contact_email: string | null
  doctor_id: string
  specialty_id: string | null
  status: AppointmentStatus
  scheduled_at: string
  ends_at: string | null
  created_by: string | null
  notes: string | null
  created_at: string
}

export type DoctorAvailability = {
  id: string
  doctor_id: string
  day_of_week: number
  start_time: string
  end_time: string
  is_active: boolean
}

export type ClientCategory =
  | "private_cash"
  | "private_sponsored"
  | "nhis"
  | "corporate"
  | "other"

export type Profile = {
  id: string
  role: UserRole
  full_name: string | null
  x_number: string | null
  company_number: string | null
  phone: string | null
  email: string | null
  address: string | null
  category: ClientCategory | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  is_active: boolean
}

export type Specialty = {
  id: string
  name: string
  description: string | null
}
