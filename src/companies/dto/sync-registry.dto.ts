import { IsOptional, IsUrl } from 'class-validator';

export class SyncRegistryDto {
  @IsOptional()
  @IsUrl({ require_tld: false })
  url?: string;
}
