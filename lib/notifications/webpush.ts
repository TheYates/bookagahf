import webpush from "web-push"

const publicKey = process.env.WEB_PUSH_PUBLIC_KEY
const privateKey = process.env.WEB_PUSH_PRIVATE_KEY
const subject = process.env.WEB_PUSH_SUBJECT || "mailto:admin@example.com"

if (publicKey && privateKey) {
  webpush.setVapidDetails(subject, publicKey, privateKey)
}

export function getVapidPublicKey() {
  return publicKey
}

export async function sendPushNotification(
  subscription: webpush.PushSubscription,
  payload: Record<string, unknown>,
) {
  if (!publicKey || !privateKey) {
    throw new Error("Missing VAPID keys")
  }

  return webpush.sendNotification(subscription, JSON.stringify(payload))
}
