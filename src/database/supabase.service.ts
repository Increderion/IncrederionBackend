import { Injectable, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private serviceRoleClient: SupabaseClient | null = null;

  getServiceRoleClient(): SupabaseClient {
    if (!this.serviceRoleClient) {
      const url = process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;

      if (!url || !key) {
        this.logger.error('Missing Supabase credentials');
        throw new Error('Supabase URL and Key are required');
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
