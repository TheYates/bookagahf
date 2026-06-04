"use client"

import * as React from "react"

export function ServiceWorkerRegister() {
  React.useEffect(() => {
    // In development, ensure no service worker controls the app to avoid
    // interfering with Next.js dev HMR/SSE which can cause periodic reloads.
    if (process.env.NODE_ENV !== "production") {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.getRegistrations().then((regs) => {
          regs.forEach((r) => r.unregister())
        })
        // If a controller is still present, reload once to fully detach it
        if (navigator.serviceWorker.controller && !sessionStorage.getItem("sw_cleared")) {
          sessionStorage.setItem("sw_cleared", "1")
          window.location.reload()
          return
        }
      }
      return
    }

    // Production-only registration
    if ("serviceWorker" in navigator) {
      const onLoad = () => {
        navigator.serviceWorker
          .register("/sw.js", { scope: "/" })
          .then((reg) => {
            console.log("[SW] Registered:", reg.scope)
            // Optional: listen for updates without forcing a reload
            if (reg.installing || reg.waiting) {
              const sw = reg.installing || reg.waiting
              sw?.addEventListener("statechange", () => {
                if (sw.state === "installed") {
                  console.log("[SW] New version installed (waiting to activate)")
                }
              })
            }
            reg.addEventListener?.("updatefound", () => {
              const newWorker = reg.installing
              newWorker?.addEventListener("statechange", () => {
                if (newWorker.state === "installed") {
                  console.log("[SW] Update available (will activate on next load)")
                }
              })
            })
          })
          .catch((err) => console.error("[SW] Registration failed:", err))
      }

      if (document.readyState === "complete") onLoad()
      else window.addEventListener("load", onLoad, { once: true })
    }
  }, [])

  return null
}
