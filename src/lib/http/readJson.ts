/**
 * Parse JSON from a fetch Response; surface gateway HTML/text timeouts cleanly.
 */
export async function readJsonResponse<T = unknown>(
  response: Response,
): Promise<T> {
  const text = await response.text();
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error(
      response.ok
        ? "Pusta odpowiedź serwera"
        : `HTTP ${response.status}: pusta odpowiedź`,
    );
  }

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    if (response.status === 504 || /timeout|timed out/i.test(trimmed)) {
      throw new Error(
        "Timeout serwera (504) — analiza Vision trwała za długo. Spróbuj ponownie.",
      );
    }
    if (response.status === 502 || response.status === 503) {
      throw new Error(
        `Serwer niedostępny (HTTP ${response.status}). Spróbuj za chwilę.`,
      );
    }
    const snippet = trimmed.slice(0, 120).replace(/\s+/g, " ");
    throw new Error(
      `Niepoprawna odpowiedź serwera (HTTP ${response.status}): ${snippet}`,
    );
  }
}
