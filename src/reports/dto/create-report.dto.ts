import {
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
} from 'class-validator';

export class CreateReportDto {
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  query: string;
}
