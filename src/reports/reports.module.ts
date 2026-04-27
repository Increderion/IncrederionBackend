import { Module } from '@nestjs/common';
import { CompaniesModule } from '../companies/companies.module';
import { ScraperModule } from '../scraper/scraper.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [CompaniesModule, ScraperModule],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
