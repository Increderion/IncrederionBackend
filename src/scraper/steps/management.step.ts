import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';
import { FirecrawlService } from '../../firecrawl/firecrawl.service';
import { CompanyRow } from '../../companies/company-row.type';
import { FindingInsert } from './registry.step';

/**
 * Extracts management/board members from registry markdown (simple heuristics),
 * searches for them in rejestr.io to find other companies they appear in,
 * and persists results in company_persons + report_findings.
 */
@Injectable()
export class ManagementStep {
  private readonly logger = new Logger(ManagementStep.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly firecrawl: FirecrawlService,
  ) {}

  async run(reportId: string, company: CompanyRow): Promise<FindingInsert[]> {
    const findings: FindingInsert[] = [];

    // Extract names from registry markdown (stored from registry step)
    const names = this.extractNames(company.registry_raw_markdown ?? '');
    if (!names.length) {
      this.logger.debug(`[management] no names found for ${company.name}`);
      return [];
    }

    for (const name of names.slice(0, 5)) {
      // cap at 5 persons per report
      const q = encodeURIComponent(name.trim());
      const url = `https://rejestr.io/szukaj-osoby?phrase=${q}`;
      this.logger.debug(`[management] cross-ref: ${name}`);

      try {
        const result = await this.firecrawl.scrapeUrl(url);
        if (!result.markdown.trim()) continue;

        // Persist to company_persons
        await this.upsertPerson(company.id, name, result.markdown);

        findings.push({
          report_id: reportId,
          company_id: company.id,
          category: 'management',
          severity: 'info',
          title: `Zarząd/Wspólnik: ${name}`,
          summary: result.markdown.slice(0, 500),
          url: result.url,
          source: 'rejestr.io (osoby)',
          raw_markdown: result.markdown,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn(`[management] ${name} failed: ${msg}`);
      }
    }

    return findings;
  }

  /**
   * Very simple heuristic: look for lines that look like person names
   * next to known Polish role keywords.
   */
  private extractNames(markdown: string): string[] {
    const ROLE_PATTERN =
      /(?:prezes|wiceprezes|prokurent|wspólnik|członek zarządu|dyrektor)[:\s]+([A-ZŁÓŚĄĘŹŻŃ][a-złóśąęźżń]+ [A-ZŁÓŚĄĘŹŻŃ][a-złóśąęźżń]+(?:\s[A-ZŁÓŚĄĘŹŻŃ][a-złóśąęźżń]+)?)/gi;

    const names: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = ROLE_PATTERN.exec(markdown)) !== null) {
      const name = match[1].trim();
      if (!names.includes(name)) {
        names.push(name);
      }
    }
    return names;
  }

  private async upsertPerson(
    companyId: string,
    fullName: string,
    markdown: string,
  ) {
    // Extract other companies from markdown (placeholder – AI will improve this)
    const otherCompanies: unknown[] = [];

    const { error } = await this.supabase
      .getServiceRoleClient()
      .from('company_persons')
      .upsert(
        {
          company_id: companyId,
          full_name: fullName,
          other_companies: otherCompanies,
        },
        { onConflict: 'company_id,full_name' },
      );

    if (error) {
      this.logger.warn(`[management] upsertPerson failed: ${error.message}`);
    }
  }
}
