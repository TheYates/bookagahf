interface LocalDepartment {
  id: string
  name: string
  description: string | null
  slots_per_day: number
  working_days: string[]
  working_hours: { start: string; end: string }
  is_active: boolean
}

export function isWorkingDayForAnyDepartment(
  departments: LocalDepartment[],
  date: Date
): boolean {
  if (departments.length === 0) return true // Default to working day if no departments

  const dayOfWeek = date.getDay()
  const dayNames = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ]

  return departments.some((dept) => {
    if (!dept.is_active) return false
    return dept.working_days?.includes(dayNames[dayOfWeek]) ?? false
  })
}

export function isValidBookingDate(
  date: Date,
  departmentId: string | undefined,
  departments: LocalDepartment[]
): boolean {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const checkDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  )

  // Can't book in the past
  if (checkDate < today) return false

  // Must be a working day
  if (!isWorkingDayForAnyDepartment(departments, date)) return false

  // If specific department, check its working days
  if (departmentId !== undefined) {
    const department = departments.find((d) => d.id === departmentId)
    if (department) {
      const dayOfWeek = date.getDay()
      const dayNames = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ]
      return department.working_days?.includes(dayNames[dayOfWeek]) ?? false
    }
  }

  return true
}
