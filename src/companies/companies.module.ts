import { Module } from '@nestjs/common';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { FirecrawlModule } from '../firecrawl/firecrawl.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [FirecrawlModule, AiModule],
  controllers: [CompaniesController],
  providers: [CompaniesService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
