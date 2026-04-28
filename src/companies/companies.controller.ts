import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SupabaseJwtGuard } from '../auth/supabase-jwt.guard';
import { CompaniesService } from './companies.service';
import { SearchCompanyDto } from './dto/search-company.dto';

@Controller('companies')
@UseGuards(SupabaseJwtGuard)
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  /**
   * POST /companies/search
   * Find or create a company by query (NIP/KRS/REGON/name).
   * Does NOT trigger scraping — use POST /reports for a full KYC report.
   */
  @Post('search')
  search(@Body() dto: SearchCompanyDto) {
    return this.companiesService.search(dto);
  }

  @Get('autocomplete/:query')
  autocomplete(@Param('query') query: string) {
    return this.companiesService.list({ query });
  }


  /**
   * GET /companies/:id
   * Get company details by ID.
   */
  @Get(':id')
  getOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.companiesService.getById(id);
  }
}
