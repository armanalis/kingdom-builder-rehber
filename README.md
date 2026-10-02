# Kingdom Builder Kural Hakemi

Kingdom Builder için Türkçe, sesli/yazılı kural asistanı ve skor tablosu.

- `/` — Kural Hakemi: soruyu söyle ya da yaz, resmi kurallara dayanan kısa cevap al (cevap sesli okunabilir).
- `/skor` — Skor Tablosu: oyun sonuçları, galibiyetler, rekor fark, seriler ve diğer istatistikler.

## Nasıl çalışır

- Next.js (App Router) + Vercel AI SDK, Vercel'de barındırılır.
- Cevaplar: Vercel AI Gateway üzerinden `openai/gpt-5.2` (yedek: `google/gemini-2.5-flash`), ikisi de AI Gateway ücretsiz katmanında. Kural bilgisi `lib/rules.ts` içinde.
- Ses: tarayıcının konuşma tanıma özelliği (`tr-TR`); yoksa ses kaydı `/api/transcribe` ile `openai/gpt-4o-mini-transcribe` modeline gönderilir.
- Skorlar: Vercel Blob'da tek bir özel JSON dosyası (`lib/scoreStore.ts`). Yerelde Blob token'ı yoksa `.data/scoreboard.json` kullanılır.

## Ortam değişkenleri (isteğe bağlı)

| Değişken | Varsayılan |
| --- | --- |
| `AI_GATEWAY_MODEL` | `openai/gpt-5.2` |
| `AI_GATEWAY_FALLBACK_MODELS` | `google/gemini-2.5-flash` |
| `AI_GATEWAY_TRANSCRIBE_MODEL` | `openai/gpt-4o-mini-transcribe` |
| `BLOB_READ_WRITE_TOKEN` | Blob store projeye bağlanınca Vercel ekler |

## Geliştirme

```bash
npm install
npm run dev
```

AI çağrıları yerelde `vercel link` + `vercel env pull` (OIDC) ya da `AI_GATEWAY_API_KEY` gerektirir.
