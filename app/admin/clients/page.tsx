"use client"

import * as React from "react"
import { Search, Users, Plus, Upload, FileText, CheckCircle, XCircle, Loader2, AlertCircle, Trash2, ChevronLeft, ChevronRight, Columns } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  date_joined: string | null
  category: string | null
  sex: string | null
}

type DialogTab = "manual" | "import"

type ImportStatus = "idle" | "parsing" | "sheets" | "preview" | "importing" | "done"

type ImportResult = { name: string; status: string; error?: string; reason?: string }

const KNOWN_COLUMNS = new Set([
  "full_name", "phone", "x_number", "company_number", "email",
  "address", "category", "emergency_contact_name", "emergency_contact_phone",
  "sex", "date_of_birth", "date_joined",
])

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]
const BATCH_SIZE_OPTIONS = [10, 25, 50, 100, 200, 500, 1000]

const CATEGORIES = [
  { value: "private_cash", label: "Private Cash" },
  { value: "private_sponsored", label: "Private Sponsored" },
  { value: "private_dependent", label: "Private Dependent" },
  { value: "junior_staff_dependent", label: "Junior Staff Dependent" },
  { value: "senior_staff_dependent", label: "Senior Staff Dependent" },
  { value: "nhis", label: "NHIS" },
  { value: "corporate", label: "Corporate" },
  { value: "other", label: "Other" },
]

const CSV_TEMPLATE = `Date,OPD #,Name,Sex,DOB,Category,Cell Phone #
,OPD/12345/26,Jane Doe,Female,1990-01-15,Private Cash,0241000001
,OPD/12345/27,Kofi Mensah,Male,1985-08-22,Private Sponsored,0241000002`

export default function AdminClientsPage() {
  const [clients, setClients] = React.useState<Client[]>([])
  const [total, setTotal] = React.useState(0)
  const [page, setPage] = React.useState(1)
  const [listPageSize, setListPageSize] = React.useState(25)
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState("")
  const [debouncedSearch, setDebouncedSearch] = React.useState("")
  const [regexMode, setRegexMode] = React.useState(false)
  const [sortBy, setSortBy] = React.useState("x_number")
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("asc")
  const [filterCategory, setFilterCategory] = React.useState("")
  const [filterActive, setFilterActive] = React.useState("")
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
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

  // ── Import state machine ──────────────────────────────────────────────────────
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [importStatus, setImportStatus] = React.useState<ImportStatus>("idle")
  const [file, setFile] = React.useState<File | null>(null)
  const [parseError, setParseError] = React.useState<string | null>(null)

  // Raw parsed data (all rows from all selected sheets)
  const [allRows, setAllRows] = React.useState<any[]>([])

  // Multi-sheet state
  const [sheetNames, setSheetNames] = React.useState<string[]>([])
  const [selectedSheets, setSelectedSheets] = React.useState<string[]>([])
  const [workbookBuffer, setWorkbookBuffer] = React.useState<ArrayBuffer | null>(null)

  // Preview pagination
  const [pageSize, setPageSize] = React.useState(25)
  const [pageIndex, setPageIndex] = React.useState(0)

  // Row selection (stores indices into `allRows` that are deselected)
  const [deselectedRows, setDeselectedRows] = React.useState<Set<number>>(new Set())

  // Chunked import
  const [batchSize, setBatchSize] = React.useState(200)
  const [batchProgress, setBatchProgress] = React.useState<{ current: number; total: number } | null>(null)
  const [batchResults, setBatchResults] = React.useState<ImportResult[]>([])

  // Live tally during import
  const [importTally, setImportTally] = React.useState({ created: 0, skipped: 0, failed: 0 })
  const [liveLog, setLiveLog] = React.useState<ImportResult[]>([])

  // ── Sort / Selection helpers ──────────────────────────────────────────────────
  const handleSort = (col: string) => {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortBy(col)
      setSortDir("asc")
    }
    setPage(1)
    setSelectedIds(new Set())
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === clients.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(clients.map((c) => c.id)))
    }
  }

  const resetFilters = () => {
    setSearch("")
    setDebouncedSearch("")
    setFilterCategory("")
    setFilterActive("")
    setSortBy("x_number")
    setSortDir("asc")
    setPage(1)
    setSelectedIds(new Set())
  }

  const sortIcon = (col: string) => {
    if (sortBy !== col) return null
    return sortDir === "asc" ? " ▲" : " ▼"
  }

  // ── Computed values ───────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(allRows.length / pageSize))
  const pageRows = allRows.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize)
  const selectedCount = allRows.length - deselectedRows.size

  const allColumns = allRows.length > 0 ? Object.keys(allRows[0]) : []
  const recognizedColumns = allColumns.filter((c) => KNOWN_COLUMNS.has(c))
  const unrecognizedColumns = allColumns.filter((c) => !KNOWN_COLUMNS.has(c))

  // Preferred column display order for the preview table
  const COLUMN_DISPLAY_ORDER = [
    "full_name", "phone", "x_number", "company_number", "category",
    "sex", "date_of_birth", "date_joined", "email", "address",
    "emergency_contact_name", "emergency_contact_phone",
  ]
  const previewColumns = recognizedColumns.length > 0
    ? COLUMN_DISPLAY_ORDER.filter((c) => recognizedColumns.includes(c))
    : ["full_name", "phone", "x_number", "company_number", "category"]

  const fetchClients = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set("search", debouncedSearch)
      if (regexMode) params.set("regex", "true")
      params.set("sort_by", sortBy)
      params.set("sort_dir", sortDir)
      if (filterCategory) params.set("category", filterCategory)
      if (filterActive) params.set("is_active", filterActive)
      params.set("page", String(page))
      params.set("pageSize", String(listPageSize))
      const res = await fetch(`/api/admin/clients?${params}`)
      const d = await res.json()
      setClients(d.clients ?? [])
      setTotal(d.total ?? 0)
    } finally {
      setLoading(false)
    }
  }

  // Debounce search
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  // Fetch clients when any filter/pagination state changes
  React.useEffect(() => {
    fetchClients()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, regexMode, page, listPageSize, sortBy, sortDir, filterCategory, filterActive])

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
    resetImport()
  }

  const createClient = async () => {
    setError(null)
    if (!fullName) { setError("Full name is required."); return }
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

  // ── CSV / Excel parsing ──────────────────────────────────────────────────────
  const parseCsv = (text: string) => {
    const lines = text.trim().split(/\r?\n/)
    if (lines.length < 2) return []
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase())
    return lines.slice(1).map((line) => {
      const values = line.split(",").map((v) => v.trim())
      return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]))
    })
  }

  const parseExcelSheets = async (buffer: ArrayBuffer, sheets: string[]) => {
    const XLSX = await import("xlsx")
    const workbook = XLSX.read(buffer, { type: "array" })
    const result: any[] = []
    for (const name of sheets) {
      const sheet = workbook.Sheets[name]
      if (!sheet) continue
      const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet)
      for (const row of rows) {
        const normalized: Record<string, string> = {}
        for (const key of Object.keys(row)) {
          normalized[key.toLowerCase()] = String(row[key] ?? "")
        }
        result.push(normalized)
      }
    }
    return result
  }

  // ── Column & value normalization ─────────────────────────────────────────────
  const COLUMN_MAP: Record<string, string> = {
    "name": "full_name",
    "opd #": "x_number",
    "cell phone #": "phone",
    "phone": "phone",
    "phone number": "phone",
    "mobile": "phone",
    "mobile number": "phone",
    "cell": "phone",
    "cellphone": "phone",
    "telephone": "phone",
    "contact": "phone",
    "contact number": "phone",
    "dob": "date_of_birth",
    "sex": "sex",
    "date": "date_joined",
  }

  const CATEGORY_MAP: Record<string, string> = {
    "private cash": "private_cash",
    "private sponsored": "private_sponsored",
    "private dependent": "private_dependent",
    "junior staff dependent": "junior_staff_dependent",
    "senior staff dependent": "senior_staff_dependent",
    "public dependent(nhia)": "nhis",
    "nhis": "nhis",
    "corporate": "corporate",
    "other": "other",
  }

  const normalizePhone = (raw: string): string => {
    const digits = raw.replace(/\D/g, "")
    if (!digits) return ""
    if (digits.startsWith("233")) return `+${digits}`
    return `+233${digits.replace(/^0+/, "")}`
  }

  const normalizeRows = (rows: any[]): any[] =>
    rows.map((row) => {
      const result: Record<string, string> = {}
      for (let [key, value] of Object.entries<string>(row)) {
        // Map column name
        key = COLUMN_MAP[key] ?? key

        // Normalize: trim whitespace
        value = value.trim()

        // Normalize category value
        if (key === "category") {
          value = CATEGORY_MAP[value.toLowerCase()] ?? value
        }

        // Normalize phone number
        if (key === "phone") {
          value = normalizePhone(value)
        }

        result[key] = value
      }
      return result
    })

  // ── File selection & parsing ──────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    // Reset all import state
    setFile(selectedFile)
    setAllRows([])
    setDeselectedRows(new Set())
    setPageIndex(0)
    setBatchResults([])
    setBatchProgress(null)
    setImportTally({ created: 0, skipped: 0, failed: 0 })
    setLiveLog([])
    setParseError(null)
    setImportStatus("parsing")

    const isExcel = /\.(xlsx|xls|ods)$/i.test(selectedFile.name)

    if (isExcel) {
      const reader = new FileReader()
      reader.onload = async (ev) => {
        try {
          const buffer = ev.target?.result as ArrayBuffer
          const XLSX = await import("xlsx")
          const workbook = XLSX.read(buffer, { type: "array" })

          if (workbook.SheetNames.length > 1) {
            // Multiple sheets — show sheet picker
            setWorkbookBuffer(buffer)
            setSheetNames(workbook.SheetNames)
            setSelectedSheets([workbook.SheetNames[0]])
            setImportStatus("sheets")
          } else {
            // Single sheet — parse directly
            const rows = await parseExcelSheets(buffer, workbook.SheetNames)
            if (rows.length === 0) {
              setParseError("No data found in the file.")
              setImportStatus("idle")
              return
            }
            setAllRows(normalizeRows(rows))
            setImportStatus("preview")
          }
        } catch {
          setParseError("Failed to parse Excel file. Check the format and try again.")
          setImportStatus("idle")
        }
      }
      reader.readAsArrayBuffer(selectedFile)
    } else {
      const reader = new FileReader()
      reader.onload = (ev) => {
        try {
          const text = ev.target?.result as string
          const rows = parseCsv(text)
          if (rows.length === 0) {
            setParseError("No data found in the file.")
            setImportStatus("idle")
            return
          }
          setAllRows(normalizeRows(rows))
          setImportStatus("preview")
        } catch {
          setParseError("Failed to parse the CSV file.")
          setImportStatus("idle")
        }
      }
      reader.readAsText(selectedFile)
    }
  }

  // ── Sheet selection ───────────────────────────────────────────────────────────
  const toggleSheet = (name: string) => {
    setSelectedSheets((prev) =>
      prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name],
    )
  }

  const toggleAllSheets = () => {
    if (selectedSheets.length === sheetNames.length) {
      setSelectedSheets([])
    } else {
      setSelectedSheets([...sheetNames])
    }
  }

  const confirmSheets = async () => {
    if (selectedSheets.length === 0 || !workbookBuffer) return
    setImportStatus("parsing")
    try {
      const rows = await parseExcelSheets(workbookBuffer, selectedSheets)
      if (rows.length === 0) {
        setParseError("No data found in the selected sheets.")
        setImportStatus("idle")
        return
      }
      setAllRows(normalizeRows(rows))
      setWorkbookBuffer(null)
      setImportStatus("preview")
    } catch {
      setParseError("Failed to parse the selected sheets.")
      setImportStatus("idle")
    }
  }

  // ── Pagination ────────────────────────────────────────────────────────────────
  const goToPage = (page: number) => {
    setPageIndex(Math.max(0, Math.min(page, totalPages - 1)))
  }

  // ── Row selection ─────────────────────────────────────────────────────────────
  const toggleRow = (globalIndex: number) => {
    setDeselectedRows((prev) => {
      const next = new Set(prev)
      if (next.has(globalIndex)) next.delete(globalIndex)
      else next.add(globalIndex)
      return next
    })
  }

  const toggleAllOnPage = () => {
    const start = pageIndex * pageSize
    const end = Math.min(start + pageSize, allRows.length)
    const allSelected = pageRows.every((_, i) => !deselectedRows.has(start + i))
    setDeselectedRows((prev) => {
      const next = new Set(prev)
      for (let i = start; i < end; i++) {
        if (allSelected) next.add(i)
        else next.delete(i)
      }
      return next
    })
  }

  const clearSelection = () => setDeselectedRows(new Set())

  const selectOnlyThisPage = () => {
    const start = pageIndex * pageSize
    const end = Math.min(start + pageSize, allRows.length)
    setDeselectedRows((prev) => {
      const next = new Set(prev)
      for (let i = 0; i < allRows.length; i++) {
        if (i >= start && i < end) next.delete(i)
        else next.add(i)
      }
      return next
    })
  }

  // ── Streaming import (live per-row progress) ────────────────────────────────
  const handleImport = async () => {
    const rowsToImport = allRows.filter((_, i) => !deselectedRows.has(i))
    if (rowsToImport.length === 0) { setParseError('No rows selected to import.'); return }

    setParseError(null)
    setImportStatus('importing')
    setBatchResults([])
    setLiveLog([])
    setImportTally({ created: 0, skipped: 0, failed: 0 })
    setBatchProgress({ current: 1, total: 1 })

    try {
      const res = await fetch('/api/admin/clients/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clients: rowsToImport, batchSize }),
      })

      if (!res.body) {
        setParseError('Streaming not supported')
        setImportStatus('idle')
        setBatchProgress(null)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim()) continue
          const event = JSON.parse(line)

          if (event.type === 'created') {
            setImportTally((prev) => ({ ...prev, created: prev.created + 1 }))
            setLiveLog((prev) => [{ name: event.name, status: 'created' }, ...prev].slice(0, 100))
            setBatchResults((prev) => [...prev, { name: event.name, status: 'created' }])
          } else if (event.type === 'skipped') {
            setImportTally((prev) => ({ ...prev, skipped: prev.skipped + 1 }))
            setLiveLog((prev) => [{ name: event.name, status: 'skipped (already exists)' }, ...prev].slice(0, 100))
            setBatchResults((prev) => [...prev, { name: event.name, status: 'skipped', reason: event.reason }])
          } else if (event.type === 'failed') {
            setImportTally((prev) => ({ ...prev, failed: prev.failed + 1 }))
            setLiveLog((prev) => [{ name: event.name, status: 'failed', error: event.error }, ...prev].slice(0, 100))
            setBatchResults((prev) => [...prev, { name: event.name, status: 'failed', error: event.error }])
          } else if (event.type === 'done') {
            setBatchProgress(null)
            setImportStatus('done')
          }
        }
      }
    } catch {
      setParseError('Network error during import')
      setImportStatus('idle')
      setBatchProgress(null)
    }
    fetchClients()
  }

  const resetImport = () => {
    setImportStatus("idle")
    setFile(null)
    setAllRows([])
    setDeselectedRows(new Set())
    setPageIndex(0)
    setBatchResults([])
    setBatchProgress(null)
    setImportTally({ created: 0, skipped: 0, failed: 0 })
    setLiveLog([])
    setParseError(null)
    setSheetNames([])
    setSelectedSheets([])
    setWorkbookBuffer(null)
  }

  // ── Delete ────────────────────────────────────────────────────────────────────
  const handleDelete = async (ids: string[]) => {
    setDeleting(true)
    try {
      const res = await fetch("/api/admin/clients", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? "Failed to delete")
      }
    } catch {
      setError("Network error during delete")
    } finally {
      setDeleting(false)
      setShowDeleteConfirm(false)
      setSelectedIds(new Set())
      fetchClients()
    }
  }

  const downloadCsvTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = "agahf_clients_template.csv"; a.click()
    URL.revokeObjectURL(url)
  }

  const downloadExcelTemplate = async () => {
    const XLSX = await import("xlsx")
    const headers = ["Date", "OPD #", "Name", "Sex", "DOB", "Category", "Cell Phone #"]
    const rows = [
      ["", "OPD/12345/26", "Jane Doe", "Female", "1990-01-15", "Private Cash", "0241000001"],
      ["", "OPD/12345/27", "Kofi Mensah", "Male", "1985-08-22", "Private Sponsored", "0241000002"],
    ]
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    ws["!cols"] = [{ wch: 14 }, { wch: 16 }, { wch: 20 }, { wch: 10 }, { wch: 14 }, { wch: 26 }, { wch: 18 }]
    XLSX.utils.book_append_sheet(wb, ws, "Clients")
    const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" })
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = "agahf_clients_template.xlsx"; a.click()
    URL.revokeObjectURL(url)
  }

  const listTotalPages = Math.max(1, Math.ceil(total / listPageSize))

  // Show a sonner toast when clients are selected
  const selectionToastId = React.useRef<string | number | null>(null)
  React.useEffect(() => {
    if (selectedIds.size > 0) {
      if (selectionToastId.current) toast.dismiss(selectionToastId.current)
      selectionToastId.current = toast(`${selectedIds.size} client${selectedIds.size !== 1 ? "s" : ""} selected`, {
        duration: Infinity,
        position: "bottom-right",
        action: {
          label: "Delete",
          onClick: () => setShowDeleteConfirm(true),
        },
        cancel: {
          label: "Clear",
          onClick: () => setSelectedIds(new Set()),
        },
        onDismiss: () => { selectionToastId.current = null },
      })
    } else {
      if (selectionToastId.current) {
        toast.dismiss(selectionToastId.current)
        selectionToastId.current = null
      }
    }
  }, [selectedIds.size])

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
        <DialogContent className="sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Add client</DialogTitle>
            <DialogDescription>Register a new client manually or import from a CSV or Excel file.</DialogDescription>
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
                {t === "manual" ? <><FileText className="h-4 w-4" />Manual</> : <><Upload className="h-4 w-4" />Import file</>}
              </button>
            ))}
          </div>

          {/* Manual form */}
          {tab === "manual" && (
            <div className="grid gap-3 py-2 sm:grid-cols-2">
              <Field label="Full name *" value={fullName} onChange={setFullName} placeholder="Jane Doe" />
              <Field label="Phone number" value={phone} onChange={setPhone} placeholder="+233..." type="tel" />
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
                * Full name is required. At least one of X-number or company number is required.
              </p>
              {error && <p className="text-xs text-destructive sm:col-span-2">{error}</p>}
            </div>
          )}

          {/* ── Import tab ─────────────────────────────────────────────────── */}
          {tab === "import" && (
            <div className="flex flex-col gap-4 py-2">

              {/* ── IDLE: file picker ──────────────────────────────────────── */}
              {importStatus === "idle" && (
                <>
                  <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" onClick={downloadCsvTemplate} className="gap-2">
                      <FileText className="h-4 w-4" /> CSV template
                    </Button>
                    <Button variant="outline" size="sm" onClick={downloadExcelTemplate} className="gap-2">
                      <FileText className="h-4 w-4" /> Excel template
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-2">
                      <Upload className="h-4 w-4" /> Choose file
                    </Button>
                    <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls,.ods" className="hidden" onChange={handleFileChange} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Supports CSV, Excel (.xlsx, .xls), and OpenDocument (.ods) files.
                    Columns: <code className="rounded bg-muted px-1">full_name, phone, x_number, company_number</code> (at minimum).
                  </p>
                </>
              )}

              {/* ── PARSING: spinner ──────────────────────────────────────── */}
              {importStatus === "parsing" && (
                <div className="flex items-center justify-center gap-3 py-8 text-sm text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Parsing file…
                </div>
              )}

              {/* ── SHEETS: multi-sheet picker ────────────────────────────── */}
              {importStatus === "sheets" && (
                <div className="rounded-lg border">
                  <div className="border-b bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground">
                    This file contains multiple sheets — select which to import
                  </div>
                  <div className="flex flex-col gap-1 p-3">
                    <label className="flex items-center gap-2 py-1 text-xs font-medium hover:cursor-pointer">
                      <Checkbox
                        checked={selectedSheets.length === sheetNames.length}
                        onCheckedChange={toggleAllSheets}
                      />
                      <span>{selectedSheets.length === sheetNames.length ? "Deselect all" : "Select all"} ({sheetNames.length} sheets)</span>
                    </label>
                    <div className="ml-1 flex flex-col gap-0.5">
                      {sheetNames.map((name) => (
                        <label key={name} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted/20 hover:cursor-pointer">
                          <Checkbox
                            checked={selectedSheets.includes(name)}
                            onCheckedChange={() => toggleSheet(name)}
                          />
                          {name}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="border-t bg-muted/10 px-3 py-2">
                    <Button size="sm" onClick={confirmSheets} disabled={selectedSheets.length === 0 || importStatus === ("parsing" as ImportStatus)}>
                      {importStatus === ("parsing" as ImportStatus) ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Parsing…</> : "Import selected sheets"}
                    </Button>
                  </div>
                </div>
              )}

              {/* ── PREVIEW: paginated table ──────────────────────────────── */}
              {importStatus === "preview" && (
                <>
                  {/* File info + column badges */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="gap-1">
                      <FileText className="h-3 w-3" /> {file?.name}
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      <Columns className="h-3 w-3" /> {allRows.length} rows
                    </Badge>
                    {recognizedColumns.map((col) => (
                      <Badge key={col} variant="secondary" className="text-green-700 dark:text-green-400">
                        {col}
                      </Badge>
                    ))}
                    {unrecognizedColumns.map((col) => (
                      <Badge key={col} variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-300">
                        {col}?
                      </Badge>
                    ))}
                    <Button variant="ghost" size="sm" className="ml-auto h-6 gap-1 text-xs" onClick={resetImport}>
                      <Trash2 className="h-3 w-3" /> Change file
                    </Button>
                  </div>

                  {/* Config: page size + batch size */}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Rows per page:</span>
                      <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPageIndex(0) }}>
                        <SelectTrigger className="h-7 w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAGE_SIZE_OPTIONS.map((n) => (
                            <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Batch size:</span>
                      <Select value={String(batchSize)} onValueChange={(v) => setBatchSize(Number(v))}>
                        <SelectTrigger className="h-7 w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {BATCH_SIZE_OPTIONS.map((n) => (
                            <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {selectedCount} of {allRows.length} rows selected
                    </span>
                    {deselectedRows.size > 0 && (
                      <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={clearSelection}>
                        Select all
                      </Button>
                    )}
                    {allRows.length > pageSize && (
                      <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={selectOnlyThisPage}>
                        Select only this page
                      </Button>
                    )}
                  </div>

                  {/* Table */}
                  <div className="rounded-lg border">
                    <div className="max-h-60 overflow-auto">
                      <table className="min-w-max w-full text-xs">
                        <thead className="border-b bg-background sticky top-0">
                          <tr>
                            <th className="w-8 px-2 py-2">
                              <Checkbox
                                checked={pageRows.length > 0 && pageRows.every((_, i) => !deselectedRows.has(pageIndex * pageSize + i))}
                                onCheckedChange={toggleAllOnPage}
                              />
                            </th>
                            {previewColumns.map((h) => (
                              <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {pageRows.map((row, i) => {
                            const globalIdx = pageIndex * pageSize + i
                            return (
                              <tr key={globalIdx} className={cn("hover:bg-muted/20", deselectedRows.has(globalIdx) && "opacity-40")}>
                                <td className="w-8 px-2 py-1.5">
                                  <Checkbox
                                    checked={!deselectedRows.has(globalIdx)}
                                    onCheckedChange={() => toggleRow(globalIdx)}
                                  />
                                </td>
                                {previewColumns.map((col) => (
                                  <td key={col} className="px-3 py-1.5 whitespace-nowrap">{row[col] || "—"}</td>
                                ))}
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination controls */}
                    <div className="flex items-center justify-between border-t bg-muted/10 px-3 py-2">
                      <span className="text-xs text-muted-foreground">
                        Showing {pageIndex * pageSize + 1}–{Math.min((pageIndex + 1) * pageSize, allRows.length)} of {allRows.length}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" type="button" disabled={pageIndex === 0} onClick={() => goToPage(pageIndex - 1)}>
                          <ChevronLeft className="h-3 w-3" />
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          Page {pageIndex + 1} of {totalPages}
                        </span>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" type="button" disabled={pageIndex >= totalPages - 1} onClick={() => goToPage(pageIndex + 1)}>
                          <ChevronRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {parseError && <p className="text-xs text-destructive">{parseError}</p>}
                </>
              )}

              {/* ── IMPORTING: live progress ──────────────────────────────── */}
              {importStatus === "importing" && (
                <div className="flex flex-col gap-4 py-4">
                  <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Importing {importTally.created + importTally.skipped + importTally.failed} of {allRows.length - deselectedRows.size}…
                  </div>
                  <Progress
                    value={((importTally.created + importTally.skipped + importTally.failed) / Math.max(1, allRows.length - deselectedRows.size)) * 100}
                    className="h-2"
                  />
                  <div className="flex items-center justify-center gap-4 text-xs">
                    <span className="text-green-600 flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" /> {importTally.created} created
                    </span>
                    <span className="text-muted-foreground flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> {importTally.skipped} skipped
                    </span>
                    <span className={cn("flex items-center gap-1", importTally.failed > 0 ? "text-destructive" : "text-muted-foreground")}>
                      <XCircle className="h-3 w-3" /> {importTally.failed} failed
                    </span>
                  </div>
                  {/* Live scrolling log */}
                  <div className="max-h-40 overflow-y-auto rounded border bg-muted/10 divide-y text-xs">
                    {liveLog.length === 0 && (
                      <div className="px-3 py-2 text-muted-foreground">Checking existing clients…</div>
                    )}
                    {liveLog.slice(0, 50).map((r, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-1.5">
                        <span className="truncate">{r.name}</span>
                        <span className={cn(
                          "flex items-center gap-1 shrink-0 ml-2",
                          r.status === "created" ? "text-green-600" : r.status === "failed" ? "text-destructive" : "text-muted-foreground"
                        )}>
                          {r.status === "created" ? <CheckCircle className="h-3 w-3" /> : r.status === "failed" ? <XCircle className="h-3 w-3" /> : null}
                          {r.status === "created" ? "Created" : r.status === "failed" ? (r.error ?? "Failed") : "Skipped"}
                        </span>
                      </div>
                    ))}
                  </div>
                  {parseError && <p className="text-xs text-destructive text-center">{parseError}</p>}
                </div>
              )}

              {/* ── DONE: results summary ─────────────────────────────────── */}
              {importStatus === "done" && (
                <div className="flex flex-col gap-4">
                  <div className="rounded-lg border bg-green-50/50 dark:bg-green-950/10 p-4 text-center">
                    <h3 className="text-sm font-semibold mb-2">Import complete</h3>
                    <div className="flex items-center justify-center gap-5 text-sm">
                      <span className="text-green-600 font-medium">{importTally.created} created</span>
                      <span className="text-muted-foreground">{importTally.skipped} skipped</span>
                      <span className={importTally.failed > 0 ? "text-destructive font-medium" : "text-muted-foreground"}>
                        {importTally.failed} failed
                      </span>
                    </div>
                  </div>

                  {/* ── Complete detailed log ──────────────────────────────── */}
                  {batchResults.length > 0 && (
                    <div className="rounded-lg border">
                      <div className="border-b bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground">
                        Detailed log — all rows ({batchResults.length} total)
                      </div>
                      <div className="max-h-80 overflow-auto">
                        {/* Failed section */}
                        {(() => {
                          const failed = batchResults.filter((r) => r.status === "failed")
                          return failed.length > 0 ? (
                            <details className="border-b last:border-b-0" open={failed.length > 0}>
                              <summary className="sticky top-0 flex items-center gap-2 bg-red-50/80 dark:bg-red-950/20 px-3 py-2 text-xs font-medium text-destructive cursor-pointer hover:bg-red-50 dark:hover:bg-red-950/30">
                                <XCircle className="h-3 w-3" />
                                Failed — {failed.length} row{failed.length !== 1 ? "s" : ""}
                              </summary>
                              <div className="divide-y">
                                {failed.map((r, i) => (
                                  <div key={i} className="flex items-center justify-between px-3 py-1.5 text-xs">
                                    <span className="truncate">{r.name}</span>
                                    <span className="text-destructive shrink-0 ml-2">{r.error ?? "Error"}</span>
                                  </div>
                                ))}
                              </div>
                            </details>
                          ) : null
                        })()}

                        {/* Skipped section */}
                        {(() => {
                          const skipped = batchResults.filter((r) => r.status === "skipped")
                          return skipped.length > 0 ? (
                            <details className="border-b last:border-b-0">
                              <summary className="sticky top-0 flex items-center gap-2 bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground cursor-pointer hover:bg-muted/40">
                                <AlertCircle className="h-3 w-3" />
                                Skipped — {skipped.length} row{skipped.length !== 1 ? "s" : ""}
                              </summary>
                              <div className="divide-y">
                                {skipped.map((r, i) => (
                                  <div key={i} className="flex items-center justify-between px-3 py-1.5 text-xs">
                                    <span className="truncate">{r.name}</span>
                                    <span className="text-muted-foreground shrink-0 ml-2">{r.reason ?? "Already exists"}</span>
                                  </div>
                                ))}
                              </div>
                            </details>
                          ) : null
                        })()}

                        {/* Created section */}
                        {(() => {
                          const created = batchResults.filter((r) => r.status === "created")
                          return created.length > 0 ? (
                            <details className="border-b last:border-b-0">
                              <summary className="sticky top-0 flex items-center gap-2 bg-green-50/80 dark:bg-green-950/20 px-3 py-2 text-xs font-medium text-green-700 dark:text-green-400 cursor-pointer hover:bg-green-50 dark:hover:bg-green-950/30">
                                <CheckCircle className="h-3 w-3" />
                                Created — {created.length} row{created.length !== 1 ? "s" : ""}
                              </summary>
                              <div className="divide-y">
                                {created.map((r, i) => (
                                  <div key={i} className="flex items-center justify-between px-3 py-1.5 text-xs">
                                    <span className="truncate">{r.name}</span>
                                    <span className="text-green-600 shrink-0 ml-2">Created</span>
                                  </div>
                                ))}
                              </div>
                            </details>
                          ) : null
                        })()}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={resetImport} className="gap-2">
                      <Upload className="h-4 w-4" /> Import another file
                    </Button>
                    <Button size="sm" variant="outline" onClick={closeDialog}>
                      Close
                    </Button>
                  </div>
                </div>
              )}

              {/* ── Error display ─────────────────────────────────────────── */}
              {parseError && importStatus !== "preview" && importStatus !== "importing" && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {parseError}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={saving || importStatus === "importing"}>
              {importStatus === "done" ? "Close" : "Cancel"}
            </Button>
            {tab === "manual" && (
              <Button onClick={createClient} disabled={saving}>
                {saving ? "Creating…" : "Create client"}
              </Button>
            )}
            {tab === "import" && importStatus === "preview" && (
              <Button onClick={handleImport} disabled={selectedCount === 0}>
                Import {selectedCount} row{selectedCount !== 1 ? "s" : ""}
              </Button>
            )}
            {tab === "import" && importStatus === "importing" && (
              <Button disabled>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                Importing… {batchProgress ? `${batchProgress.current}/${batchProgress.total}` : ""}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Search + Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Search…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="w-full rounded-lg border bg-background py-2 pl-9 pr-8 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            onClick={() => setRegexMode((r) => !r)}
            className={cn(
              "absolute right-2 top-1/2 -translate-y-1/2 rounded px-1.5 py-0.5 text-xs font-mono transition-colors",
              regexMode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
            title="Toggle regex mode"
          >
            .*
          </button>
        </div>

        <select
          value={filterCategory}
          onChange={(e) => { setFilterCategory(e.target.value); setPage(1) }}
          className="rounded-lg border bg-background px-3 py-2 text-sm"
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>

        <select
          value={filterActive}
          onChange={(e) => { setFilterActive(e.target.value); setPage(1) }}
          className="rounded-lg border bg-background px-3 py-2 text-sm"
        >
          <option value="">All status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>

        {(search || filterCategory || filterActive || sortBy !== "x_number") && (
          <Button variant="ghost" size="sm" className="h-9 gap-1 text-xs" onClick={resetFilters}>
            <Trash2 className="h-3 w-3" /> Reset
          </Button>
        )}
      </div>

      {loading ? (
        <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs font-medium uppercase text-muted-foreground">
              <tr>
                <th className="w-10 px-2 py-3" />
                <th className="px-4 py-3">X-Number</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Company No.</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3">Status</th>
                <th className="w-14 px-2 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {[...Array(8)].map((_, i) => (
                <tr key={i}>
                  <td className="px-2 py-3"><Skeleton className="h-4 w-4" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-5 w-14 rounded-full" /></td>
                  <td className="px-2 py-3" />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : clients.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border bg-background py-16 text-center">
          <Users className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No clients found.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs font-medium uppercase text-muted-foreground">
              <tr>
                <th className="w-10 px-2 py-3">
                  <Checkbox
                    checked={clients.length > 0 && selectedIds.size === clients.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </th>
                <th className="px-4 py-3 cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("x_number")}>
                  X-Number{sortIcon("x_number")}
                </th>
                <th className="px-4 py-3 cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("full_name")}>
                  Name{sortIcon("full_name")}
                </th>
                <th className="px-4 py-3 cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("phone")}>
                  Phone{sortIcon("phone")}
                </th>
                <th className="px-4 py-3 cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("company_number")}>
                  Company No.{sortIcon("company_number")}
                </th>
                <th className="px-4 py-3 cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("category")}>
                  Category{sortIcon("category")}
                </th>
                <th className="px-4 py-3 cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("date_joined")}>
                  Joined{sortIcon("date_joined")}
                </th>
                <th className="px-4 py-3 cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("is_active")}>
                  Status{sortIcon("is_active")}
                </th>
                <th className="w-14 px-2 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {clients.map((c) => (
                <tr key={c.id} className={cn("hover:bg-muted/30", selectedIds.has(c.id) && "bg-primary/5")}>
                  <td className="w-10 px-2 py-3">
                    <Checkbox
                      checked={selectedIds.has(c.id)}
                      onCheckedChange={() => toggleSelect(c.id)}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium">{c.x_number ?? "—"}</td>
                  <td className="px-4 py-3">
                    {c.full_name
                      ? c.full_name.toLowerCase().replace(/\b\w/g, (ch) => ch.toUpperCase())
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.company_number ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <Badge variant="outline" className="text-xs font-normal">
                      {CATEGORIES.find((cat) => cat.value === c.category)?.label ?? c.category ?? "—"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.date_joined ?? new Date(c.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      c.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    )}>
                      {c.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-2 py-3">
                    <button
                      onClick={() => { setSelectedIds(new Set([c.id])); setShowDeleteConfirm(true) }}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                      title="Delete client"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Pagination */}
          <div className="flex items-center justify-between border-t bg-muted/10 px-4 py-2">
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                {total} client{total !== 1 ? "s" : ""}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Per page:</span>
                <select
                  value={listPageSize}
                  onChange={(e) => { setListPageSize(Number(e.target.value)); setPage(1) }}
                  className="rounded border bg-background px-2 py-1 text-xs"
                >
                  {[10, 25, 50, 100].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="h-3 w-3" />
              </Button>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                Page {page} of {listTotalPages}
              </span>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={page >= listTotalPages} onClick={() => setPage(page + 1)}>
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {selectedIds.size} client{selectedIds.size !== 1 ? "s" : ""}?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. The profiles will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => handleDelete([...selectedIds])} disabled={deleting}>
              {deleting ? "Deleting…" : `Delete ${selectedIds.size} client${selectedIds.size !== 1 ? "s" : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
