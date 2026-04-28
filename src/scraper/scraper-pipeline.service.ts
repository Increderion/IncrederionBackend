import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';
import { CompanyRow } from '../companies/company-row.type';
import { OpinionsStep } from './steps/opinions.step';
import { NewsStep } from './steps/news.step';
import { ManagementStep } from './steps/management.step';
import { AiService } from '../ai/ai.service';
import { KYC_SUMMARY_SYSTEM, KYC_SUMMARY_USER } from '../ai/prompts/kyc-summary.prompt';

@Injectable()
export class ScraperPipelineService {
  private readonly logger = new Logger(ScraperPipelineService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly opinionsStep: OpinionsStep,
    private readonly newsStep: NewsStep,
    private readonly managementStep: ManagementStep,
    private readonly aiService: AiService,
  ) {}

  /**
   * Fire-and-forget: caller does NOT await this method.
   * Company data is already scraped at search time — pipeline only runs
   * opinions, news, management cross-ref and AI summary.
   */
  async run(reportId: string, company: CompanyRow): Promise<void> {
    this.logger.log(`Pipeline start: report=${reportId} company=${company.id}`);

    await this.setStatus(reportId, 'running');

    try {
      // ── Step A: Opinions ────────────────────────────────────────────────
      const opinionFindings = await this.opinionsStep.run(reportId, company);

      // ── Step B: News ─────────────────────────────────────────────────────
      const newsFindings = await this.newsStep.run(reportId, company);

      // ── Step C: Management cross-ref ─────────────────────────────────────
      const managementFindings = await this.managementStep.run(reportId, company);

      // ── Persist all findings ─────────────────────────────────────────────
      const allFindings = [
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
   * AI enrichment hook
   */
  private async enrichWithAi(reportId: string): Promise<void> {
    try {
      this.logger.debug(`[AI] Starting enrichment for report ${reportId}`);

      const { data: findings } = await this.supabase
        .getServiceRoleClient()
        .from('report_findings')
        .select('*')
        .eq('report_id', reportId);

      if (!findings || findings.length === 0) {
        this.logger.warn(`[AI] No findings for report ${reportId}, skipping AI.`);
        return;
      }

      // We need to strip the findings down to avoid too large prompts
      const aiResponse = await this.aiService.chat([
        { role: 'system', content: KYC_SUMMARY_SYSTEM },
        { role: 'user', content: KYC_SUMMARY_USER(findings) },
      ]);

      // Parse JSON
      let result;
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0]);
        } else {
          result = JSON.parse(aiResponse);
        }
      } catch (err) {
        this.logger.error(`[AI] Failed to parse JSON: ${aiResponse}`);
        throw new Error('AI returned invalid JSON');
      }

      // Update reports table
      await this.supabase
        .getServiceRoleClient()
        .from('reports')
        .update({
          events_panels: result.events_panels || [],
          ai_summary: result.ai_summary || 'Brak podsumowania',
        } as never)
        .eq('id', reportId);

      this.logger.log(`[AI] Enrichment complete for report ${reportId}`);
    } catch (error) {
      this.logger.error(`[AI] Enrichment failed: ${error}`);
    }
  }
}
