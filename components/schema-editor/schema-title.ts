export function formatTitle(rawName: string): string {
  return rawName
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map(
      (chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1).toLowerCase(),
    )
    .join(" ");
}
