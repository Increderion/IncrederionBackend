import { Module } from '@nestjs/common';
import { FirecrawlModule } from '../firecrawl/firecrawl.module';
import { ScraperPipelineService } from './scraper-pipeline.service';
import { RegistryStep } from './steps/registry.step';
import { OpinionsStep } from './steps/opinions.step';
import { NewsStep } from './steps/news.step';
import { ManagementStep } from './steps/management.step';

@Module({
  imports: [FirecrawlModule],
  providers: [
    ScraperPipelineService,
    RegistryStep,
    OpinionsStep,
    NewsStep,
    ManagementStep,
  ],
  exports: [ScraperPipelineService],
})
export class ScraperModule {}
