"use client"

import * as React from "react"
import { Bell, BellOff, Loader2 } from "lucide-react"
import { usePushSubscription } from "@/lib/hooks/use-push-subscription"
import { Button } from "@/components/ui/button"

export function PushPrompt() {
  const { isSubscribed, isSupported, loading, error, subscribe, unsubscribe } =
    usePushSubscription()
  const [dismissed, setDismissed] = React.useState(false)

  if (!isSupported || isSubscribed || dismissed) return null

  return (
    <div className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-xl border bg-background p-4 shadow-lg">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Bell className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold">Enable notifications</p>
          <p className="text-xs text-muted-foreground">
            Get notified about appointment updates and reminders.
          </p>
          {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={subscribe} disabled={loading} className="gap-1">
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bell className="h-3 w-3" />}
              Enable
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>
              Not now
            </Button>
          </div>
        </div>
        <button onClick={() => setDismissed(true)} className="text-muted-foreground hover:text-foreground">
          <BellOff className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
