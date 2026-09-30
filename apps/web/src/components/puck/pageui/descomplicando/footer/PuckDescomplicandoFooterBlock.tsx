import {PageUiImage} from '../../../../pageui/shared';

import type {DescomplicandoFooterProps} from './types';

export function PuckDescomplicandoFooterBlock({
  logoSrc,
  logoAlt,
  termsLabel,
  termsHref,
  privacyLabel,
  privacyHref,
  email,
  cnpj,
}: DescomplicandoFooterProps) {
  return (
    <section className="bg-[#DA4C5C] p-[5%] text-center text-white">
      <div className="mx-auto w-full max-w-[1140px]">
        {logoSrc ? (
          <PageUiImage src={logoSrc} alt={logoAlt} className="mx-auto h-auto w-auto max-w-[53%] md:max-w-none" />
        ) : null}
        <p className="mt-4 text-[15px] font-normal">
          <a href={termsHref} className="text-white" target="_blank" rel="noreferrer">
            {termsLabel}
          </a>
          {' | '}
          <a href={privacyHref} className="text-white" target="_blank" rel="noreferrer">
            {privacyLabel}
          </a>
          <br />
          {email}
          <br />
          {cnpj}
        </p>
      </div>
    </section>
  );
}
