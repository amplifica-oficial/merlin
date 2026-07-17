import dotenv from 'dotenv';
dotenv.config({quiet: true});

/**
 * Safely parse environment variables
 * @param key The key
 * @param defaultValue An optional default value if the environment variable does not exist
 */
export function validateEnv<T extends string = string>(key: keyof NodeJS.ProcessEnv, defaultValue?: T): T {
  const value = process.env[key] as T | undefined;

  if (!value) {
    if (typeof defaultValue !== 'undefined') {
      return defaultValue;
    } else {
      throw new Error(`${key} is not defined in environment variables`);
    }
  }

  return value;
}

// Environment
export const NODE_ENV = validateEnv('NODE_ENV', 'development');
export const JWT_SECRET = validateEnv('JWT_SECRET');
export const PORT = Number(validateEnv('PORT', '8080'));

// URLs
export const API_URI = validateEnv('API_URI');
export const DASHBOARD_URI = validateEnv('DASHBOARD_URI');
export const WIKI_URI = validateEnv('WIKI_URI');

// S3-compatible storage (Minio)
export const S3_ENDPOINT = validateEnv('S3_ENDPOINT', 'http://minio:9000');
export const S3_ACCESS_KEY_ID = validateEnv('S3_ACCESS_KEY_ID', '');
export const S3_ACCESS_KEY_SECRET = validateEnv('S3_ACCESS_KEY_SECRET', '');
export const S3_BUCKET = validateEnv('S3_BUCKET', 'uploads');
export const S3_PUBLIC_URL = validateEnv('S3_PUBLIC_URL', '');
export const S3_FORCE_PATH_STYLE = validateEnv('S3_FORCE_PATH_STYLE', 'true') === 'true';
export const S3_ENABLED = S3_ACCESS_KEY_ID !== '' && S3_ACCESS_KEY_SECRET !== '';

// AWS SES (required for email sending)
export const AWS_SES_REGION = validateEnv('AWS_SES_REGION');
export const AWS_SES_ACCESS_KEY_ID = validateEnv('AWS_SES_ACCESS_KEY_ID');
export const AWS_SES_SECRET_ACCESS_KEY = validateEnv('AWS_SES_SECRET_ACCESS_KEY');

// Custom MAIL FROM subdomain used to construct `<subdomain>.<your-domain>`
// when a domain is added. Defaults to `merlin`. Override when `merlin.<your-domain>`
// is already used for something else (e.g. a CDN), since the MAIL FROM hostname
// needs MX + TXT records that can't coexist with a CNAME.
export const MAIL_FROM_SUBDOMAIN = validateEnv('MAIL_FROM_SUBDOMAIN', '').trim() || 'merlin';

// Email Processing Rate Limit (optional override)
// If not set, will automatically fetch from AWS SES account quota
// Set this to override AWS quota (useful for setting lower limits or testing)
export const EMAIL_RATE_LIMIT_PER_SECOND = process.env.EMAIL_RATE_LIMIT_PER_SECOND
  ? Number(process.env.EMAIL_RATE_LIMIT_PER_SECOND)
  : undefined;

// Email Worker Concurrency (optional override)
// If not set, concurrency is derived from the effective rate limit so a higher
// SES quota actually translates into higher throughput. Set this to pin a fixed
// value (useful when Prisma pool size or memory is the binding constraint).
export const EMAIL_WORKER_CONCURRENCY = process.env.EMAIL_WORKER_CONCURRENCY
  ? Number(process.env.EMAIL_WORKER_CONCURRENCY)
  : undefined;

// Upper bound for auto-derived concurrency. Raise this if you have a large SES
// quota AND have sized the Prisma connection pool accordingly.
export const EMAIL_WORKER_MAX_CONCURRENCY = process.env.EMAIL_WORKER_MAX_CONCURRENCY
  ? Number(process.env.EMAIL_WORKER_MAX_CONCURRENCY)
  : 50;

// Storage
export const REDIS_URL = validateEnv('REDIS_URL');
export const DATABASE_URL = validateEnv('DATABASE_URL');
export const DIRECT_DATABASE_URL = validateEnv('DIRECT_DATABASE_URL');

// OAuth (optional - for social login)
export const GITHUB_OAUTH_CLIENT = validateEnv('GITHUB_OAUTH_CLIENT', '');
export const GITHUB_OAUTH_SECRET = validateEnv('GITHUB_OAUTH_SECRET', '');
export const GITHUB_OAUTH_ENABLED = GITHUB_OAUTH_CLIENT !== '' && GITHUB_OAUTH_SECRET !== '';

export const GOOGLE_OAUTH_CLIENT = validateEnv('GOOGLE_OAUTH_CLIENT', '');
export const GOOGLE_OAUTH_SECRET = validateEnv('GOOGLE_OAUTH_SECRET', '');
export const GOOGLE_OAUTH_ENABLED = GOOGLE_OAUTH_CLIENT !== '' && GOOGLE_OAUTH_SECRET !== '';

// Stripe (optional - if not set, billing features are disabled)
export const STRIPE_SK = validateEnv('STRIPE_SK', '');
export const STRIPE_WEBHOOK_SECRET = validateEnv('STRIPE_WEBHOOK_SECRET', '');
export const STRIPE_ENABLED = STRIPE_SK !== '' && STRIPE_WEBHOOK_SECRET !== '';

// Stripe Pricing Configuration
export const STRIPE_PRICE_ONBOARDING = validateEnv('STRIPE_PRICE_ONBOARDING', ''); // One-time onboarding fee
export const STRIPE_PRICE_EMAIL_USAGE = validateEnv('STRIPE_PRICE_EMAIL_USAGE', ''); // Metered usage price for pay-per-email
export const STRIPE_METER_EVENT_NAME = validateEnv('STRIPE_METER_EVENT_NAME', 'emails'); // Meter event name (API key in Stripe)

// Email Tracking
export const SES_CONFIGURATION_SET = validateEnv('SES_CONFIGURATION_SET', 'merlin-configuration-set');
export const SES_CONFIGURATION_SET_NO_TRACKING = validateEnv(
  'SES_CONFIGURATION_SET_NO_TRACKING',
  'merlin-configuration-set-no-tracking',
);
// Check if no-tracking configuration set was explicitly provided (not using default)
export const TRACKING_TOGGLE_ENABLED = process.env.SES_CONFIGURATION_SET_NO_TRACKING !== undefined;

export const MERLIN_API_KEY = validateEnv('MERLIN_API_KEY', '');
export const MERLIN_FROM_ADDRESS = validateEnv('MERLIN_FROM_ADDRESS', '');
export const MERLIN_ENABLED = MERLIN_API_KEY !== '' && MERLIN_FROM_ADDRESS !== '';

// Security (optional)
// Controls whether projects are automatically disabled when bounce/complaint rate thresholds are exceeded
// Useful for self-hosters who want to manage project status manually
export const AUTO_PROJECT_DISABLE = validateEnv('AUTO_PROJECT_DISABLE', 'true') === 'true';
// Allows the same domain to be linked to multiple projects (bypasses cross-project ownership check)
export const ALLOW_SHARED_DOMAINS = process.env.ALLOW_SHARED_DOMAINS === 'true';

// Self-hosting Configuration (optional)
// Controls whether new user signups are allowed (default: false)
export const DISABLE_SIGNUPS = process.env.DISABLE_SIGNUPS === 'true';
// Controls whether email+password auth (login/signup/reset) is allowed (default: false)
export const DISABLE_PASSWORD_AUTH = process.env.DISABLE_PASSWORD_AUTH === 'true';
// Controls whether email validation checks are performed on signup (default: false)
export const VERIFY_EMAIL_ON_SIGNUP = process.env.VERIFY_EMAIL_ON_SIGNUP === 'true';

// Signup allowlist: ALL_DOMAINS = open signup; comma-separated domains = restricted;
// empty (not ALL_DOMAINS) = closed except emails already on the allowlist table.
const ALLOWLIST_TRUSTED_DOMAINS_RAW = validateEnv('ALLOWLIST_TRUSTED_DOMAINS', 'ALL_DOMAINS');
export const ALLOWLIST_OPEN = ALLOWLIST_TRUSTED_DOMAINS_RAW.trim().toUpperCase() === 'ALL_DOMAINS';
export const ALLOWLIST_TRUSTED_DOMAINS: string[] = ALLOWLIST_OPEN
  ? []
  : ALLOWLIST_TRUSTED_DOMAINS_RAW.split(',')
      .map(domain => domain.trim().toLowerCase())
      .filter(Boolean);
export const ALLOWLIST_RESTRICTED = !ALLOWLIST_OPEN;

// Attachment Limits (optional)
// Maximum total attachment size in MB (default: 10). AWS SES supports up to 40 MB.
export const MAX_ATTACHMENT_SIZE_MB = Number(validateEnv('MAX_ATTACHMENT_SIZE_MB', '10'));
// Maximum number of attachments per email (default: 10)
export const MAX_ATTACHMENTS_COUNT = Number(validateEnv('MAX_ATTACHMENTS_COUNT', '10'));

// Idempotency (optional)
// How long a used Idempotency-Key stays claimed before it can be reused (default: 24 hours)
export const IDEMPOTENCY_KEY_TTL_HOURS = Number(validateEnv('IDEMPOTENCY_KEY_TTL_HOURS', '24'));

// Email Verification & Password Reset
export const TOKEN_EXPIRY_SECONDS = 3600; // 1 hour
export const EMAIL_VERIFICATION_RATE_LIMIT = 3; // Max 3 emails per hour
export const PASSWORD_RESET_RATE_LIMIT = 3; // Max 3 emails per hour
export const EMAIL_VERIFICATION_RATE_WINDOW = 3600; // 1 hour in seconds
export const SIGNUP_RATE_LIMIT = 10; // Max signup attempts per email per hour
export const SIGNUP_RATE_LIMIT_IP = 20; // Max signup attempts per IP per hour

// Pending project share invites expire after this many days (not configurable via env)
export const PENDING_SHARE_TTL_DAYS = 30;

// Phishing Detection (optional)
// OpenRouter API integration for content safety checks
export const OPENROUTER_API_KEY = validateEnv('OPENROUTER_API_KEY', '');
export const OPENROUTER_MODEL = validateEnv('OPENROUTER_MODEL', 'anthropic/claude-3-haiku');
export const PHISHING_DETECTION_SAMPLE_RATE = Number(validateEnv('PHISHING_DETECTION_SAMPLE_RATE', '0.1')); // Default 10% of emails
export const PHISHING_DETECTION_ENABLED = OPENROUTER_API_KEY !== '';
export const PHISHING_CONFIDENCE_THRESHOLD = Number(validateEnv('PHISHING_CONFIDENCE_THRESHOLD', '95')); // Confidence % required to auto-disable project from a single detection
export const PHISHING_CUMULATIVE_THRESHOLD = Number(validateEnv('PHISHING_CUMULATIVE_THRESHOLD', '3')); // Number of phishing detections before auto-disable (default 3)
export const PHISHING_CUMULATIVE_WINDOW_MS = Number(validateEnv('PHISHING_CUMULATIVE_WINDOW_MS', '3600000')); // Time window for cumulative tracking in ms (default 1 hour)
