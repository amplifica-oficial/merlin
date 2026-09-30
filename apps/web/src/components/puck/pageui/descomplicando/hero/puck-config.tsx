import type {ComponentConfig} from '@puckeditor/core';

import {puckImageUrlField} from '../../../shared/puckImageUrlField';

import {createDefaultDescomplicandoHero} from './defaults';
import {PuckDescomplicandoHeroBlock} from './PuckDescomplicandoHeroBlock';
import type {DescomplicandoHeroProps} from './types';

export const descomplicandoHeroPuckComponent: ComponentConfig<DescomplicandoHeroProps> = {
  label: 'Descomplicando Hero',
  defaultProps: createDefaultDescomplicandoHero(),
  fields: {
    title: {type: 'text', label: 'Title', contentEditable: true},
    subtitle: {type: 'textarea', label: 'Subtitle', contentEditable: true},
    date: {type: 'text', label: 'Date', contentEditable: true},
    time: {type: 'text', label: 'Time', contentEditable: true},
    iconSrc: puckImageUrlField('Icon'),
    iconAlt: {type: 'text', label: 'Icon alt'},
    backgroundImageSrc: puckImageUrlField('Background image'),
    form: {type: 'slot', label: 'Form', allow: ['FormBlock']},
  },
  render: props => <PuckDescomplicandoHeroBlock {...props} />,
};
