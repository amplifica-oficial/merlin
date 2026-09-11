export const LANDING_PAGE_SLUG_MAX = 50;
export const LANDING_PAGE_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const LANDING_PAGE_UUID_SHAPE_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type LandingPageSlugReason = 'invalid' | 'taken' | 'reserved';

export function isLandingPageUuidShape(value: string): boolean {
  return LANDING_PAGE_UUID_SHAPE_REGEX.test(value);
}

export function slugifyLandingPageName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s_-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, LANDING_PAGE_SLUG_MAX)
    .replace(/-+$/g, '');
}

export function classifyLandingPageSlug(slug: string): 'ok' | 'invalid' | 'reserved' {
  if (!slug || slug.length > LANDING_PAGE_SLUG_MAX || !LANDING_PAGE_SLUG_REGEX.test(slug)) {
    return 'invalid';
  }

  if (isLandingPageUuidShape(slug)) {
    return 'reserved';
  }

  return 'ok';
}
