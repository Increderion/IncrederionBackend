import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';
import { CompanyRow } from './company-row.type';
import { SearchCompanyDto } from './dto/search-company.dto';
import {
  type ParsedSearchQuery,
  parseCompanySearchInput,
} from './search-query.util';

@Injectable()
export class CompaniesService {
  constructor(private readonly supabase: SupabaseService) {}

  async getById(companyId: string): Promise<CompanyRow> {
    const { data, error } = await this.supabase
      .getServiceRoleClient()
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    if (!data) {
      throw new NotFoundException('Company not found.');
    }
    return data as CompanyRow;
  }

  /**
   * Find company in DB by NIP/KRS/REGON/name.
   * If not found, create a draft record.
   * Does NOT trigger Firecrawl – that is the ScraperPipeline's job.
   */
  async search(dto: SearchCompanyDto): Promise<{
    company: CompanyRow;
    created: boolean;
  }> {
    const parsed = parseCompanySearchInput(dto.query);
    const existing = await this.findExistingCompany(parsed);

    if (existing) {
      return { company: existing, created: false };
    }

    const created = await this.createDraftCompany(dto.query, parsed);
    return { company: created as CompanyRow, created: true };
  }

  private companiesTable() {
    return this.supabase.getServiceRoleClient().from('companies');
  }

  private async findExistingCompany(
    parsed: ParsedSearchQuery,
  ): Promise<CompanyRow | null> {
    if (parsed.nip) {
      const { data, error } = await this.companiesTable()
        .select('*')
        .eq('nip', parsed.nip)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (data) return data as CompanyRow;
    }

    if (parsed.krs) {
      const { data, error } = await this.companiesTable()
        .select('*')
        .eq('krs', parsed.krs)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (data) return data as CompanyRow;
    }

    if (parsed.regon) {
      const { data, error } = await this.companiesTable()
        .select('*')
        .eq('regon', parsed.regon)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (data) return data as CompanyRow;
    }

    if (parsed.nameLike) {
      const safe = parsed.nameLike.replace(/[%_]/g, ' ');
      const { data, error } = await this.companiesTable()
        .select('*')
        .ilike('name', `%${safe}%`)
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (data) return data as CompanyRow;
    }

    return null;
  }

  private async createDraftCompany(
    displayQuery: string,
    parsed: ParsedSearchQuery,
  ): Promise<CompanyRow> {
    const baseName = (parsed.nameLike ?? displayQuery).trim().slice(0, 200);
    const row = {
      name: baseName || 'Bez nazwy',
      nip: parsed.nip,
      krs: parsed.krs,
      regon: parsed.regon,
      legal_form: null,
      industry: null,
      registration_date: null,
      president_name: null,
      registry_sync_status: 'pending',
    };

    const { data, error } = await this.supabase
      .getServiceRoleClient()
      .from('companies')
      .insert(row)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return data as CompanyRow;
  }
}
