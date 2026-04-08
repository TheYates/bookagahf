"use client"

import * as React from "react"
import { supabaseBrowserClient } from "@/lib/supabase/client"

type RealtimeEvent = "INSERT" | "UPDATE" | "DELETE" | "*"

interface UseRealtimeTableOptions {
  table: string
  event?: RealtimeEvent
  /** Optional filter e.g. "user_id=eq.abc123" */
  filter?: string
  onchange: (payload?: any) => void
  /** Channel name — defaults to realtime-{table} */
  channel?: string
}

/**
 * Subscribes to Supabase Realtime changes on a table.
 * Calls `onchange` whenever the specified event occurs.
 * Automatically cleans up on unmount.
 */
export function useRealtimeTable({
  table,
  event = "*",
  filter,
  onchange,
  channel: channelName,
}: UseRealtimeTableOptions) {
  const [connected, setConnected] = React.useState(false)
  const onchangeRef = React.useRef(onchange)

  // Keep the callback ref up to date without re-subscribing
  React.useEffect(() => {
    onchangeRef.current = onchange
  }, [onchange])

  React.useEffect(() => {
    const name = channelName ?? `realtime-${table}-${Math.random().toString(36).slice(2)}`

    const config: any = {
      event,
      schema: "public",
      table,
    }
    if (filter) config.filter = filter

    const channel = supabaseBrowserClient
      .channel(name)
      .on("postgres_changes", config, (payload) => {
        onchangeRef.current(payload)
      })
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED")
      })

    return () => {
      void supabaseBrowserClient.removeChannel(channel)
      setConnected(false)
    }
  }, [table, event, filter, channelName])

  return { connected }
}
