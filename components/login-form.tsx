"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"
import { User, KeyRound, Send, ArrowRight } from "lucide-react"

import { cn } from "@/lib/utils"

// ─── Types ───────────────────────────────────────────────────────────────────

type AuthStep = "identifier" | "otp-sent" | "credential"
type InputType = "x-number" | "corporate" | "staff"

// Strict X-number: X followed by exactly 5 digits, /, exactly 2 digits = 9 chars total
// e.g. X12345/26
function detectInputType(value: string): InputType {
  const v = value.trim()
  if (/^X\d{5}\/\d{2}$/i.test(v)) return "x-number"
  if (/^\d+$/.test(v)) return "corporate"
  return "staff"
}

function isValidIdentifier(value: string): boolean {
  const v = value.trim()
  const type = detectInputType(v)
  if (type === "x-number") return /^X\d{5}\/\d{2}$/i.test(v)
  if (type === "corporate") return v.length >= 4
  return v.length >= 3
}

// Mask phone: show first 3 and last 2 digits only e.g. +233 2** *** **89
function maskPhone(phone: string): string {
  if (!phone) return "your registered number"
  const digits = phone.replace(/\D/g, "")
  if (digits.length < 5) return phone
  return phone.slice(0, 3) + "*".repeat(Math.max(0, phone.length - 5)) + phone.slice(-2)
}

// ─── Animations ──────────────────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 },
  },
}

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 100 },
  },
}

const slideDown = {
  hidden: { height: 0, opacity: 0 },
  visible: { height: "auto", opacity: 1, transition: { duration: 0.25 } },
  exit: { height: 0, opacity: 0, transition: { duration: 0.2 } },
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface LoginFormProps extends React.HTMLAttributes<HTMLDivElement> {
  imageUrl?: string
  hospitalName?: string
  hospitalShortName?: string
  onSubmit: (details: {
    identifier: string
    credential: string
    type: InputType
  }) => Promise<void>
  // Returns the masked phone number from server e.g. "+233 2** *** **89"
  onRequestOtp?: (identifier: string) => Promise<{ maskedPhone: string }>
}

// ─── Component ───────────────────────────────────────────────────────────────

const IMAGE_URL =
  "https://cn-geo1.uber.com/image-proc/crop/resizecrop/udam/format=auto/width=1344/height=896/srcb64=aHR0cHM6Ly90Yi1zdGF0aWMudWJlci5jb20vcHJvZC91ZGFtLWFzc2V0cy9hM2NmODU2NC1lMmE2LTQxOGMtYjliMC02NWRkMjg1YzEwMGIuanBn"

export const LoginForm = React.forwardRef<HTMLDivElement, LoginFormProps>(
  (
    {
      className,
      imageUrl = IMAGE_URL,
      hospitalName = "AGA HEALTH FOUNDATION",
      hospitalShortName = "AGAHF",
      onSubmit,
      onRequestOtp,
      ...props
    },
    ref,
  ) => {
    const [identifier, setIdentifier] = React.useState("")
    const [credential, setCredential] = React.useState("")
    const [step, setStep] = React.useState<AuthStep>("identifier")
    const [maskedPhone, setMaskedPhone] = React.useState<string | null>(null)
    const [loading, setLoading] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    const [identifierError, setIdentifierError] = React.useState<string | null>(null)
    const credentialRef = React.useRef<HTMLInputElement>(null)

    const inputType = detectInputType(identifier)
    // Only treat as staff if it doesn't start with X or digits (rules out partial x-number/corporate)
    const isStaff = inputType === "staff" && !/^[xX\d]/.test(identifier.trim())

    // For staff the credential input is shown after they start typing; for others after OTP is sent
    const showCredential = (isStaff && identifier.trim().length > 0) || step === "otp-sent"

    const credentialPlaceholder = isStaff
      ? "Password"
      : "Enter OTP sent to your phone"

    // ── Validate identifier format on blur / before sending OTP
    function validateIdentifier(): boolean {
      const v = identifier.trim()
      if (!v) {
        setIdentifierError("Please enter your ID or username.")
        return false
      }
      if (inputType === "x-number" && !/^X\d{5}\/\d{2}$/i.test(v)) {
        setIdentifierError("X-Number must be in the format X12345/26.")
        return false
      }
      if (inputType === "corporate" && v.length < 4) {
        setIdentifierError("Company number must be at least 4 digits.")
        return false
      }
      setIdentifierError(null)
      return true
    }

    const handleSendOtp = async () => {
      if (!validateIdentifier()) return
      setError(null)
      setLoading(true)
      try {
        const result = await onRequestOtp?.(identifier.trim())
        setMaskedPhone(result?.maskedPhone ?? null)
        setStep("otp-sent")
        // Focus credential input after it slides in
        setTimeout(() => credentialRef.current?.focus(), 300)
      } catch (err: any) {
        setError(err?.message ?? "Failed to send OTP. Please try again.")
      } finally {
        setLoading(false)
      }
    }

    // Pressing Enter in the identifier field triggers OTP send for non-staff
    const handleIdentifierKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault()
        if (isStaff) return // staff will submit the form normally
        handleSendOtp()
      }
    }

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault()
      setError(null)

      if (!validateIdentifier()) return

      // For non-staff, OTP must have been sent first
      if (!isStaff && step !== "otp-sent") {
        setError("Please request an OTP first by pressing the send button.")
        return
      }

      if (!credential.trim()) {
        setError(isStaff ? "Please enter your password." : "Please enter the OTP.")
        return
      }

      setLoading(true)
      try {
        await onSubmit({ identifier: identifier.trim(), credential, type: inputType })
      } catch (err: any) {
        setError(err?.message ?? "Authentication failed. Please try again.")
      } finally {
        setLoading(false)
      }
    }

    return (
      <div
        className={cn("mx-auto w-full max-w-6xl p-4 lg:p-8", className)}
        ref={ref}
        {...props}
      >
        <div className="grid grid-cols-1 items-center gap-8 overflow-hidden rounded-lg bg-background lg:grid-cols-2">

          {/* ── Left Side: Form ── */}
          <motion.div
            className="p-4 sm:p-8"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Brand row */}
            <motion.div variants={itemVariants} className="mb-6 flex items-center gap-3">
              <Image
                src="/agahflogo.svg"
                alt={`${hospitalShortName} logo`}
                width={40}
                height={40}
                className="block dark:hidden"
                priority
              />
              <Image
                src="/agahflogo-white.png"
                alt={`${hospitalShortName} logo`}
                width={40}
                height={40}
                className="hidden dark:block"
                priority
              />
              <div>
                <p className="text-xs text-muted-foreground">{hospitalShortName}</p>
                <p className="text-sm font-semibold leading-tight text-foreground">
                  {hospitalName}
                </p>
              </div>
            </motion.div>

            <motion.h1
              variants={itemVariants}
              className="mb-8 text-4xl font-bold text-foreground sm:text-5xl"
            >
              Book your next appointment
            </motion.h1>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* ── Connected inputs box ── */}
              <motion.div
                variants={itemVariants}
                className="relative rounded-lg bg-muted/40 p-4"
              >
                {/* Dashed connector line — only visible when second input is shown */}
                {showCredential && (
                  <div className="absolute bottom-9 left-6 top-9 w-px border-l border-dashed border-border" />
                )}

                {/* ── First input — identifier ── */}
                <div className="relative flex items-center">
                  <div className="z-10 rounded-full border bg-background p-1">
                    <User className="h-4 w-4 text-foreground" />
                  </div>
                  <input
                    type="text"
                    placeholder="X-number, Corporate Number or username"
                    value={identifier}
                    onChange={(e) => {
                      let val = e.target.value

                      // Only format if it starts with X/x
                      if (/^[xX]/.test(val)) {
                        // Force uppercase X
                        val = "X" + val.slice(1)

                        // Extract only digits after X (ignore any existing slash)
                        const afterX = val.slice(1)
                        const digits = afterX.replace(/\D/g, "")

                        // Rebuild: X + up to 5 digits + slash + up to 2 digits
                        if (digits.length <= 5) {
                          val = "X" + digits
                        } else {
                          val = "X" + digits.slice(0, 5) + "/" + digits.slice(5, 7)
                        }
                      }

                      setIdentifier(val)
                      setStep("identifier")
                      setCredential("")
                      setMaskedPhone(null)
                      setError(null)
                      setIdentifierError(null)
                    }}
                    onKeyDown={handleIdentifierKeyDown}
                    className="w-full bg-transparent py-2 pl-4 pr-10 text-foreground focus:outline-none"
                    aria-label="Identifier"
                    autoComplete="username"
                    spellCheck={false}
                  />
                  {/* Send OTP button — only for non-staff with a value */}
                  {!isStaff && identifier && step !== "otp-sent" && (
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={loading}
                      title="Send OTP"
                      className="absolute right-2 p-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                    >
                      <Send className="h-5 w-5" />
                    </button>
                  )}
                </div>

                {/* Identifier validation error */}
                {identifierError && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-1 pl-10 text-xs text-destructive"
                  >
                    {identifierError}
                  </motion.p>
                )}

                {/* ── Second input — slides in after OTP sent or for staff ── */}
                <AnimatePresence>
                  {showCredential && (
                    <motion.div
                      key="credential"
                      variants={slideDown}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      className="overflow-hidden"
                    >
                      {/* OTP sent confirmation message */}
                      {step === "otp-sent" && maskedPhone && (
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="mb-2 mt-3 pl-10 text-xs text-muted-foreground"
                        >
                          OTP sent to{" "}
                          <span className="font-medium text-foreground">
                            {maskPhone(maskedPhone)}
                          </span>
                          .{" "}
                          <button
                            type="button"
                            onClick={handleSendOtp}
                            disabled={loading}
                            className="text-primary hover:underline disabled:opacity-50"
                          >
                            Resend
                          </button>
                        </motion.p>
                      )}

                      <hr className="mx-8 mt-2 border-border" />

                      <div className="relative mt-2 flex items-center">
                        <div className="z-10 rounded-full border bg-background p-1">
                          <KeyRound className="h-4 w-4 text-foreground" />
                        </div>
                        <input
                          ref={credentialRef}
                          type={isStaff ? "password" : "text"}
                          placeholder={credentialPlaceholder}
                          value={credential}
                          onChange={(e) => {
                            const val = e.target.value
                            setCredential(val)
                            setError(null)
                            // Auto-submit when OTP reaches 6 digits
                            if (!isStaff && val.length === 6) {
                              setTimeout(() => {
                                const form = e.target.closest("form")
                                form?.requestSubmit()
                              }, 100)
                            }
                          }}
                          className="w-full bg-transparent py-2 pl-4 text-foreground focus:outline-none"
                          aria-label="Credential"
                          autoComplete={isStaff ? "current-password" : "one-time-code"}
                          inputMode={isStaff ? undefined : "numeric"}
                          maxLength={isStaff ? undefined : 6}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* General error */}
              {error && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs text-destructive"
                >
                  {error}
                </motion.p>
              )}

              {/* ── Action row ── */}
              <motion.div
                variants={itemVariants}
                className="flex items-center space-x-4 pt-4"
              >
                <button
                  type="submit"
                  disabled={loading || (!isStaff && step !== "otp-sent")}
                  className="inline-flex h-12 items-center justify-center whitespace-nowrap rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                >
                  {loading ? "Please wait…" : "Continue"}
                </button>

                <a
                  href="#"
                  className="group text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  Need help signing in?
                  <ArrowRight className="ml-1 inline-block h-4 w-4 transform transition-transform group-hover:translate-x-1" />
                </a>
              </motion.div>
            </form>
          </motion.div>

          {/* ── Right Side: Image ── */}
          <motion.div
            className="hidden w-full h-full lg:block"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <img
              src={imageUrl}
              alt="Hospital appointment illustration"
              className="w-full h-full object-cover rounded-lg"
            />
          </motion.div>
        </div>
      </div>
    )
  },
)

LoginForm.displayName = "LoginForm"
