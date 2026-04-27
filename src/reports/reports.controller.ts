import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SupabaseJwtGuard, type AuthedRequest } from '../auth/supabase-jwt.guard';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { ListReportsQueryDto } from './dto/list-reports-query.dto';

@Controller('reports')
@UseGuards(SupabaseJwtGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /**
   * POST /reports
   * Create a new KYC report. Kicks off scraper pipeline in background.
   * Returns immediately with { reportId, status: 'pending', company }.
   */
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  create(@Req() req: AuthedRequest, @Body() dto: CreateReportDto) {
    return this.reportsService.create(req.user.id, dto);
  }

  /**
   * GET /reports
   * History of KYC reports for the authenticated user.
   * Query params: status, company_id, page, limit
   */
  @Get()
  list(@Req() req: AuthedRequest, @Query() query: ListReportsQueryDto) {
    return this.reportsService.listForUser(req.user.id, query);
  }

  /**
   * GET /reports/:id
   * Full report details with findings carousel.
   */
  @Get(':id')
  getOne(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reportsService.getWithFindings(req.user.id, id);
  }

  /**
   * DELETE /reports/:id
   * Remove a report from user's history (cascades findings).
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reportsService.delete(req.user.id, id);
  }
}
