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

import { AiService } from '../../ai/ai.service';
import { REGISTRY_EXTRACTION_SYSTEM, REGISTRY_EXTRACTION_USER } from '../../ai/prompts/registry-extraction.prompt';

@Injectable()
export class RegistryStep {
  private readonly logger = new Logger(RegistryStep.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly firecrawl: FirecrawlService,
    private readonly aiService: AiService,
  ) { }

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

      let extractedData: Record<string, any> = {};
      try {
        const aiResponse = await this.aiService.chat([
          { role: 'system', content: REGISTRY_EXTRACTION_SYSTEM },
          { role: 'user', content: REGISTRY_EXTRACTION_USER(result.markdown, result.url) },
        ]);
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        extractedData = JSON.parse(jsonMatch ? jsonMatch[0] : aiResponse);
      } catch (err) {
        this.logger.warn(`[registry] AI extraction failed: ${err}`);
      }

      //Also update company's raw registry fields + extracted fields
      await this.supabase
        .getServiceRoleClient()
        .from('companies')
        .update({
          name: extractedData.name || company.name,
          nip: extractedData.nip || company.nip,
          krs: extractedData.krs || company.krs,
          regon: extractedData.regon || company.regon,
          legal_form: extractedData.legal_form || company.legal_form,
          industry: extractedData.industry || company.industry,
          registration_date: extractedData.registration_date || company.registration_date,
          president_name: extractedData.president_name || company.president_name,
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
