import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthTokens, AuthUser } from './auth.types';

@Injectable()
export class AuthService {
  private readonly supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabasePublishableKey =
      process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabasePublishableKey) {
      throw new Error(
        'Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY (or SUPABASE_ANON_KEY) environment variables.',
      );
    }

    this.supabase = createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  async register(dto: RegisterDto): Promise<{
    user: AuthUser;
    tokens: AuthTokens;
    requiresEmailConfirmation: boolean;
  }> {
    const { data, error } = await this.supabase.auth.signUp({
      email: dto.email,
      password: dto.password,
    });

    if (error) {
      throw new BadRequestException(error.message);
    }

    if (!data.user) {
      throw new InternalServerErrorException('User was not created.');
    }

    return {
      user: {
        id: data.user.id,
        email: data.user.email,
        emailConfirmedAt: data.user.email_confirmed_at,
      },
      tokens: this.mapTokens(data.session),
      requiresEmailConfirmation: !data.session,
    };
  }

  async login(dto: LoginDto): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email: dto.email,
      password: dto.password,
    });

    if (error) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (!data.user || !data.session) {
      throw new UnauthorizedException(
        'Login failed. Confirm your email and try again.',
      );
    }

    return {
      user: {
        id: data.user.id,
        email: data.user.email,
        emailConfirmedAt: data.user.email_confirmed_at,
      },
      tokens: this.mapTokens(data.session),
    };
  }

  private mapTokens(
    session:
      | {
          access_token: string;
          refresh_token: string;
          expires_at?: number;
          token_type: string;
        }
      | null
      | undefined,
  ): AuthTokens {
    return {
      accessToken: session?.access_token ?? null,
      refreshToken: session?.refresh_token ?? null,
      expiresAt: session?.expires_at ?? null,
      tokenType: session?.token_type ?? null,
    };
  }
}
