// Marker the server appends to a streamed answer when generation fails midway.
export const ERROR_MARKER = "\u0000HATA:";

export function friendlyError(error: unknown): string {
  const status =
    typeof error === "object" && error !== null && "statusCode" in error
      ? Number((error as { statusCode: unknown }).statusCode)
      : undefined;
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (status === 429 || message.includes("rate limit")) {
    return "Şu an çok fazla istek var. 10 saniye bekleyip tekrar deneyin.";
  }
  if (status === 402 || message.includes("credit") || message.includes("quota")) {
    return "Bu ayın ücretsiz kullanım hakkı dolmuş. Lütfen Ali'ye haber verin.";
  }
  if (status === 401 || status === 403) {
    return "Sunucu yapay zekâya bağlanamadı (yetki sorunu). Lütfen Ali'ye haber verin.";
  }
  return "Bir sorun oluştu. Lütfen tekrar deneyin.";
}
