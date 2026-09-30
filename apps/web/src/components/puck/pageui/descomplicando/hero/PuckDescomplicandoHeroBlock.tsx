import {PageUiImage} from '../../../../pageui/shared';

import type {DescomplicandoHeroRenderProps} from './types';

export function PuckDescomplicandoHeroBlock({
  title,
  subtitle,
  date,
  time,
  iconSrc,
  iconAlt,
  backgroundImageSrc,
  form: Form,
}: DescomplicandoHeroRenderProps) {
  return (
    <section className="relative isolate overflow-hidden p-[3%] text-white">
      <div
        className="absolute inset-0 -z-20 bg-cover bg-center"
        style={{backgroundImage: backgroundImageSrc ? `url(${backgroundImageSrc})` : undefined}}
        aria-hidden
      />
      <div className="absolute inset-0 -z-10 bg-[#050505]/[0.87]" aria-hidden />
      <div className="mx-auto flex w-full max-w-[1140px] flex-col md:flex-row md:items-start">
        <div className="w-full md:w-[38.356%] md:pr-4">
          <h1 className="pr-0 text-[31px] font-semibold leading-[1.1] md:pr-[18%] md:text-[24px] lg:text-[36px]">
            {title}
          </h1>
          <p className="mt-3 text-[19px] font-normal leading-[1.2] md:text-[20px] lg:text-[24px]">{subtitle}</p>
          <p className="mt-4 text-[28px] font-normal leading-[1.4] md:text-[25px] lg:text-[30px]">{date}</p>
          <p className="mt-2 pr-0 text-[19px] font-normal leading-[1.2] md:pr-[16%] lg:text-[24px]">{time}</p>
          {iconSrc ? (
            <PageUiImage src={iconSrc} alt={iconAlt} className="mx-auto mt-4 block h-auto w-[46%]" />
          ) : null}
        </div>
        <div className="mt-6 w-full md:mt-0 md:w-[61.644%] md:pl-4">
          <Form
            className="descomplicando-hero-form min-h-[700px] w-full"
            collisionAxis="y"
            minEmptyHeight={700}
          />
        </div>
      </div>
    </section>
  );
}
