const { DOMParser } = require("xmldom")

function convertToLegalXml(xmlString) {
    const regex = /<mxCell\b[^>]*(?:\/>|>([\s\S]*?)<\/mxCell>)/g
    let match
    let result = "<root>\n"

    while ((match = regex.exec(xmlString)) !== null) {
        const cellContent = match[0]
        const formatted = cellContent
            .split("\n")
            .map((line) => "    " + line.trim())
            .filter((line) => line.trim())
            .join("\n")
        result += formatted + "\n"
    }
    result += "</root>"

    return result
}

const badXml = `<mxCell value="foo&nbsp;bar" />`
const converted = convertToLegalXml(badXml)
console.log("Converted:", converted)

const parser = new DOMParser()
const doc = parser.parseFromString(converted, "text/xml")
// xmldom behaves slightly differently than browser DOMParser but usually complains about entities
const errors = doc.getElementsByTagName("parsererror")
if (errors.length > 0) {
    console.log("Parser Error found")
} else {
    // Check for throw/console.error behavior of xmldom for entities
    // In browser, &nbsp; is definitely an error for application/xml
    console.log(
        "No explicit parsererror element (might need browser env to confirm strictly)",
    )
}
