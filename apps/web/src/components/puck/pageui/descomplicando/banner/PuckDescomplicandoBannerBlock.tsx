import {PageUiImage} from '../../../../pageui/shared';

import type {DescomplicandoBannerProps} from './types';

export function PuckDescomplicandoBannerBlock({logoSrc, logoAlt}: DescomplicandoBannerProps) {
  return (
    <section className="bg-[#020202]">
      <div className="flex justify-center py-3">
        {logoSrc ? (
          <PageUiImage src={logoSrc} alt={logoAlt} className="h-auto w-auto max-w-[44%] md:max-w-none" />
        ) : null}
      </div>
    </section>
  );
}

