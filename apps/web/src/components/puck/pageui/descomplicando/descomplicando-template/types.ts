import type {Slot, SlotComponent} from '@puckeditor/core';

export type DescomplicandoTemplateProps = {
  content: Slot;
};

export type DescomplicandoTemplateRenderProps = Omit<DescomplicandoTemplateProps, 'content'> & {
  content: SlotComponent;
};
