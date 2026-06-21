import { createSupabaseServerClient } from "@/lib/supabase/server"
import ClientDashboardPage from "./client-dashboard"

export default async function Page() {
  let serverUserName = ""

  try {
    const supabase = await createSupabaseServerClient()
    const { data } = await supabase.auth.getUser()

    if (data?.user) {
      const fullName =
        data.user.user_metadata?.full_name ??
        data.user.user_metadata?.name ??
        ""
      serverUserName = fullName.split(" ")[0] || ""
    }
  } catch {
    // Server-side session read failed — client will fetch its own name
  }

  return <ClientDashboardPage serverUserName={serverUserName} />
}
