import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { CompaniesModule } from './companies/companies.module';
import { DatabaseModule } from './database/database.module';
import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [DatabaseModule, AuthModule, CompaniesModule, ReportsModule, AiModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
