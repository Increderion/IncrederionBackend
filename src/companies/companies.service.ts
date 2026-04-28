import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';
import { FirecrawlService } from '../firecrawl/firecrawl.service';
import { AiService } from '../ai/ai.service';
import { CompanyRow } from './company-row.type';
import { SearchCompanyDto } from './dto/search-company.dto';
import { REGISTRY_EXTRACTION_SYSTEM, REGISTRY_EXTRACTION_USER } from '../ai/prompts/registry-extraction.prompt';
import {
  type ParsedSearchQuery,
  parseCompanySearchInput,
} from './search-query.util';

@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly firecrawl: FirecrawlService,
    private readonly ai: AiService,
  ) {}

  async getById(companyId: string): Promise<CompanyRow> {
    const { data, error } = await this.supabase
      .getServiceRoleClient()
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new NotFoundException('Company not found.');
    return data as CompanyRow;
  }

  async search(dto: SearchCompanyDto): Promise<{ company: CompanyRow; created: boolean }> {
    const parsed = parseCompanySearchInput(dto.query);
    const existing = await this.findExistingCompany(parsed);
    if (existing) {
      return { company: existing, created: false };
    }

    this.logger.log(`[companies] not in DB — creating draft for: ${dto.query}`);
    
    // Create a draft company immediately to allow instant redirection
    const { data, error } = await this.companiesTable()
      .insert({
        name: parsed.nameLike || dto.query,
        nip: parsed.nip || null,
        krs: parsed.krs || null,
        regon: parsed.regon || null,
        registry_sync_status: 'pending',
      })
      .select('*')
      .single();

    if (error || !data) throw new Error(error?.message ?? 'Failed to create draft company');
    
    return { company: data as CompanyRow, created: true };
  }

  /**
   * Search companies for autocomplete (no side effects).
   */
  async list(dto: SearchCompanyDto): Promise<CompanyRow[]> {
    const parsed = parseCompanySearchInput(dto.query);
    
    let q = this.companiesTable().select('*');

    if (parsed.nip) q = q.eq('nip', parsed.nip);
    else if (parsed.krs) q = q.eq('krs', parsed.krs);
    else if (parsed.regon) q = q.eq('regon', parsed.regon);
    else if (parsed.nameLike) q = q.ilike('name', `%${parsed.nameLike}%`);
    else return [];

    const { data, error } = await q.limit(10);
    if (error) throw new Error(error.message);
    return (data || []) as CompanyRow[];
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private companiesTable() {
    return this.supabase.getServiceRoleClient().from('companies');
  }

  private async findExistingCompany(parsed: ParsedSearchQuery): Promise<CompanyRow | null> {
    if (parsed.nip) {
      const { data, error } = await this.companiesTable().select('*').eq('nip', parsed.nip).maybeSingle();
      if (error) throw new Error(error.message);
      if (data) return data as CompanyRow;
    }
    if (parsed.krs) {
      const { data, error } = await this.companiesTable().select('*').eq('krs', parsed.krs).maybeSingle();
      if (error) throw new Error(error.message);
      if (data) return data as CompanyRow;
    }
    if (parsed.regon) {
      const { data, error } = await this.companiesTable().select('*').eq('regon', parsed.regon).maybeSingle();
      if (error) throw new Error(error.message);
      if (data) return data as CompanyRow;
    }
    if (parsed.nameLike) {
      const safe = parsed.nameLike.replace(/[%_]/g, ' ');
      const { data, error } = await this.companiesTable()
        .select('*').ilike('name', `%${safe}%`).limit(1).maybeSingle();
      if (error) throw new Error(error.message);
      if (data) return data as CompanyRow;
    }
    return null;
  }

  /**
   * Scrape rejestr.io, AI-extract structured fields, save to DB.
   */
  private async scrapeAndCreate(query: string, parsed: ParsedSearchQuery): Promise<CompanyRow> {
    const rejestrUrl = await this.resolveRejestrUrl(query, parsed);
    if (!rejestrUrl) {
      throw new NotFoundException(`Nie znaleziono firmy "${query}" w rejestr.io`);
    }

    this.logger.debug(`[companies] scraping: ${rejestrUrl}`);
    const scraped = await this.firecrawl.scrapeUrl(rejestrUrl);

    // AI extracts structured data from the page
    let extracted: Record<string, any> = {};
    try {
      const aiResponse = await this.ai.chat([
        { role: 'system', content: REGISTRY_EXTRACTION_SYSTEM },
        { role: 'user', content: REGISTRY_EXTRACTION_USER(scraped.markdown, scraped.url) },
      ]);
      const match = aiResponse.match(/\{[\s\S]*\}/);
      extracted = JSON.parse(match ? match[0] : aiResponse);
    } catch (err) {
      this.logger.warn(`[companies] AI extraction failed: ${err}`);
    }

    // Insert only base columns (registry_* columns have stale PostgREST schema cache)
    const baseRow = {
      name: extracted.name || parsed.nameLike || query,
      nip: extracted.nip || parsed.nip || null,
      krs: extracted.krs || parsed.krs || null,
      regon: extracted.regon || parsed.regon || null,
      legal_form: extracted.legal_form || null,
      industry: extracted.industry || null,
      registration_date: extracted.registration_date || null,
      president_name: extracted.president_name || null,
    };

    const { data, error } = await this.supabase
      .getServiceRoleClient()
      .from('companies')
      .insert(baseRow)
      .select('*')
      .single();

    if (error) throw new Error(`DB insert failed: ${error.message}`);
    const company = data as CompanyRow;

    // Best-effort UPDATE for registry columns (might fail if schema cache still stale)
    await this.supabase
      .getServiceRoleClient()
      .from('companies')
      .update({
        registry_raw_markdown: scraped.markdown,
        registry_raw_metadata: scraped.rawResponse as Record<string, unknown>,
        registry_source_url: scraped.url,
        registry_sync_status: 'ok',
        last_registry_sync_at: new Date().toISOString(),
        registry_sync_error: null,
      } as never)
      .eq('id', company.id);

    return { ...company, registry_raw_markdown: scraped.markdown, registry_source_url: scraped.url, registry_sync_status: 'ok' } as CompanyRow;
  }

  /**
   * Build the direct rejestr.io URL.
   * KRS known → direct URL. Otherwise → Google search to find it.
   */
  private async resolveRejestrUrl(query: string, parsed: ParsedSearchQuery): Promise<string | null> {
    if (parsed.krs) {
      return `https://rejestr.io/krs/${parsed.krs}`;
    }

    const key = parsed.nip ?? parsed.regon ?? parsed.nameLike ?? query;
    this.logger.debug(`[companies] Google search for rejestr.io: ${key}`);

    try {
      const googleResult = await this.firecrawl.scrapeUrl(
        `https://www.google.com/search?q=site:rejestr.io+${encodeURIComponent(key)}`,
        { onlyMainContent: false },
      );
      const match = googleResult.markdown.match(/https:\/\/rejestr\.io\/krs\/[\w/%-]+/);
      return match ? match[0].split('#')[0] : null;
    } catch {
      return null;
    }
  }
}
