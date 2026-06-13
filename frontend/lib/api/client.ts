// Resolve the backend base URL. In the browser, talk to the SAME host that
// served the page (on :8000) so the app works from any device/IP — phone on the
// LAN, localhost on the dev box — with no per-IP reconfiguration. An explicit
// NEXT_PUBLIC_API_URL still wins (e.g. production); server-side falls back to
// localhost (Next server and backend run on the same machine).
function resolveApiBase(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return `${window.location.protocol}//${host}:8000`;
    }
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
}

export const API_BASE_URL = resolveApiBase();

interface FetchOptions extends RequestInit {
  timeout?: number;
}

export async function apiClient<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { timeout = 8000, ...fetchOptions } = options;

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...fetchOptions,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...fetchOptions.headers,
      },
      signal: controller.signal,
    });

    clearTimeout(id);

    if (!response.ok) {
      if (response.status === 401) {
        if (typeof window !== 'undefined') {
          // Clear Zustand auth state dynamically to avoid circular dependencies
          import('../stores/userStore').then(({ useUserStore }) => {
            useUserStore.getState().setUser(null);
          });
          
          // Silently redirect if not already on the landing page
          if (window.location.pathname !== '/') {
            window.location.href = '/';
          }
        }
      }
      
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || errorData.message || 'API request failed');
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    return await response.json();
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}
