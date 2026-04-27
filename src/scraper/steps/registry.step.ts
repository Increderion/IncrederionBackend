import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';
import { FirecrawlService } from '../../firecrawl/firecrawl.service';
import { CompanyRow } from '../../companies/company-row.type';

export type FindingCategory = 'registry' | 'opinion' | 'news' | 'management';
export type FindingSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export interface FindingInsert {
  report_id: string;
  company_id: string;
  category: FindingCategory;
  severity: FindingSeverity;
  title: string;
  summary?: string;
  url?: string;
  source?: string;
  published_at?: string;
  raw_markdown?: string;
}

@Injectable()
export class RegistryStep {
  private readonly logger = new Logger(RegistryStep.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly firecrawl: FirecrawlService,
  ) {}

  async run(
    reportId: string,
    company: CompanyRow,
  ): Promise<FindingInsert[]> {
    const key =
      company.nip ?? company.krs ?? company.regon ?? company.name ?? '';
    const q = encodeURIComponent(key.trim());
    const url = process.env.REJESTR_IO_SEARCH_URL_TEMPLATE
      ? process.env.REJESTR_IO_SEARCH_URL_TEMPLATE.replaceAll('{q}', q)
      : `https://rejestr.io?phrase=${q}`;

    this.logger.debug(`[registry] ${url}`);

    try {
      const result = await this.firecrawl.scrapeUrl(url);

      // Also update company's raw registry fields
      await this.supabase
        .getServiceRoleClient()
        .from('companies')
        .update({
          registry_raw_markdown: result.markdown,
          registry_raw_metadata: result.rawResponse as Record<string, unknown>,
          registry_source_url: result.url,
          registry_sync_status: 'success',
          last_registry_sync_at: new Date().toISOString(),
          registry_sync_error: null,
        } as never)
        .eq('id', company.id);

      return [
        {
          report_id: reportId,
          company_id: company.id,
          category: 'registry',
          severity: 'info',
          title: `Dane rejestrowe: ${company.name}`,
          summary: result.markdown.slice(0, 500) || 'Brak treści.',
          url: result.url,
          source: 'rejestr.io',
          raw_markdown: result.markdown,
        },
      ];
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`[registry] failed: ${msg}`);
      return [
        {
          report_id: reportId,
          company_id: company.id,
          category: 'registry',
          severity: 'low',
          title: 'Błąd pobierania danych rejestrowych',
          summary: msg,
          source: 'rejestr.io',
        },
      ];
    }
  }
}
