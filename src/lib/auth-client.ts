"use client";

// Helpers d'authentification côté client (jeton en localStorage)
import type { AuthUser } from "./types";

const TOKEN_KEY = "lf_token";
const USER_KEY = "lf_user";

export function saveSession(token: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getCachedUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/** fetch avec en-tête Authorization si un jeton est présent. */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(options.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...options, headers });
}

/** Vérifie le jeton auprès du serveur ; renvoie l'utilisateur ou null. */
export async function verifySession(): Promise<AuthUser | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await authFetch("/api/auth/me");
    if (!res.ok) {
      clearSession();
      return null;
    }
    const json = (await res.json()) as { user: AuthUser };
    localStorage.setItem(USER_KEY, JSON.stringify(json.user));
    return json.user;
  } catch {
    return null;
  }
}
