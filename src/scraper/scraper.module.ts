import { Module } from '@nestjs/common';
import { FirecrawlModule } from '../firecrawl/firecrawl.module';
import { ScraperPipelineService } from './scraper-pipeline.service';
import { RegistryStep } from './steps/registry.step';
import { OpinionsStep } from './steps/opinions.step';
import { NewsStep } from './steps/news.step';
import { ManagementStep } from './steps/management.step';

import { AiModule } from '../ai/ai.module';

@Module({
  imports: [FirecrawlModule, AiModule],
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
