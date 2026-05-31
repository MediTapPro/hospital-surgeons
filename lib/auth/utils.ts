/**
 * Client-side authentication utilities
 * These functions work in the browser to check auth status
 */

export interface DecodedToken {
  userId: string;
  userRole: string;
  iat?: number;
  exp?: number;
}

/**
 * Decode JWT token without verification (client-side only)
 * For verification, always use server-side validation
 */
export function decodeToken(token: string): DecodedToken | null {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
}

/**
 * Check if user is authenticated (has valid token in localStorage)
 */
export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  
  const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
  if (!token) return false;
  
  const decoded = decodeToken(token);
  if (!decoded) return false;
  
  // Check if token is expired
  if (decoded.exp && decoded.exp * 1000 < Date.now()) {
    // Token expired, remove it
    localStorage.removeItem('accessToken');
    localStorage.removeItem('token');
    return false;
  }
  
  return true;
}

/**
 * Get current user role from token
 */
export function getUserRole(): string | null {
  if (typeof window === 'undefined') return null;
  
  const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
  if (!token) return null;
  
  const decoded = decodeToken(token);
  return decoded?.userRole || null;
}

/**
 * Get current user ID from token
 */
export function getUserId(): string | null {
  if (typeof window === 'undefined') return null;
  
  const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
  if (!token) return null;
  
  const decoded = decodeToken(token);
  return decoded?.userId || null;
}

/**
 * Check if user has specific role
 */
export function hasRole(role: 'admin' | 'doctor' | 'hospital'): boolean {
  const userRole = getUserRole();
  return userRole === role;
}

/**
 * Get dashboard path based on user role
 */
export function getDashboardPath(role: string | null): string {
  switch (role) {
    case 'admin':
      return '/admin';
    case 'doctor':
      return '/doctor/dashboard';
    case 'hospital':
      return '/hospital/dashboard';
    default:
      return '/login';
  }
}


