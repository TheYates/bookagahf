"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  CalendarDays,
  Clock,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { supabaseBrowserClient } from "@/lib/supabase/client"

const NAV = [
  { href: "/doctor", label: "Dashboard", icon: LayoutDashboard },
  { href: "/doctor/appointments", label: "Appointments", icon: CalendarDays },
  { href: "/doctor/availability", label: "Availability", icon: Clock },
  { href: "/doctor/notifications", label: "Notifications", icon: Bell },
  { href: "/doctor/settings", label: "Settings", icon: Settings },
]

export default function DoctorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = React.useState(false)
  const [unreadCount, setUnreadCount] = React.useState(0)
  const [doctorName, setDoctorName] = React.useState("")

  React.useEffect(() => {
    const fetchDoctorName = async () => {
      const {
        data: { user },
      } = await supabaseBrowserClient.auth.getUser()
      if (user) {
        const { data: profile } = await supabaseBrowserClient
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single()
        const fullName =
          profile?.full_name ?? user.user_metadata?.full_name ?? ""
        const firstWord = fullName.split(" ")[0]
        let nameToShow = firstWord.toLowerCase().startsWith("dr")
          ? fullName.split(" ")[1] || "Doctor"
          : firstWord
        if (!nameToShow.toLowerCase().startsWith("dr")) {
          nameToShow = `Dr. ${nameToShow}`
        }
        setDoctorName(nameToShow)
      }
    }
    void fetchDoctorName()
  }, [])

  React.useEffect(() => {
    const fetchUnreadCount = async () => {
      const {
        data: { user },
      } = await supabaseBrowserClient.auth.getUser()
      if (user) {
        const { count } = await supabaseBrowserClient
          .from("notifications")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("is_read", false)
        setUnreadCount(count ?? 0)
      }
    }

    fetchUnreadCount()

    // Subscribe to realtime changes
    const subscription = supabaseBrowserClient
      .channel("notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
        },
        () => {
          fetchUnreadCount()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const handleLogout = async () => {
    await supabaseBrowserClient.auth.signOut()
    router.push("/")
  }

  return (
    <div className="flex min-h-svh bg-muted/20">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r bg-background transition-transform duration-200",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          "lg:static lg:translate-x-0"
        )}
      >
        <div className="flex h-16 items-center gap-3 border-b px-4">
          <Image
            src="/agahflogo.svg"
            alt="AGAHF"
            width={32}
            height={32}
            className="block shrink-0 dark:hidden"
            priority
          />
          <Image
            src="/agahflogo-white.png"
            alt="AGAHF"
            width={32}
            height={32}
            className="hidden shrink-0 dark:block"
            priority
          />
          <div className="min-w-0">
            <p className="truncate text-xs text-muted-foreground">AGAHF</p>
            <p className="truncate text-sm leading-tight font-bold">
              {doctorName || "Doctor Portal"}
            </p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto shrink-0 lg:hidden"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                pathname === href
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1">{label}</span>
              {href === "/doctor/notifications" && unreadCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
          ))}
        </nav>

        <div className="border-t p-3">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center gap-4 border-b bg-background px-6">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden">
            <Menu className="h-5 w-5 text-muted-foreground" />
          </button>
          <span className="text-sm font-medium text-muted-foreground">
            Doctor Portal
          </span>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
