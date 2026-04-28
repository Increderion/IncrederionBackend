import { Injectable, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private serviceRoleClient: SupabaseClient | null = null;

  getServiceRoleClient(): SupabaseClient {
    if (!this.serviceRoleClient) {
      const url = process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!url || !key) {
        this.logger.error('Missing Supabase credentials (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)');
        throw new Error('Supabase URL and Service Role Key are required for this backend operation');
      }

      this.serviceRoleClient = createClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });
    }

    return this.serviceRoleClient;
  }
}
