import {
  IsIn,
  IsOptional,
  IsUUID,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ListReportsQueryDto {
  /** Filter by pipeline status */
  @IsOptional()
  @IsIn(['pending', 'running', 'completed', 'failed'])
  status?: string;

  /** Filter by company id */
  @IsOptional()
  @IsUUID()
  company_id?: string;

  /** Page number (1-based) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  /** Items per page */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
