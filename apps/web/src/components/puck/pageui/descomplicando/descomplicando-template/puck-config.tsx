import type {ComponentConfig} from '@puckeditor/core';

import {createDefaultDescomplicandoTemplate} from './defaults';
import {PuckDescomplicandoTemplateBlock} from './PuckDescomplicandoTemplateBlock';
import type {DescomplicandoTemplateProps} from './types';

export const descomplicandoTemplatePuckComponent: ComponentConfig<DescomplicandoTemplateProps> = {
  label: 'Descomplicando Template',
  defaultProps: createDefaultDescomplicandoTemplate(),
  fields: {
    content: {
      type: 'slot',
      allow: [
        'DescomplicandoBanner',
        'DescomplicandoHero',
        'DescomplicandoAgenda',
        'DescomplicandoSpeaker',
        'DescomplicandoFooter',
      ],
    },
  },
  render: props => <PuckDescomplicandoTemplateBlock {...props} />,
};
