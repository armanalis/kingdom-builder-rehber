import type { ErrorCode } from "./i18n";

// Marker the server appends to a streamed answer when generation fails midway,
// followed by an error code the client translates.
export const ERROR_MARKER = "\u0000ERR:";

export function errorCode(error: unknown): ErrorCode {
  const status =
    typeof error === "object" && error !== null && "statusCode" in error
      ? Number((error as { statusCode: unknown }).statusCode)
      : undefined;
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (message.includes("credit card") || message.includes("customer_verification")) return "not_enabled";
  if (status === 429 || message.includes("rate limit")) return "rate_limit";
  if (status === 402 || message.includes("insufficient") || message.includes("quota")) return "quota";
  if (status === 401 || status === 403) return "not_enabled";
  return "generic";
}
