import type {Slot, SlotComponent} from '@puckeditor/core';

export type DescomplicandoHeroProps = {
  title: string;
  subtitle: string;
  date: string;
  time: string;
  iconSrc: string;
  iconAlt: string;
  backgroundImageSrc: string;
  form: Slot;
};

export type DescomplicandoHeroRenderProps = Omit<DescomplicandoHeroProps, 'form'> & {
  form: SlotComponent;
};
