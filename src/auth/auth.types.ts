export interface AuthTokens {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
  tokenType: string | null;
}

export interface AuthUser {
  id: string;
  email: string | undefined;
  emailConfirmedAt?: string | null;
}
