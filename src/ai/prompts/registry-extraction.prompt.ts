export const REGISTRY_EXTRACTION_SYSTEM = `Jesteś asystentem do ekstrakcji danych firmy z polskich rejestrów (np. rejestr.io, KRS, CEIDG).
Zwracasz WYŁĄCZNIE poprawny JSON (bez markdown, bez komentarzy), zgodny ze schematem.
Pola, których nie znajdziesz, ustaw na null.
Daty w formacie ISO 8601 (YYYY-MM-DD) jeśli możliwe.
NIP, KRS, REGON tylko cyfry (bez spacji i myślników).
Jeśli tekst jest niejednoznaczny lub wygląda na stronę wyszukiwania z wieloma wynikami, ustaw "confidence" nisko i w "notes" opisz problem.`;

export const REGISTRY_EXTRACTION_USER = (markdown: string, sourceUrl: string) =>
  `Źródło (URL): ${sourceUrl}

Markdown strony:
---
${markdown}
---

Zwróć JSON o kształcie:
{
  "name": string | null,
  "nip": string | null,
  "krs": string | null,
  "regon": string | null,
  "legal_form": string | null,
  "industry": string | null,
  "registration_date": string | null,
  "president_name": string | null,
  "confidence": number,
  "notes": string | null
}`;
