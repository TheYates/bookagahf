"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import {
  CalendarDays,
  PlusCircle,
  Bell,
  User,
  LogOut,
  LayoutDashboard,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { supabaseBrowserClient } from "@/lib/supabase/client"

const TABS = [
  { href: "/client", label: "Dashboard", icon: LayoutDashboard, exact: true },
  {
    href: "/client/appointments",
    label: "Appointments",
    icon: CalendarDays,
    exact: false,
  },
  { href: "/client/book", label: "Book", icon: PlusCircle, exact: false },
  {
    href: "/client/notifications",
    label: "Notifications",
    icon: Bell,
    exact: false,
  },
  { href: "/client/profile", label: "Profile", icon: User, exact: false },
]

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [unreadCount, setUnreadCount] = React.useState(0)
  const [clientName, setClientName] = React.useState("")

  React.useEffect(() => {
    const fetchClientName = async () => {
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
        const parts = fullName.split(" ")
        const nameToShow =
          parts.length >= 2
            ? `${parts[0]} ${parts[1].charAt(0)}.`
            : parts[0] || "Client"
        setClientName(nameToShow)
      }
    }
    void fetchClientName()
  }, [])

  React.useEffect(() => {
    const fetchUnreadCount = async () => {
      const {
        data: { user },
      } = await supabaseBrowserClient.auth.getUser()
      if (!user) return
      const { count } = await supabaseBrowserClient
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false)
      setUnreadCount(count ?? 0)
    }

    void fetchUnreadCount()

    const channel = supabaseBrowserClient
      .channel("client-layout-notifications")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        () => {
          void fetchUnreadCount()
        }
      )
      .subscribe()

    return () => {
      void supabaseBrowserClient.removeChannel(channel)
    }
  }, [])

  const handleLogout = async () => {
    await supabaseBrowserClient.auth.signOut()
    router.push("/")
  }

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname.startsWith(href)

  return (
    <div className="flex min-h-svh flex-col bg-muted/20">
      {/* ── Top nav ── */}
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-6">
            {/* Brand */}
            <Link href="/client" className="flex items-center gap-2.5">
              <Image
                src="/agahflogo.svg"
                alt="AGAHF"
                width={32}
                height={32}
                className="block dark:hidden"
                priority
              />
              <Image
                src="/agahflogo-white.png"
                alt="AGAHF"
                width={32}
                height={32}
                className="hidden dark:block"
                priority
              />
              <div className="hidden sm:block">
                <p className="text-xs leading-none text-muted-foreground">
                  AGAHF
                </p>
                <p className="text-sm leading-tight font-bold">
                  {clientName || "Client"}
                </p>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="ml-4 hidden items-center gap-6 md:flex">
              {TABS.map(({ href, label, exact }) => {
                const active = isActive(href, exact)
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "relative py-2 text-sm font-medium transition-colors hover:text-primary",
                      active ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    {label}
                    {active && (
                      <span className="absolute bottom-0 left-0 h-0.5 w-full rounded-t-full bg-primary" />
                    )}
                  </Link>
                )
              })}
            </nav>
          </div>

          {/* Right: bell + logout */}
          <div className="flex items-center gap-2">
            <Link
              href="/client/notifications"
              className="relative flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-background">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
            <div className="mx-1 hidden h-6 w-px bg-border md:block" />
            <button
              onClick={handleLogout}
              title="Sign out"
              className="group flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="h-5 w-5 transition-transform group-hover:-translate-x-0.5" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Page content ── */}
      <main className="flex-1 pb-20 md:pb-8">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 md:py-8">
          {children}
        </div>
      </main>

      {/* ── Bottom tab bar (Mobile Only) ── */}
      <nav className="pb-safe fixed right-0 bottom-0 left-0 z-30 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
        <div className="flex h-16 items-center justify-around px-2">
          {TABS.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(href, exact)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "relative flex flex-1 flex-col items-center justify-center gap-1 rounded-lg py-2 text-xs font-medium transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <div className="relative">
                  <Icon
                    className={cn(
                      "h-5 w-5 transition-transform",
                      active && "scale-110"
                    )}
                  />
                  {href === "/client/notifications" && unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white ring-2 ring-background">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </div>
                <span className="text-[10px]">{label}</span>
                {active && (
                  <span className="absolute bottom-0 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-primary" />
                )}
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
