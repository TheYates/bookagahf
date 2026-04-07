import "server-only"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { sendHubtelSms } from "./hubtel"
import { sendPushNotification } from "./webpush"
import { appointmentMessage } from "./messages"

type NotifyParams = {
  supabase: SupabaseClient
  appointmentId: string
  patientName: string
  doctorName: string
  scheduledAt: string
  status: string
  /** patient contact phone */
  contactPhone: string | null
  /** client user_id (owner of the appointment) */
  clientUserId: string | null
  /** doctor user_id */
  doctorUserId: string | null
}

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

async function getPushSubscriptions(userId: string) {
  const { data } = await adminClient
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId)
  return data ?? []
}

export async function notifyAppointmentEvent(params: NotifyParams) {
  const {
    supabase,
    appointmentId,
    patientName,
    doctorName,
    scheduledAt,
    status,
    contactPhone,
    clientUserId,
    doctorUserId,
  } = params

  const formattedDate = new Date(scheduledAt).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  })

  const { header, message } = appointmentMessage({
    patientName,
    doctorName,
    scheduledAt: formattedDate,
    status,
  })

  // ── Doctor message (different perspective) ───────────────────────────────
  const doctorMessage = `Patient ${patientName}'s appointment is ${status} for ${formattedDate}.`

  const notifications: Promise<any>[] = []

  // ── 1. Hubtel SMS to client ───────────────────────────────────────────────
  if (contactPhone) {
    notifications.push(
      sendHubtelSms({ to: contactPhone, content: message }).catch((err) =>
        console.error("[Hubtel SMS]", err),
      ),
    )
  }

  // ── 2. In-app notification for client ────────────────────────────────────
  if (clientUserId) {
    notifications.push(
      supabase.from("notifications").insert({
        user_id: clientUserId,
        appointment_id: appointmentId,
        channel: "in-app",
        title: header,
        message,
        is_read: false,
      }),
    )

    // ── 3. Web push for client ──────────────────────────────────────────────
    notifications.push(
      getPushSubscriptions(clientUserId).then((subs) =>
        Promise.allSettled(
          subs.map((sub) =>
            sendPushNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              { title: header, body: message, url: "/client" },
            ).catch((err) => console.error("[WebPush client]", err)),
          ),
        ),
      ),
    )
  }

  // ── 4. In-app notification for doctor ────────────────────────────────────
  if (doctorUserId) {
    notifications.push(
      supabase.from("notifications").insert({
        user_id: doctorUserId,
        appointment_id: appointmentId,
        channel: "in-app",
        title: `Appointment ${status}`,
        message: doctorMessage,
        is_read: false,
      }),
    )

    // ── 5. Web push for doctor ──────────────────────────────────────────────
    notifications.push(
      getPushSubscriptions(doctorUserId).then((subs) =>
        Promise.allSettled(
          subs.map((sub) =>
            sendPushNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              { title: `Appointment ${status}`, body: doctorMessage, url: "/doctor" },
            ).catch((err) => console.error("[WebPush doctor]", err)),
          ),
        ),
      ),
    )
  }

  await Promise.allSettled(notifications)
}
