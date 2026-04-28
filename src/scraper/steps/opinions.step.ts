import { Injectable, Logger } from '@nestjs/common';
import { FirecrawlService } from '../../firecrawl/firecrawl.service';
import { CompanyRow } from '../../companies/company-row.type';
import { FindingInsert } from './registry.step';

const OPINION_SOURCES = [
  {
    label: 'Trustpilot',
    searchDomain: 'trustpilot.com/review',
    searchQuery: 'site:trustpilot.com/review',
    urlRegex: /https:\/\/pl\.trustpilot\.com\/review\/[\w.-]+/,
    fallbackRegex: /https:\/\/(www\.)?trustpilot\.com\/review\/[\w.-]+/,
  },
  {
    label: 'GoWork',
    searchDomain: 'gowork.pl/opinie',
    searchQuery: 'site:gowork.pl/opinie',
    urlRegex: /https:\/\/www\.gowork\.pl\/opinie_czytaj,[\d]+/,
    fallbackRegex: /https:\/\/www\.gowork\.pl\/opinie\/[\w-]+;[\d]+/,
  },
];

@Injectable()
export class OpinionsStep {
  private readonly logger = new Logger(OpinionsStep.name);

  constructor(private readonly firecrawl: FirecrawlService) {}

  async run(reportId: string, company: CompanyRow): Promise<FindingInsert[]> {
    const key = company.name ?? company.nip ?? '';
    if (!key.trim()) return [];

    const findings: FindingInsert[] = [];

    for (const src of OPINION_SOURCES) {
      this.logger.debug(`[opinions] searching Google for ${src.label}: ${key}`);
      let urlToScrape: string | null = null;

      try {
        const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(`${src.searchQuery} "${key}"`)}`;
        const googleResult = await this.firecrawl.scrapeUrl(googleUrl);
        
        let match = googleResult.markdown.match(src.urlRegex);
        if (!match) {
           match = googleResult.markdown.match(src.fallbackRegex);
        }

        if (match) {
          urlToScrape = match[0].split('#')[0].split(']')[0].split(')')[0]; // Clean up markdown formatting artifacts
        }
      } catch (e) {
        this.logger.warn(`[opinions] Google search failed for ${src.label}: ${e}`);
      }

      if (!urlToScrape) {
        this.logger.debug(`[opinions] no exact link found for ${src.label}`);
        continue;
      }

      this.logger.debug(`[opinions] scraping exact ${src.label} URL: ${urlToScrape}`);

      try {
        const result = await this.firecrawl.scrapeUrl(urlToScrape);
        if (!result.markdown.trim()) continue;

        findings.push({
          report_id: reportId,
          company_id: company.id,
          category: 'opinion',
          severity: 'info',
          title: `Opinie ${src.label}`,
          summary: result.markdown.slice(0, 500),
          url: result.url,
          source: src.label,
          raw_markdown: result.markdown,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn(`[opinions] scraping ${src.label} failed: ${msg}`);
      }
    }

    return findings;
  }
}

