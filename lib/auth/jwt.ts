import jwt from 'jsonwebtoken';

export interface JWTPayload {
  userId: string;
  userRole: string;
}

export function signToken(payload: JWTPayload, secret: string, expiresIn: string): string {
  return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
}

export function verifyToken(token: string, secret: string): JWTPayload {
  return jwt.verify(token, secret) as JWTPayload;
}

export function decodeToken(token: string): JWTPayload | null {
  try {
    return jwt.decode(token) as JWTPayload;
  } catch {
    return null;
  }
}

