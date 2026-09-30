import {PageUiImage} from '../../../../pageui/shared';

import type {DescomplicandoSpeakerProps} from './types';

export function PuckDescomplicandoSpeakerBlock({
  imageSrc,
  imageAlt,
  eyebrow,
  name,
  bio,
}: DescomplicandoSpeakerProps) {
  return (
    <section className="bg-black p-[3%] text-white">
      <div className="mx-auto flex w-full max-w-[1140px] flex-col md:flex-row md:items-start">
        <div className="w-full p-3.5 md:w-[37.632%] md:p-0 md:pr-4">
          {imageSrc ? <PageUiImage src={imageSrc} alt={imageAlt} className="h-auto w-full" /> : null}
        </div>
        <div className="mt-6 w-full md:mt-0 md:w-[62.368%] md:pl-4">
          <p className="pl-0 text-[26px] font-semibold md:pl-[5%] md:text-[32px]">{eyebrow}</p>
          <h2 className="pl-0 text-[20px] font-semibold md:pl-[5%] md:text-[25px]">{name}</h2>
          <p className="mt-4 pl-0 pr-0 text-[16px] font-normal leading-[1.3] md:pl-[5%] md:pr-[19%] md:text-[17px] lg:text-[22px]">
            {bio}
          </p>
        </div>
      </div>
    </section>
  );
}
