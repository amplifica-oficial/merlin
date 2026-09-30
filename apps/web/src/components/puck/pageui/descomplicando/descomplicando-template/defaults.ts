import type {DescomplicandoTemplateProps} from './types';
import {createDescomplicandoSlotContent} from './section-content';

export function createDefaultDescomplicandoTemplate(): DescomplicandoTemplateProps {
  return {
    content: createDescomplicandoSlotContent(),
  };
}
