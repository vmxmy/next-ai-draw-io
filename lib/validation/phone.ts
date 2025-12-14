const PHONE_REGEX = /^\+?[0-9]{6,15}$/

export function normalizePhoneNumber(input: string) {
    return input.replace(/[\s()-]/g, "").trim()
}

export function isValidPhoneNumber(input: string) {
    const normalized = normalizePhoneNumber(input)
    return PHONE_REGEX.test(normalized)
}

export { PHONE_REGEX }
