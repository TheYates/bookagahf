export type HubtelSmsPayload = {
  to: string
  content: string
}

export async function sendHubtelSms({ to, content }: HubtelSmsPayload) {
  const baseUrl = "https://sms.hubtel.com/v1/messages/send"
  const clientId = process.env.HUBTEL_CLIENT_ID
  const clientSecret = process.env.HUBTEL_CLIENT_SECRET
  const senderId = process.env.HUBTEL_SENDER_ID

  if (!clientId || !clientSecret || !senderId) {
    throw new Error("Hubtel credentials missing")
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64")

  const response = await fetch(baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({
      From: senderId,
      To: to,
      Content: content,
    }),
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(`Hubtel SMS failed: ${message}`)
  }

  return response.json()
}
