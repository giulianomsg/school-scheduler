/**
 * Sanitizes user text input by stripping HTML tags and limiting length.
 */
export function sanitizeText(input: string, maxLength = 1000): string {
  return input
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .trim()
    .substring(0, maxLength);
}
