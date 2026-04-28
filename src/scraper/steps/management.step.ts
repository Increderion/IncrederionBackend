import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';
import { FirecrawlService } from '../../firecrawl/firecrawl.service';
import { CompanyRow } from '../../companies/company-row.type';
import { FindingInsert } from './registry.step';

/**
 * Extracts management/board members from registry markdown (simple heuristics),
 * searches for them on rejestr.io via Google to find other companies they appear in.
 * Also searches social media for potential controversies.
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

    const names = this.extractNames(company.registry_raw_markdown ?? '');
    if (!names.length) {
      this.logger.debug(`[management] no names found for ${company.name}`);
      return [];
    }

    // Limit to top 3 members to avoid excessive scraping
    for (const name of names.slice(0, 3)) {
      this.logger.debug(`[management] processing: ${name}`);

      // ── Sub-step 1: Rejestr.io Cross-Reference ─────────────────────────────
      try {
        const googleUrl = `https://www.google.com/search?q=site:rejestr.io+osoba+${encodeURIComponent(name)}`;
        const googleResult = await this.firecrawl.scrapeUrl(googleUrl);
        const match = googleResult.markdown.match(/https:\/\/rejestr\.io\/osoby\/[\w/%-]+/);
        
        if (match) {
          const url = match[0].split('#')[0].split(']')[0].split(')')[0];
          const result = await this.firecrawl.scrapeUrl(url);
          
          if (result.markdown.trim()) {
            const otherCompanies = this.extractOtherCompanies(result.markdown);
            await this.upsertPerson(company.id, name, otherCompanies);

            findings.push({
              report_id: reportId,
              company_id: company.id,
              category: 'management',
              severity: otherCompanies.length > 0 ? 'medium' : 'info',
              title: `Powiązania biznesowe: ${name}`,
              summary: `Osoba występuje w ${otherCompanies.length} innych podmiotach. \n\n${result.markdown.slice(0, 1000)}`,
              url: result.url,
              source: 'rejestr.io (osoby)',
              raw_markdown: result.markdown,
            });
          }
        }
      } catch (e) {
        this.logger.warn(`[management] rejestr.io search failed for ${name}: ${e}`);
      }

      // ── Sub-step 2: Social Media & Controversies ───────────────────────────
      try {
        // Search for the person with keywords like "kontrowersje", "opinie", "twitter"
        const socialUrl = `https://www.google.com/search?q=${encodeURIComponent(`"${name}" (twitter OR facebook OR linkedin OR kontrowersje OR oszustwo)`)}`;
        const socialResult = await this.firecrawl.scrapeUrl(socialUrl);

        if (socialResult.markdown.trim()) {
          findings.push({
            report_id: reportId,
            company_id: company.id,
            category: 'management',
            severity: 'low',
            title: `Ślad cyfrowy: ${name}`,
            summary: socialResult.markdown.slice(0, 1000),
            url: socialResult.url,
            source: 'Google Search (Social/Alerts)',
            raw_markdown: socialResult.markdown,
          });
        }
      } catch (e) {
        this.logger.warn(`[management] social search failed for ${name}: ${e}`);
      }
    }

    return findings;
  }

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

  private extractOtherCompanies(markdown: string): any[] {
    // Simple heuristic to find company names/KRS numbers in the person's profile
    // Looking for patterns like "KRS: 0000..." or "NIP: ..." or names in quotes/caps
    const companies: any[] = [];
    const krsMatches = markdown.matchAll(/KRS\s*(\d{10})/g);
    for (const match of krsMatches) {
      companies.push({ krs: match[1] });
    }
    return companies;
  }

  private async upsertPerson(
    companyId: string,
    fullName: string,
    otherCompanies: any[],
  ) {
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

