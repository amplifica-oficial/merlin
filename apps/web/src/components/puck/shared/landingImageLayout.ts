export type LandingImageAlign = 'left' | 'center' | 'right';
export type LandingImageRadiusPreset = 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full' | 'custom';

const ALIGN_CLASS: Record<LandingImageAlign, string> = {
  left: 'mr-auto',
  center: 'mx-auto',
  right: 'ml-auto',
};

const RADIUS_CLASS: Record<Exclude<LandingImageRadiusPreset, 'none' | 'custom'>, string> = {
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  full: 'rounded-full',
};

const WIDTH_PATTERN = /^(\d+(?:\.\d+)?)\s*%?$/;
const RADIUS_PX_PATTERN = /^(\d+(?:\.\d+)?)\s*px$/i;
const RADIUS_NUMBER_PATTERN = /^(\d+(?:\.\d+)?)$/;

function resolveAlign(align?: string): LandingImageAlign {
  if (align === 'left' || align === 'right') {
    return align;
  }
  return 'center';
}

export function parseLandingImageWidthPercent(width?: string): number {
  if (!width) {
    return 100;
  }

  const match = width.trim().match(WIDTH_PATTERN);
  if (!match) {
    return 100;
  }

  const percent = Number(match[1]);
  if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
    return 100;
  }

  return percent;
}

export function landingImageWidthIsFull(width?: string): boolean {
  return parseLandingImageWidthPercent(width) === 100;
}

function normalizeRadiusToken(rounded?: boolean | string): string {
  if (rounded === false) {
    return 'none';
  }
  if (rounded === true || rounded === undefined || rounded === '') {
    return 'xl';
  }
  return String(rounded).trim().toLowerCase();
}

export function landingImageRadiusPreset(rounded?: boolean | string): LandingImageRadiusPreset {
  const token = normalizeRadiusToken(rounded);
  if (token === 'none' || token === '0' || token === 'square') {
    return 'none';
  }
  if (token === 'sm' || token === 'md' || token === 'lg' || token === 'xl' || token === 'full') {
    return token;
  }
  if (RADIUS_PX_PATTERN.test(token) || RADIUS_NUMBER_PATTERN.test(token)) {
    const amount = Number((token.match(RADIUS_PX_PATTERN) ?? token.match(RADIUS_NUMBER_PATTERN))?.[1]);
    if (!Number.isFinite(amount) || amount <= 0) {
      return 'none';
    }
    return 'custom';
  }
  return 'xl';
}

function resolveRadius(rounded?: boolean | string): {className: string | null; borderRadius: string | null} {
  const preset = landingImageRadiusPreset(rounded);
  if (preset === 'none') {
    return {className: null, borderRadius: null};
  }
  if (preset !== 'custom') {
    return {className: RADIUS_CLASS[preset], borderRadius: null};
  }

  const token = normalizeRadiusToken(rounded);
  const amount = Number((token.match(RADIUS_PX_PATTERN) ?? token.match(RADIUS_NUMBER_PATTERN))?.[1]);
  return {className: null, borderRadius: `${amount}px`};
}

export function resolveLandingImageLayout(
  width?: string,
  align?: string,
  rounded?: boolean | string,
): {wrapperClass: string; imgClass: string; imgStyle: {width: string; borderRadius?: string}} {
  const percent = parseLandingImageWidthPercent(width);
  const radius = resolveRadius(rounded);
  const parts = ['block', 'h-auto'];
  if (percent !== 100) {
    parts.push(ALIGN_CLASS[resolveAlign(align)]);
  }
  if (radius.className) {
    parts.push(radius.className);
  }

  const imgStyle: {width: string; borderRadius?: string} = {width: `${percent}%`};
  if (radius.borderRadius) {
    imgStyle.borderRadius = radius.borderRadius;
  }

  return {
    wrapperClass: 'w-full',
    imgClass: parts.join(' '),
    imgStyle,
  };
}
