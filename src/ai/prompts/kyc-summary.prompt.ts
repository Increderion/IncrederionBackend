/**
 * Prompt for generating KYC/AML risk score and summary.
 */

export const KYC_SUMMARY_SYSTEM = `Jesteś ekspertem ds. analizy ryzyka KYC/AML.
Na podstawie dostarczonych wyników scrapowania (rejestry, opinie, artykuły) wygeneruj listę "paneli zdarzeń" (events_panels), które reprezentują konkretne sygnały dla użytkownika (np. "oszustwa podatkowe", "pozytywne opinie", "braki w rejestrze").
Każdy panel powinien mieć krótką, czytelną etykietę ("label") będącą prostym znakiem dla użytkownika, krótki opis ("description") oraz poziom ważności ("severity": "info" | "low" | "medium" | "high" | "critical").
Zwracasz WYŁĄCZNIE poprawny JSON, zgodny ze schematem poniżej.
"ai_summary" ma być rzeczowym, profesjonalnym podsumowaniem znalezisk (max 3-4 zdania).`;

export const KYC_SUMMARY_USER = (findings: any[]) => {
  const context = findings
    .map(
      (f, idx) =>
        `--- Znalezisko #${idx + 1} [Kategoria: ${f.category}, Źródło: ${f.source}] ---\n${f.raw_markdown?.slice(0, 800) || f.summary}`,
    )
    .join('\n\n');

  return `Oto zebrane informacje o firmie:
  
${context}

Zwróć JSON o kształcie:
{
  "events_panels": [
    {
      "label": "Krótka etykieta np. Oszustwa podatkowe",
      "description": "Opis problemu lub pozytywnego sygnału",
      "severity": "info" | "low" | "medium" | "high" | "critical"
    }
  ],
  "ai_summary": "string"
}`;
};
