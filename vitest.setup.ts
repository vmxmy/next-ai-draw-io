/**
 * Vitest setup file
 *
 * Provides polyfills for browser APIs not available in Node.js
 */

import { DOMParser, XMLSerializer } from "@xmldom/xmldom"

// Polyfill DOMParser and XMLSerializer for Node.js environment
if (typeof globalThis.DOMParser === "undefined") {
    globalThis.DOMParser = DOMParser
}

if (typeof globalThis.XMLSerializer === "undefined") {
    globalThis.XMLSerializer = XMLSerializer
}
