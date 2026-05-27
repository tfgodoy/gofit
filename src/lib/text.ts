/**
 * Converts any string to Title Case:
 * "AGACHAMENTO FRONTAL - HALTER DUPLO" → "Agachamento Frontal - Halter Duplo"
 * Capitalizes the first letter after spaces and hyphens.
 */
export function toTitleCase(str: string): string {
  if (!str?.trim()) return str;
  return str
    .toLowerCase()
    .replace(/(^|[\s\-])(\S)/g, (_, sep, char) => sep + char.toUpperCase());
}
