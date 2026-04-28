import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';
import { CompaniesService } from '../companies/companies.service';
import { ScraperPipelineService } from '../scraper/scraper-pipeline.service';
import { CompanyRow } from '../companies/company-row.type';
import { CreateReportDto } from './dto/create-report.dto';
import { ListReportsQueryDto } from './dto/list-reports-query.dto';

export interface ReportRow {
  id: string;
  user_id: string;
  company_id: string;
  status: string;
  error: string | null;
  events_panels: any[];
  ai_summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportWithDetails extends ReportRow {
  company: CompanyRow;
  findings: unknown[];
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly companies: CompaniesService,
    private readonly pipeline: ScraperPipelineService,
  ) {}

  /**
   * Create a new KYC report for a user.
   * 1. Find or create company by query (NIP/KRS/name/etc.)
   * 2. Insert report record (status: pending)
   * 3. Kick off pipeline fire-and-forget
   */
  async create(
    userId: string,
    dto: CreateReportDto,
  ): Promise<{ reportId: string; status: string; company: CompanyRow }> {
    // Find or create company (sync=false: don't run old Firecrawl logic here)
    const { company } = await this.companies.search({
      query: dto.query,
    });

    // Insert report
    const { data, error } = await this.supabase
      .getServiceRoleClient()
      .from('reports')
      .insert({
        user_id: userId,
        company_id: company.id,
        status: 'pending',
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? 'Failed to create report');
    }

    const report = data as ReportRow;

    // Fire-and-forget pipeline (intentionally not awaited)
    void this.pipeline.run(report.id, company);

    return { reportId: report.id, status: report.status, company };
  }

  /**
   * List reports for the authenticated user with optional filters.
   */
  async listForUser(
    userId: string,
    query: ListReportsQueryDto,
  ): Promise<{ data: ReportRow[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let q = this.supabase
      .getServiceRoleClient()
      .from('reports')
      .select('*, companies(id, name, nip, krs)', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (query.status) {
      q = q.eq('status', query.status);
    }
    if (query.company_id) {
      q = q.eq('company_id', query.company_id);
    }

    const { data, error, count } = await q;

    if (error) {
      throw new Error(error.message);
    }

    return {
      data: (data ?? []) as unknown as ReportRow[],
      total: count ?? 0,
      page,
      limit,
    };
  }

  /**
   * Get a single report with all findings (carousel).
   * Throws 404 if not found, 403 if owned by another user.
   */
  async getWithFindings(
    userId: string,
    reportId: string,
  ): Promise<ReportWithDetails> {
    const { data: report, error } = await this.supabase
      .getServiceRoleClient()
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!report) throw new NotFoundException('Report not found.');

    const row = report as ReportRow;
    if (row.user_id !== userId) {
      throw new ForbiddenException('Access denied.');
    }

    // Fetch company
    const { data: companyData } = await this.supabase
      .getServiceRoleClient()
      .from('companies')
      .select('*')
      .eq('id', row.company_id)
      .single();

    // Fetch findings ordered by severity then created_at
    const { data: findings } = await this.supabase
      .getServiceRoleClient()
      .from('report_findings')
      .select('*')
      .eq('report_id', reportId)
      .order('created_at', { ascending: true });

    return {
      ...row,
      company: companyData as CompanyRow,
      findings: findings ?? [],
    };
  }

  /**
   * Delete a report owned by the user (cascades findings).
   */
  async delete(userId: string, reportId: string): Promise<void> {
    const { data, error } = await this.supabase
      .getServiceRoleClient()
      .from('reports')
      .select('user_id')
      .eq('id', reportId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new NotFoundException('Report not found.');
    if ((data as { user_id: string }).user_id !== userId) {
      throw new ForbiddenException('Access denied.');
    }

    await this.supabase
      .getServiceRoleClient()
      .from('reports')
      .delete()
      .eq('id', reportId);
  }
}
