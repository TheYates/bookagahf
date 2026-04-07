# Hospital Scheduling System Tasks

## Setup
- [x] Scaffold Next.js app
- [x] Add Supabase environment placeholders
- [x] Add Supabase schema + RLS policies
- [x] Add Hubtel SMS integration
- [x] Add Web Push (VAPID) integration

## Core Features
- [x] Unread notification badge in client + doctor sidebars (realtime)
- [x] Supabase Auth flows (signup/login — OTP for clients/corporate, password for staff)
- [x] Role-based routing/guards (client/doctor/admin)
- [x] Next.js middleware protecting /admin, /doctor, /client by role
- [x] OTP generation + Hubtel SMS delivery
- [x] OTP verify API route + real browser session via magic link token exchange
- [x] Client booking flow with doctor + specialty selection
- [x] Corporate employee booking for dependants
- [x] Client reschedule/cancel flow with notifications
- [x] Client appointments list page
- [x] Client notifications page
- [x] Doctor availability scheduler UI
- [x] Doctor disable availability toggle
- [x] Doctor reschedule and update appointment status (completed/review)
- [x] Doctor layout with sidebar and logout
- [x] Doctor appointments page with filter tabs
- [x] Admin settings UI (booking buffer)
- [x] Admin dashboard with stats cards and recent appointments
- [x] Admin sidebar layout with navigation and logout

## Notifications
- [x] In-app notification center (client + doctor)
- [x] Hubtel SMS on create/reschedule/cancel
- [x] Web Push on create/reschedule/cancel
- [x] Central notifyAppointmentEvent service (lib/notifications/send.ts)

## PWA
- [x] Add manifest and service worker
- [x] Push subscription UI (PushPrompt bottom banner)
- [x] Service worker registration in root layout
- [x] usePushSubscription hook (VAPID, subscribe/unsubscribe)

## Data/Admin
- [x] Specialties + doctor assignment UI
- [x] Admin dashboard stats
- [x] Admin appointments list with search + filter
- [x] Admin doctors management (create doctor, assign specialties)
- [x] Admin clients list with search
- [x] Admin client creation dialog (multi-column + CSV import)
- [x] Admin add specialty dialog
- [x] Client profile page (read-only)
- [x] Seed routes — admin, clients, doctors + specialties

## Remaining
- [x] Wire app_metadata.role for all users via /api/seed/fix-roles backfill
- [x] Remove middleware DB fallback (proxy.ts now relies solely on app_metadata)
- [ ] Doctor availability seed — default slots for seeded doctors
- [ ] Client dependants page — corporate employees manage dependants
- [ ] Admin: edit/deactivate doctors and clients
- [ ] Admin: view appointment details (doctor name, specialty)
- [ ] Doctor: view client profile from appointment
- [ ] Doctor notifications page — unread badge realtime update on mark-read
- [ ] Client booking — show doctor's real name instead of ID in confirmation
- [ ] Booking buffer — surface buffer rule in booking UI (e.g. "earliest available: 2hrs from now")
- [ ] Resend OTP cooldown — prevent spam (e.g. 60s between requests)
- [ ] Error boundaries — graceful fallback pages for unexpected errors
- [ ] Production readiness — remove /api/seed/* routes, add NEXT_PUBLIC_APP_URL to prod env
