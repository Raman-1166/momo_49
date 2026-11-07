import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import type { Request, Response, NextFunction } from 'express';

const isProduction = process.env.NODE_ENV === 'production';

// Strict environment validation
export function validateAuthConfig(): void {
  if (isProduction) {
    if (!process.env.ADMIN_PASSWORD_HASH || process.env.ADMIN_PASSWORD_HASH.trim().length === 0) {
      console.error('❌ FATAL: Production startup blocked. ADMIN_PASSWORD_HASH environment variable is missing.');
      process.exit(1);
    }
    if (!process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET.trim().length < 32) {
      console.error('❌ FATAL: Production startup blocked. ADMIN_SESSION_SECRET must be at least 32 characters in production.');
      process.exit(1);
    }
  }
}

function getSessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    if (isProduction) {
      throw new Error('ADMIN_SESSION_SECRET is missing in production');
    }
    // Only in local development fallback with explicit warning
    return 'momo_dev_only_session_secret_key_minimum_32_chars!';
  }
  return secret;
}

const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

export interface SessionPayload {
  role: 'admin';
  issuedAt: number;
  expiresAt: number;
}

/**
 * Creates a signed cryptographic session token: base64(payload).signature
 */
export function createAdminSessionToken(): string {
  const secret = getSessionSecret();
  const now = Date.now();
  const payload: SessionPayload = {
    role: 'admin',
    issuedAt: now,
    expiresAt: now + SESSION_TTL_MS,
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payloadB64)
    .digest('base64url');

  return `${payloadB64}.${signature}`;
}

export function verifyAdminSessionToken(token: string): boolean {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const secret = getSessionSecret();
  const [payloadB64, signature] = parts;
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(payloadB64)
    .digest('base64url');

  // Timing safe comparison to prevent timing attacks
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSig);
  if (sigBuffer.length !== expectedBuffer.length) return false;
  if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) return false;

  try {
    const payload: SessionPayload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
    if (payload.role !== 'admin') return false;
    if (Date.now() > payload.expiresAt) return false;
    return true;
  } catch {
    return false;
  }
}

export async function verifyAdminPassword(inputPass: string): Promise<boolean> {
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash) {
    console.error('CRITICAL: ADMIN_PASSWORD_HASH is not configured in environment variables');
    return false;
  }
  return bcrypt.compare(inputPass, hash);
}

/**
 * Express middleware to strictly guard admin endpoints on the server.
 */
export function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const cookieToken = req.cookies?.momo_admin_token;
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  const token = cookieToken || bearerToken;
  if (!token || !verifyAdminSessionToken(token)) {
    return res.status(401).json({ error: 'Unauthorized: Admin authentication required or session expired' });
  }

  (req as any).isAdmin = true;
  next();
}
