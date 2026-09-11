import {Input, Label} from '@merlin/ui';
import {classifyLandingPageSlug, slugifyLandingPageName} from '@merlin/shared';
import {Check, Loader2, X} from 'lucide-react';
import {useEffect, useState} from 'react';
import useSWR from 'swr';

import {DASHBOARD_URI} from '../../lib/constants';

export type LandingPageSlugStatus = 'empty' | 'invalid' | 'reserved' | 'checking' | 'available' | 'taken';

export function isLandingPageSlugReady(status: LandingPageSlugStatus): boolean {
  return status === 'available';
}

type SlugCheckResponse = {
  available: boolean;
  reason?: 'invalid' | 'taken' | 'reserved';
};

interface LandingPageSlugFieldProps {
  id?: string;
  name?: string;
  slug: string;
  onSlugChange: (slug: string) => void;
  syncFromName?: boolean;
  excludeId?: string;
  originalSlug?: string;
  published?: boolean;
  onStatusChange?: (status: LandingPageSlugStatus) => void;
}

const STATUS_COPY: Record<LandingPageSlugStatus, string> = {
  empty: 'Choose a URL slug',
  invalid: 'Use lowercase letters, numbers, and hyphens',
  reserved: 'This slug looks like a UUID and cannot be used',
  checking: 'Checking availability…',
  available: 'This URL is available',
  taken: 'This slug is already taken',
};

export function LandingPageSlugField({
  id = 'landing-slug',
  name,
  slug,
  onSlugChange,
  syncFromName = false,
  excludeId,
  originalSlug,
  published = false,
  onStatusChange,
}: LandingPageSlugFieldProps) {
  const [slugTouched, setSlugTouched] = useState(false);
  const [debouncedSlug, setDebouncedSlug] = useState(slug);

  useEffect(() => {
    if (!syncFromName || slugTouched) {
      return;
    }

    const next = slugifyLandingPageName(name ?? '');
    if (next !== slug) {
      onSlugChange(next);
    }
  }, [name, onSlugChange, slug, slugTouched, syncFromName]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSlug(slug), 350);
    return () => window.clearTimeout(timeout);
  }, [slug]);

  const classification = classifyLandingPageSlug(slug);
  const isUnchanged = originalSlug !== undefined && slug === originalSlug;
  const shouldCheck = classification === 'ok' && !isUnchanged;

  const {data, isLoading} = useSWR<SlugCheckResponse>(
    shouldCheck && slug === debouncedSlug
      ? `/landing-pages/slug-available?slug=${encodeURIComponent(debouncedSlug)}${
          excludeId ? `&excludeId=${encodeURIComponent(excludeId)}` : ''
        }`
      : null,
  );

  const status: LandingPageSlugStatus = (() => {
    if (!slug) {
      return 'empty';
    }
    if (classification === 'invalid') {
      return 'invalid';
    }
    if (classification === 'reserved') {
      return 'reserved';
    }
    if (isUnchanged) {
      return 'available';
    }
    if (slug !== debouncedSlug || isLoading || !data) {
      return 'checking';
    }
    if (data.available) {
      return 'available';
    }
    if (data.reason === 'reserved') {
      return 'reserved';
    }
    if (data.reason === 'invalid') {
      return 'invalid';
    }
    return 'taken';
  })();

  useEffect(() => {
    onStatusChange?.(status);
  }, [onStatusChange, status]);

  const showPublishedWarning = published && Boolean(originalSlug) && slug !== originalSlug && status !== 'empty';
  const isError =
    status === 'invalid' ||
    status === 'taken' ||
    status === 'reserved' ||
    (status === 'empty' && Boolean(name?.trim()));

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Public URL</Label>
      <div className="flex overflow-hidden rounded-md border border-neutral-200 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
        <span className="max-w-[55%] shrink-0 truncate border-r border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500">
          {DASHBOARD_URI}/p/
        </span>
        <Input
          id={id}
          value={slug}
          onChange={event => {
            setSlugTouched(true);
            onSlugChange(event.target.value.toLowerCase());
          }}
          placeholder="product-launch"
          autoComplete="off"
          spellCheck={false}
          className="rounded-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          aria-invalid={isError}
          aria-describedby={`${id}-status`}
        />
      </div>
      <p
        id={`${id}-status`}
        className={`flex items-center gap-1.5 text-sm ${
          status === 'available' ? 'text-green-600' : isError ? 'text-red-600' : 'text-neutral-500'
        }`}
      >
        {status === 'checking' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        {status === 'available' ? <Check className="h-3.5 w-3.5" /> : null}
        {isError ? <X className="h-3.5 w-3.5" /> : null}
        <span>{STATUS_COPY[status]}</span>
      </p>
      {showPublishedWarning ? (
        <p className="text-sm text-amber-700">
          Changing this slug breaks the current vanity link. The UUID link will keep working.
        </p>
      ) : null}
    </div>
  );
}
