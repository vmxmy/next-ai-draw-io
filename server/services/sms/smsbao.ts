import { createHash } from "crypto"

const SMS_BAO_ENDPOINT = "https://api.smsbao.com/sms"

const RESPONSE_MESSAGES: Record<string, string> = {
    "0": "Success",
    "30": "Password error",
    "40": "Account not exist",
    "41": "Insufficient balance",
    "43": "IP address limited",
    "50": "Content contains sensitive characters",
    "51": "Number is invalid",
}

export class SmsBaoError extends Error {
    readonly code: string

    constructor(code: string, message?: string) {
        super(message ?? `SMSBao error code ${code}`)
        this.code = code
    }
}

type SendResult = {
    skipped: boolean
}

const hasCredentials = () =>
    Boolean(
        process.env.SMSBAO_USERNAME &&
            (process.env.SMSBAO_API_KEY || process.env.SMSBAO_PASSWORD),
    )

export async function sendSmsBaoMessage({
    phone,
    content,
}: {
    phone: string
    content: string
}): Promise<SendResult> {
    if (!hasCredentials()) {
        if (process.env.NODE_ENV === "production") {
            throw new Error("SMSBao credentials are not configured.")
        }
        console.warn("[smsbao] Missing credentials, skipping real SMS send.")
        console.log(`[smsbao][dev] Phone: ${phone}, Message: ${content}`)
        return { skipped: true }
    }

    const username = process.env.SMSBAO_USERNAME
    const apiKey = process.env.SMSBAO_API_KEY
    const password = process.env.SMSBAO_PASSWORD

    if (!username || (!apiKey && !password)) {
        throw new Error("SMSBao credentials are not configured.")
    }

    const passwordParam =
        apiKey ||
        createHash("md5")
            .update(password || "")
            .digest("hex")

    const url = new URL(SMS_BAO_ENDPOINT)
    url.searchParams.set("u", username)
    url.searchParams.set("p", passwordParam)
    url.searchParams.set("m", phone)
    url.searchParams.set("c", content)

    const response = await fetch(url.toString(), {
        method: "GET",
        cache: "no-store",
    })

    const body = (await response.text()).trim()

    if (body !== "0") {
        throw new SmsBaoError(body, RESPONSE_MESSAGES[body])
    }

    return { skipped: false }
}
