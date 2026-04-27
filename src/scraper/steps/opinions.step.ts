import { Injectable, Logger } from '@nestjs/common';
import { FirecrawlService } from '../../firecrawl/firecrawl.service';
import { CompanyRow } from '../../companies/company-row.type';
import { FindingInsert } from './registry.step';

const OPINION_SOURCES: Array<{ label: string; urlTemplate: string }> = [
  {
    label: 'Google Opinie',
    urlTemplate:
      'https://www.google.com/search?q={q}+opinie+firma&hl=pl&gl=pl',
  },
  {
    label: 'Trustpilot',
    urlTemplate: 'https://www.trustpilot.com/search?query={q}',
  },
];

@Injectable()
export class OpinionsStep {
  private readonly logger = new Logger(OpinionsStep.name);

  constructor(private readonly firecrawl: FirecrawlService) {}

  async run(reportId: string, company: CompanyRow): Promise<FindingInsert[]> {
    const q = encodeURIComponent(company.name.trim());
    const findings: FindingInsert[] = [];

    for (const src of OPINION_SOURCES) {
      const url = src.urlTemplate.replace('{q}', q);
      this.logger.debug(`[opinions] ${url}`);

      try {
        const result = await this.firecrawl.scrapeUrl(url);
        if (!result.markdown.trim()) continue;

        findings.push({
          report_id: reportId,
          company_id: company.id,
          category: 'opinion',
          severity: 'info',
          title: `${src.label}: ${company.name}`,
          summary: result.markdown.slice(0, 500),
          url: result.url,
          source: src.label,
          raw_markdown: result.markdown,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn(`[opinions] ${src.label} failed: ${msg}`);
      }
    }

    return findings;
  }
}
