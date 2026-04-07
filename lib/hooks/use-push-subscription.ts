"use client"

import * as React from "react"

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

export function usePushSubscription() {
  const [isSubscribed, setIsSubscribed] = React.useState(false)
  const [isSupported, setIsSupported] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    setIsSupported("serviceWorker" in navigator && "PushManager" in window)
  }, [])

  const subscribe = React.useCallback(async () => {
    if (!isSupported) return
    setLoading(true)
    setError(null)

    try {
      const reg = await navigator.serviceWorker.ready

      // Get VAPID public key
      const keyRes = await fetch("/api/push")
      const { publicKey } = await keyRes.json()

      if (!publicKey) throw new Error("Push not configured on server.")

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })

      const subJson = sub.toJSON()

      // Save subscription to DB
      await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          p256dh: subJson.keys?.p256dh,
          auth: subJson.keys?.auth,
        }),
      })

      setIsSubscribed(true)
    } catch (err: any) {
      setError(err?.message ?? "Failed to subscribe to push notifications")
    } finally {
      setLoading(false)
    }
  }, [isSupported])

  const unsubscribe = React.useCallback(async () => {
    if (!isSupported) return
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) await sub.unsubscribe()
      setIsSubscribed(false)
    } finally {
      setLoading(false)
    }
  }, [isSupported])

  // Check current subscription status
  React.useEffect(() => {
    if (!isSupported) return
    navigator.serviceWorker.ready.then((reg) =>
      reg.pushManager.getSubscription().then((sub) => setIsSubscribed(!!sub)),
    )
  }, [isSupported])

  return { isSubscribed, isSupported, loading, error, subscribe, unsubscribe }
}
