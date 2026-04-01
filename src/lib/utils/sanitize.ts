/**
 * Sanitize untrusted text before interpolating into LLM prompts.
 * Strips characters used for prompt structure (angle brackets, backticks,
 * XML closing sequences) and truncates to a safe length.
 */
export function sanitizeForPrompt(text: string, maxLength: number = 500): string {
  return text
    .replace(/<\/?[a-z_][a-z0-9_]*>/gi, "") // strip XML/HTML tags
    .replace(/[<>`"]/g, "")
    .replace(/\]\]>/g, "") // strip CDATA close
    .replace(/\r?\n/g, " ")
    .trim()
    .slice(0, maxLength);
}
