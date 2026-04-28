import { Injectable, Logger } from '@nestjs/common';
import { FirecrawlService } from '../../firecrawl/firecrawl.service';
import { CompanyRow } from '../../companies/company-row.type';
import { FindingInsert } from './registry.step';

const NEWS_SOURCES = [
  {
    label: 'Bankier.pl',
    searchQuery: 'site:bankier.pl',
    urlRegex: /https:\/\/www\.bankier\.pl\/wiadomosc\/[\w-]+/,
    fallbackRegex: /https:\/\/www\.bankier\.pl\/[\w/-]+/,
  },
  {
    label: 'PAP Biznes',
    searchQuery: 'site:biznes.pap.pl',
    urlRegex: /https:\/\/biznes\.pap\.pl\/pl\/news\/[\w/-]+/,
    fallbackRegex: /https:\/\/biznes\.pap\.pl\/[\w/-]+/,
  },
];

@Injectable()
export class NewsStep {
  private readonly logger = new Logger(NewsStep.name);

  constructor(private readonly firecrawl: FirecrawlService) {}

  async run(reportId: string, company: CompanyRow): Promise<FindingInsert[]> {
    const key = company.name ?? company.nip ?? '';
    if (!key.trim()) return [];

    const findings: FindingInsert[] = [];

    for (const src of NEWS_SOURCES) {
      this.logger.debug(`[news] searching Google for ${src.label}: ${key}`);
      let urlToScrape: string | null = null;

      try {
        // We search for the company name on the specific portal
        const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(`${src.searchQuery} "${key}"`)}`;
        const googleResult = await this.firecrawl.scrapeUrl(googleUrl);
        
        // Try to find a specific news article or company profile
        let match = googleResult.markdown.match(src.urlRegex);
        if (!match) {
           match = googleResult.markdown.match(src.fallbackRegex);
        }

        if (match) {
          urlToScrape = match[0].split('#')[0].split(']')[0].split(')')[0];
        }
      } catch (e) {
        this.logger.warn(`[news] Google search failed for ${src.label}: ${e}`);
      }

      if (!urlToScrape) {
        // Fallback: if no specific URL found, try a broader search on the portal itself if possible
        // For MVP, we'll just skip or use a generic search URL if we wanted to
        this.logger.debug(`[news] no exact link found for ${src.label}`);
        continue;
      }

      this.logger.debug(`[news] scraping exact ${src.label} URL: ${urlToScrape}`);

      try {
        const result = await this.firecrawl.scrapeUrl(urlToScrape);
        if (!result.markdown.trim()) continue;

        findings.push({
          report_id: reportId,
          company_id: company.id,
          category: 'news',
          severity: 'info',
          title: `Wiadomości: ${src.label}`,
          summary: result.markdown.slice(0, 500),
          url: result.url,
          source: src.label,
          raw_markdown: result.markdown,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn(`[news] scraping ${src.label} failed: ${msg}`);
      }
    }

    // Fallback: search for general "oszustwa" if no news found? 
    // The user said "przykładowo podejrzenia o oszustwo".
    // Maybe a third source: general Google search for "nazwa firmy oszustwo"
    if (findings.length === 0) {
        this.logger.debug(`[news] no specific portal news, trying general alert search`);
        try {
            const alertUrl = `https://www.google.com/search?q=${encodeURIComponent(`"${key}" (oszustwo OR kontrowersje OR wyrok OR upadłość)`)}`;
            const alertResult = await this.firecrawl.scrapeUrl(alertUrl);
            if (alertResult.markdown.trim()) {
                findings.push({
                    report_id: reportId,
                    company_id: company.id,
                    category: 'news',
                    severity: 'low',
                    title: `Alerty i wzmianki: ${key}`,
                    summary: alertResult.markdown.slice(0, 800),
                    url: alertResult.url,
                    source: 'Google Search',
                    raw_markdown: alertResult.markdown,
                });
            }
        } catch (e) {
            this.logger.warn(`[news] alert search failed: ${e}`);
        }
    }

    return findings;
  }
}

