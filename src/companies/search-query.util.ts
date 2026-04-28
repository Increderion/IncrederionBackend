const digits = (s: string) => s.replace(/\D/g, '');

export type ParsedSearchQuery = {
  raw: string;
  nip: string | null;
  krs: string | null;
  regon: string | null;
  nameLike: string | null;
};

/**
 * Lekka heurystyka: NIP 10 cyfr, KRS zwykle 10 cyfr, REGON 9 lub 14.
 * Jeśli nic nie pasuje, zwracamy frazę pod ilike (nazwa).
 */
export function parseCompanySearchInput(input: string): ParsedSearchQuery {
  const raw = input.trim();
  if (!raw) {
    return { raw, nip: null, krs: null, regon: null, nameLike: null };
  }
  const d = digits(raw);

  if (d.length === 10) {
    // KRS-y w Polsce zaczynają się od zer (np. 0000123456)
    if (d.startsWith('00') || /krs/i.test(raw)) {
      return { raw, nip: null, krs: d, regon: null, nameLike: null };
    }
    return { raw, nip: d, krs: null, regon: null, nameLike: null };
  }
  if (d.length === 9 || d.length === 14) {
    return { raw, nip: null, krs: null, regon: d, nameLike: null };
  }
  if (d.length >= 7 && d.length < 10) {
    if (/krs|sąd|sad|rejestr/i.test(raw)) {
      return { raw, nip: null, krs: d.padStart(10, '0'), regon: null, nameLike: null };
    }
  }

  const limited = raw.slice(0, 200);
  return { raw, nip: null, krs: null, regon: null, nameLike: limited };
}

export function buildRegistrySearchUrl(phrase: string): string {
  const template = process.env.REJESTR_IO_SEARCH_URL_TEMPLATE;
  const q = encodeURIComponent(phrase.trim() || ' ');
  if (template) {
    return template.replaceAll('{q}', q);
  }
  return `https://rejestr.io?phrase=${q}`;
}
