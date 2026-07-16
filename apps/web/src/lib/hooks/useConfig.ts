import useSWR from 'swr';

export interface ConfigResponse {
  environment: string;
  urls: {
    api: string;
    dashboard: string;
    wiki: string | null;
  };
  features: {
    billing: {enabled: boolean};
    storage: {s3Enabled: boolean};
    authProviders: {github: boolean; google: boolean; passwordDisabled: boolean};
    signup: {signupsDisabled: boolean; allowlistRestricted: boolean};
    email: {trackingToggleEnabled: boolean};
  };
  aws: {
    sesRegion: string;
    mailFromSubdomain: string;
  };
}

/**
 * Fetch global instance configuration and feature flags.
 *
 * - `data` is undefined while loading, then a ConfigResponse on success.
 * - Errors do not retry by default.
 */
export function useConfig() {
  return useSWR<ConfigResponse>('/config', {shouldRetryOnError: false});
}
