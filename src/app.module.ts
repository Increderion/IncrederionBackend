import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CompaniesModule } from './companies/companies.module';
import { DatabaseModule } from './database/database.module';
import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [DatabaseModule, AuthModule, CompaniesModule, ReportsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
