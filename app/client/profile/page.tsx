"use client"

import * as React from "react"
import {
  User,
  Phone,
  Mail,
  MapPin,
  Building2,
  Hash,
  AlertCircle,
  CalendarDays,
  ShieldAlert,
} from "lucide-react"
import { supabaseBrowserClient } from "@/lib/supabase/client"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

type Profile = {
  full_name: string | null
  email: string | null
  phone: string | null
  x_number: string | null
  company_number: string | null
  address: string | null
  category: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  is_active: boolean
  created_at: string
  role: string
}

const CATEGORY_LABELS: Record<string, string> = {
  private_cash: "Private Cash",
  private_sponsored: "Private Sponsored",
  nhis: "NHIS",
  corporate: "Corporate",
  other: "Other",
}

function InfoBlock({
  icon: Icon,
  label,
  value,
  mono = false,
}: {
  icon: React.ElementType
  label: string
  value: string | null | undefined
  mono?: boolean
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-muted/30 p-4 border border-transparent transition-colors hover:border-border">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      </div>
      <p className={cn("text-base font-semibold text-foreground", mono && "font-mono tracking-tight", !value && "text-muted-foreground italic font-normal text-sm")}>
        {value || "Not provided"}
      </p>
    </div>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card p-6 shadow-sm">
      <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
        {title}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {children}
      </div>
    </div>
  )
}

export default function ClientProfilePage() {
  const [profile, setProfile] = React.useState<Profile | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabaseBrowserClient.auth.getUser()
      if (!user) return

      const { data } = await supabaseBrowserClient
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()

      setProfile(data)
      setLoading(false)
    }
    void load()
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col gap-6 w-full">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <div className="grid md:grid-cols-2 gap-6">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border bg-muted/10 py-24 text-center">
        <div className="rounded-full bg-muted p-4">
          <AlertCircle className="h-8 w-8 text-muted-foreground" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Profile not found</h3>
          <p className="text-sm text-muted-foreground mt-1">We couldn't load your profile details.</p>
        </div>
      </div>
    )
  }

  const isCorporate = !!profile.company_number

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Header Banner - Solid Colors, No Gradients */}
      <div className="relative overflow-hidden rounded-2xl  px-6 py-10 sm:px-10 flex flex-col sm:flex-row items-center sm:items-start gap-6 border shadow-sm">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm">
          <User className="h-10 w-10 text-slate-800" />
        </div>
        
        <div className="flex-1 text-center sm:text-left text-white mt-2 sm:mt-0">
          <h1 className="text-3xl font-bold tracking-tight">{profile.full_name ?? "My Profile"}</h1>
          
          <div className="mt-4 flex flex-wrap items-center justify-center sm:justify-start gap-3">
            <span className={cn(
              "rounded-md px-2.5 py-1 text-xs font-semibold uppercase tracking-wider",
              profile.is_active ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300",
            )}>
              {profile.is_active ? "Active Status" : "Inactive"}
            </span>
            
            {profile.category && (
              <span className="rounded-md bg-white/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-slate-300 backdrop-blur-sm">
                {CATEGORY_LABELS[profile.category] ?? profile.category}
              </span>
            )}
            
            {isCorporate && (
              <span className="rounded-md bg-blue-500/20 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-blue-300">
                Corporate Employee
              </span>
            )}
          </div>
        </div>

        {/* Member Since block on the right for desktop */}
        <div className="hidden md:flex flex-col items-end text-slate-300 mt-2">
          <p className="text-xs font-medium uppercase tracking-wider opacity-70 mb-1">Member Since</p>
          <p className="text-sm font-semibold bg-white/10 px-3 py-1.5 rounded-lg border border-white/5 backdrop-blur-sm">
            {new Date(profile.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Left Column: Identity & Access */}
        <div className="flex flex-col gap-6">
          <SectionCard title="Identity Records">
            <InfoBlock icon={Hash} label="X-Number" value={profile.x_number} mono />
            {isCorporate && (
              <InfoBlock icon={Building2} label="Company Num" value={profile.company_number} mono />
            )}
            <InfoBlock
              icon={CalendarDays}
              label="Registration Date"
              value={new Date(profile.created_at).toLocaleDateString(undefined, { dateStyle: "long" })}
            />
          </SectionCard>

          <SectionCard title="Emergency Contact">
            <div className="col-span-1 sm:col-span-2 bg-rose-50 border border-rose-100 rounded-xl p-4 flex items-start gap-4">
              <div className="bg-rose-100 text-rose-600 p-2 rounded-lg shrink-0">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div className="w-full">
                <p className="text-sm font-semibold text-rose-900 mb-3">Primary Contact</p>
                <div className="grid gap-3 sm:grid-cols-2 w-full">
                  <div>
                    <p className="text-xs text-rose-700/70 uppercase tracking-wider font-medium mb-1">Name</p>
                    <p className="text-sm font-medium text-rose-900">{profile.emergency_contact_name || "Not provided"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-rose-700/70 uppercase tracking-wider font-medium mb-1">Phone</p>
                    <p className="text-sm font-medium text-rose-900">{profile.emergency_contact_phone || "Not provided"}</p>
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Right Column: Contact info */}
        <div className="flex flex-col gap-6">
          <SectionCard title="Contact Details">
            <div className="sm:col-span-2">
              <InfoBlock icon={Phone} label="Primary Phone" value={profile.phone} />
            </div>
            <div className="sm:col-span-2">
              <InfoBlock 
                icon={Mail} 
                label="Email Address" 
                value={profile.email?.endsWith("@client.medbook.internal") ? null : profile.email} 
              />
            </div>
            <div className="sm:col-span-2">
              <InfoBlock icon={MapPin} label="Residential Address" value={profile.address} />
            </div>
          </SectionCard>
          
          <div className="rounded-2xl border border-dashed bg-muted/20 p-6 text-center shadow-sm">
            <div className="mx-auto bg-muted w-12 h-12 rounded-full flex items-center justify-center mb-3">
              <AlertCircle className="h-5 w-5 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">Need to update your details?</h3>
            <p className="text-sm text-muted-foreground max-w-[250px] mx-auto">
              For security reasons, please contact the hospital reception to modify your profile information.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
