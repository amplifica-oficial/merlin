import useSWR from 'swr';

export interface CurrentUser {
  id: string;
  email: string;
  type?: 'PASSWORD' | 'GOOGLE_OAUTH' | 'GITHUB_OAUTH';
  emailVerified?: boolean;
  canManageAllowlist?: boolean;
}

/**
 * Fetch the current user. undefined means loading, null means logged out
 */
export function useUser() {
  return useSWR<CurrentUser | null>('/users/@me', {shouldRetryOnError: false});
}
