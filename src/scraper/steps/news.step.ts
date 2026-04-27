import { Injectable, Logger } from '@nestjs/common';
import { FirecrawlService } from '../../firecrawl/firecrawl.service';
import { CompanyRow } from '../../companies/company-row.type';
import { FindingInsert } from './registry.step';

const NEWS_SOURCES: Array<{ label: string; urlTemplate: string }> = [
  {
    label: 'Google News',
    urlTemplate:
      'https://www.google.com/search?q={q}&tbm=nws&hl=pl&gl=pl',
  },
  {
    label: 'Bing News',
    urlTemplate: 'https://www.bing.com/news/search?q={q}&setlang=pl',
  },
];

@Injectable()
export class NewsStep {
  private readonly logger = new Logger(NewsStep.name);

  constructor(private readonly firecrawl: FirecrawlService) {}

  async run(reportId: string, company: CompanyRow): Promise<FindingInsert[]> {
    const q = encodeURIComponent(company.name.trim());
    const findings: FindingInsert[] = [];

    for (const src of NEWS_SOURCES) {
      const url = src.urlTemplate.replace('{q}', q);
      this.logger.debug(`[news] ${url}`);

      try {
        const result = await this.firecrawl.scrapeUrl(url);
        if (!result.markdown.trim()) continue;

        findings.push({
          report_id: reportId,
          company_id: company.id,
          category: 'news',
          severity: 'info',
          title: `${src.label}: ${company.name}`,
          summary: result.markdown.slice(0, 500),
          url: result.url,
          source: src.label,
          raw_markdown: result.markdown,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn(`[news] ${src.label} failed: ${msg}`);
      }
    }

    return findings;
  }
}
