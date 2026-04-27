import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { Request } from 'express';

export type AuthedRequest = Request & {
  user: { id: string; email?: string | null };
};

@Injectable()
export class SupabaseJwtGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers['authorization'] ?? req.headers['Authorization'];
    const value = Array.isArray(header) ? header[0] : header;
    if (!value || !value.toLowerCase().startsWith('bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header.');
    }
    const token = value.slice(7).trim();
    if (!token) {
      throw new UnauthorizedException('Missing access token.');
    }

    const url = process.env.SUPABASE_URL;
    const key =
      process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error('Supabase not configured for JWT validation.');
    }

    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      throw new UnauthorizedException('Invalid or expired access token.');
    }
    req.user = { id: data.user.id, email: data.user.email };
    return true;
  }
}
