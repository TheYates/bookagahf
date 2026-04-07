export function appointmentMessage({
  patientName,
  doctorName,
  scheduledAt,
  status,
}: {
  patientName: string
  doctorName: string
  scheduledAt: string
  status: string
}) {
  const header = `Appointment ${status}`
  const message = `${patientName}, your appointment with ${doctorName} is ${status} for ${scheduledAt}.`

  return { header, message }
}
