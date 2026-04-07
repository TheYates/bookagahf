"use client"

import * as React from "react"
import { Search, Users, Plus, Upload, FileText, CheckCircle, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

type Client = {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  x_number: string | null
  company_number: string | null
  is_active: boolean
  created_at: string
}

type DialogTab = "manual" | "import"

type ImportResult = { name: string; status: string; error?: string }

const CATEGORIES = [
  { value: "private_cash", label: "Private Cash" },
  { value: "private_sponsored", label: "Private Sponsored" },
  { value: "nhis", label: "NHIS" },
  { value: "corporate", label: "Corporate" },
  { value: "other", label: "Other" },
]

const CSV_TEMPLATE = `full_name,phone,x_number,company_number,email,address,category,emergency_contact_name,emergency_contact_phone
Jane Doe,+233241000001,X12345/26,,jane@example.com,14 Labone Crescent Accra,private_cash,John Doe,+233241000002
Kofi Mensah,+233241000003,,300456,kofi@corp.com,7 Ring Road Accra,private_sponsored,Ama Mensah,+233241000004`

export default function AdminClientsPage() {
  const [clients, setClients] = React.useState<Client[]>([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState("")
  const [showDialog, setShowDialog] = React.useState(false)
  const [tab, setTab] = React.useState<DialogTab>("manual")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Manual form fields
  const [fullName, setFullName] = React.useState("")
  const [phone, setPhone] = React.useState("")
  const [xNumber, setXNumber] = React.useState("")
  const [companyNumber, setCompanyNumber] = React.useState("")
  const [clientEmail, setClientEmail] = React.useState("")
  const [address, setAddress] = React.useState("")
  const [category, setCategory] = React.useState("private_cash")
  const [emergencyName, setEmergencyName] = React.useState("")
  const [emergencyPhone, setEmergencyPhone] = React.useState("")

  // CSV import state
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [csvFile, setCsvFile] = React.useState<File | null>(null)
  const [importPreview, setImportPreview] = React.useState<any[]>([])
  const [importResults, setImportResults] = React.useState<ImportResult[] | null>(null)

  const fetchClients = () => {
    setLoading(true)
    void fetch("/api/admin/clients")
      .then((r) => r.json())
      .then((d) => setClients(d.clients ?? []))
      .finally(() => setLoading(false))
  }

  React.useEffect(() => { fetchClients() }, [])

  const handleXNumberChange = (val: string) => {
    let v = val
    if (/^[xX]/.test(v)) {
      v = "X" + v.slice(1)
      const digits = v.slice(1).replace(/\D/g, "")
      v = digits.length <= 5 ? "X" + digits : "X" + digits.slice(0, 5) + "/" + digits.slice(5, 7)
    }
    setXNumber(v)
  }

  const closeDialog = () => {
    setShowDialog(false)
    setTab("manual")
    setError(null)
    setFullName(""); setPhone(""); setXNumber(""); setCompanyNumber("")
    setClientEmail(""); setAddress(""); setCategory("private_cash")
    setEmergencyName(""); setEmergencyPhone("")
    setCsvFile(null); setImportPreview([]); setImportResults(null)
  }

  const createClient = async () => {
    setError(null)
    if (!fullName || !phone) { setError("Full name and phone are required."); return }
    if (!xNumber && !companyNumber) { setError("Either X-number or company number is required."); return }

    setSaving(true)
    const res = await fetch("/api/admin/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: fullName, phone,
        x_number: xNumber || null,
        company_number: companyNumber || null,
        email: clientEmail || null,
        address: address || null,
        category: companyNumber ? "private_sponsored" : category,
        emergency_contact_name: emergencyName || null,
        emergency_contact_phone: emergencyPhone || null,
      }),
    })
    setSaving(false)
    if (!res.ok) { const d = await res.json(); setError(d.error ?? "Failed to create client"); return }
    closeDialog(); fetchClients()
  }

  // ── CSV parsing ─────────────────────────────────────────────────────────────
  const parseCsv = (text: string) => {
    const lines = text.trim().split(/\r?\n/)
    if (lines.length < 2) return []
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase())
    return lines.slice(1).map((line) => {
      const values = line.split(",").map((v) => v.trim())
      return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]))
    })
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCsvFile(file)
    setImportResults(null)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      setImportPreview(parseCsv(text))
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    if (!importPreview.length) { setError("No data to import."); return }
    setSaving(true)
    setError(null)
    const res = await fetch("/api/admin/clients/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clients: importPreview }),
    })
    setSaving(false)
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? "Import failed"); return }
    setImportResults(data.results)
    fetchClients()
  }

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = "agahf_clients_template.csv"; a.click()
    URL.revokeObjectURL(url)
  }

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase()
    return !q || c.full_name?.toLowerCase().includes(q) || c.x_number?.toLowerCase().includes(q) || c.company_number?.includes(q) || c.phone?.includes(q)
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-sm text-muted-foreground">Manage registered clients and corporate employees.</p>
        </div>
        <Button size="sm" onClick={() => setShowDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Add client
        </Button>
      </div>

      {/* Add / Import client dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => { if (!open) closeDialog() }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add client</DialogTitle>
            <DialogDescription>Register a new client manually or import from a CSV file.</DialogDescription>
          </DialogHeader>

          {/* Tabs */}
          <div className="flex gap-1 rounded-lg border bg-muted/30 p-1">
            {(["manual", "import"] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(null) }}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  tab === t ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t === "manual" ? <><FileText className="h-4 w-4" />Manual</> : <><Upload className="h-4 w-4" />Import CSV</>}
              </button>
            ))}
          </div>

          {/* Manual form */}
          {tab === "manual" && (
            <div className="grid gap-3 py-2 sm:grid-cols-2">
              <Field label="Full name *" value={fullName} onChange={setFullName} placeholder="Jane Doe" />
              <Field label="Phone number *" value={phone} onChange={setPhone} placeholder="+233..." type="tel" />
              <Field label="Email address" value={clientEmail} onChange={setClientEmail} placeholder="jane@example.com" type="email" />
              <Field label="X-number" value={xNumber} onChange={handleXNumberChange} placeholder="X12345/26" />
              <Field label="Company number" value={companyNumber} onChange={setCompanyNumber} placeholder="300456" />

              {/* Category */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Category{companyNumber ? " (auto: Private Sponsored)" : ""}
                </label>
                <select
                  value={companyNumber ? "private_sponsored" : category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={!!companyNumber}
                  className="rounded-lg border bg-muted/40 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              <Field label="Address" value={address} onChange={setAddress} placeholder="14 Labone Crescent, Accra" className="sm:col-span-2" />
              <Field label="Emergency contact name" value={emergencyName} onChange={setEmergencyName} placeholder="John Doe" />
              <Field label="Emergency contact phone" value={emergencyPhone} onChange={setEmergencyPhone} placeholder="+233..." type="tel" />

              <p className="text-xs text-muted-foreground sm:col-span-2">
                * Required. At least one of X-number or company number is required.
              </p>
              {error && <p className="text-xs text-destructive sm:col-span-2">{error}</p>}
            </div>
          )}

          {/* CSV Import */}
          {tab === "import" && (
            <div className="flex flex-col gap-4 py-2">
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2">
                  <FileText className="h-4 w-4" /> Download template
                </Button>
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-2">
                  <Upload className="h-4 w-4" /> {csvFile ? csvFile.name : "Choose CSV file"}
                </Button>
                <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
              </div>

              {/* Preview */}
              {importPreview.length > 0 && !importResults && (
                <div className="rounded-lg border">
                  <div className="border-b bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground">
                    Preview — {importPreview.length} row{importPreview.length !== 1 ? "s" : ""} detected
                  </div>
                  <div className="max-h-48 overflow-auto">
                    <table className="w-full text-xs">
                      <thead className="border-b bg-muted/10">
                        <tr>
                          {["full_name", "phone", "x_number", "company_number", "category"].map((h) => (
                            <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {importPreview.map((row, i) => (
                          <tr key={i} className="hover:bg-muted/20">
                            <td className="px-3 py-1.5">{row.full_name || "—"}</td>
                            <td className="px-3 py-1.5">{row.phone || "—"}</td>
                            <td className="px-3 py-1.5">{row.x_number || "—"}</td>
                            <td className="px-3 py-1.5">{row.company_number || "—"}</td>
                            <td className="px-3 py-1.5">{row.category || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Import results */}
              {importResults && (
                <div className="rounded-lg border">
                  <div className="border-b bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground">
                    Import results
                  </div>
                  <div className="max-h-48 overflow-auto divide-y">
                    {importResults.map((r, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-2 text-xs">
                        <span>{r.name}</span>
                        <span className={cn(
                          "flex items-center gap-1",
                          r.status === "created" ? "text-green-600" : r.status === "failed" ? "text-destructive" : "text-muted-foreground"
                        )}>
                          {r.status === "created" ? <CheckCircle className="h-3 w-3" /> : r.status === "failed" ? <XCircle className="h-3 w-3" /> : null}
                          {r.status}{r.error ? `: ${r.error}` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                CSV must have columns: <code className="rounded bg-muted px-1">full_name, phone, x_number, company_number</code> (at minimum). Download the template for the full format.
              </p>
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={saving}>
              {importResults ? "Close" : "Cancel"}
            </Button>
            {tab === "manual" && (
              <Button onClick={createClient} disabled={saving}>
                {saving ? "Creating…" : "Create client"}
              </Button>
            )}
            {tab === "import" && !importResults && (
              <Button onClick={handleImport} disabled={saving || importPreview.length === 0}>
                {saving ? "Importing…" : `Import ${importPreview.length} client${importPreview.length !== 1 ? "s" : ""}`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          placeholder="Search by name, X-number, company number, phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border bg-background py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {loading ? (
        <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs font-medium uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">X-Number</th>
                <th className="px-4 py-3">Company No.</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[...Array(8)].map((_, i) => (
                <tr key={i}>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-5 w-14 rounded-full" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border bg-background py-16 text-center">
          <Users className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No clients found.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs font-medium uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">X-Number</th>
                <th className="px-4 py-3">Company No.</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{c.full_name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.x_number ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.company_number ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      c.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    )}>
                      {c.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Field({
  label, value, onChange, placeholder, type = "text", className,
}: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; type?: string; className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-lg border bg-muted/40 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  )
}
