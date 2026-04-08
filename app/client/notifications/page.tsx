"use client"

import * as React from "react"
import { Bell, CheckCheck, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { supabaseBrowserClient } from "@/lib/supabase/client"
import { useRealtimeTable } from "@/lib/hooks/use-realtime-table"

type Notification = {
  id: string
  title: string
  message: string
  is_read: boolean
  created_at: string
  channel: string
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = React.useState<Notification[]>([])
  const [loading, setLoading] = React.useState(true)

  const fetchNotifications = async () => {
    const { data: { user } } = await supabaseBrowserClient.auth.getUser()
    if (!user) return

    const { data } = await supabaseBrowserClient
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    setNotifications(data ?? [])
    setLoading(false)
  }

  useRealtimeTable({
    table: "notifications",
    onchange: () => void fetchNotifications(),
  })

  React.useEffect(() => {
    void fetchNotifications()
  }, [])

  const markAllRead = async () => {
    const { data: { user } } = await supabaseBrowserClient.auth.getUser()
    if (!user) return

    await supabaseBrowserClient
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false)

    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
  }

  const markRead = async (id: string) => {
    await supabaseBrowserClient
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id)

    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
    )
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead} className="gap-2">
            <CheckCheck className="h-4 w-4" /> Mark all read
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border bg-background py-16 text-center">
          <Bell className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No notifications yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => !n.is_read && markRead(n.id)}
              className={`rounded-xl border bg-background p-4 text-left shadow-sm transition-colors ${
                !n.is_read ? "border-primary/40 bg-primary/5" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{n.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{n.message}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(n.created_at).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
                {!n.is_read && (
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
