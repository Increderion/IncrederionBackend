import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';
import { CompanyRow } from '../companies/company-row.type';
import { RegistryStep } from './steps/registry.step';
import { OpinionsStep } from './steps/opinions.step';
import { NewsStep } from './steps/news.step';
import { ManagementStep } from './steps/management.step';

@Injectable()
export class ScraperPipelineService {
  private readonly logger = new Logger(ScraperPipelineService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly registryStep: RegistryStep,
    private readonly opinionsStep: OpinionsStep,
    private readonly newsStep: NewsStep,
    private readonly managementStep: ManagementStep,
  ) {}

  /**
   * Fire-and-forget: caller does NOT await this method.
   * Updates report status to running → runs all steps → completed / failed.
   */
  async run(reportId: string, company: CompanyRow): Promise<void> {
    this.logger.log(`Pipeline start: report=${reportId} company=${company.id}`);

    await this.setStatus(reportId, 'running');

    try {
      // ── Step A: Registry ────────────────────────────────────────────────
      const registryFindings = await this.registryStep.run(reportId, company);

      // Reload company after registry step (markdown now populated)
      const { data: refreshedCompany } = await this.supabase
        .getServiceRoleClient()
        .from('companies')
        .select('*')
        .eq('id', company.id)
        .single();
      const enrichedCompany = (refreshedCompany as CompanyRow) ?? company;

      // ── Step B: Opinions ────────────────────────────────────────────────
      const opinionFindings = await this.opinionsStep.run(
        reportId,
        enrichedCompany,
      );

      // ── Step C: News ─────────────────────────────────────────────────────
      const newsFindings = await this.newsStep.run(reportId, enrichedCompany);

      // ── Step D: Management cross-ref ─────────────────────────────────────
      const managementFindings = await this.managementStep.run(
        reportId,
        enrichedCompany,
      );

      // ── Persist all findings ─────────────────────────────────────────────
      const allFindings = [
        ...registryFindings,
        ...opinionFindings,
        ...newsFindings,
        ...managementFindings,
      ];

      if (allFindings.length > 0) {
        const { error } = await this.supabase
          .getServiceRoleClient()
          .from('report_findings')
          .insert(allFindings);
        if (error) {
          throw new Error(`Failed to insert findings: ${error.message}`);
        }
      }

      // ── AI hook (placeholder – colleague's module fills this) ─────────────
      await this.enrichWithAi(reportId);

      // ── Mark completed ────────────────────────────────────────────────────
      await this.setStatus(reportId, 'completed');
      this.logger.log(
        `Pipeline done: report=${reportId} findings=${allFindings.length}`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`Pipeline failed: report=${reportId} error=${msg}`);
      await this.setStatus(reportId, 'failed', msg);
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async setStatus(
    reportId: string,
    status: string,
    error?: string,
  ): Promise<void> {
    await this.supabase
      .getServiceRoleClient()
      .from('reports')
      .update({ status, error: error ?? null } as never)
      .eq('id', reportId);
  }

  /**
   * AI enrichment hook – intentionally empty for now.
   * Colleague's AI module will implement:
   *   1. Read report_findings.raw_markdown
   *   2. Generate summaries / risk_score / ai_summary
   *   3. Update reports and report_findings records
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async enrichWithAi(_reportId: string): Promise<void> {
    // TODO: AI colleague implements this
    return;
  }
}
