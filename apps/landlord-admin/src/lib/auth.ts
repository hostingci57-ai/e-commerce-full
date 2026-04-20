/**
 * Token storage — sessionStorage so the token is scoped to the tab and cleared
 * on close. Landlord sessions are short-lived on purpose.
 */
const KEY = 'ecf:landlord:accessToken';
const EMAIL_KEY = 'ecf:landlord:email';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage.getItem(KEY);
}

export function setToken(token: string, email?: string): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(KEY, token);
  if (email) window.sessionStorage.setItem(EMAIL_KEY, email);
}

export function clearToken(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(KEY);
  window.sessionStorage.removeItem(EMAIL_KEY);
}

export function getEmail(): string | null {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage.getItem(EMAIL_KEY);
}

export function isAuthenticated(): boolean {
  return getToken() !== null;
}
