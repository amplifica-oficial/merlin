import type {ComponentConfig} from '@puckeditor/core';

import {puckImageUrlField} from '../../../shared/puckImageUrlField';

import {createDefaultDescomplicandoBanner} from './defaults';
import {PuckDescomplicandoBannerBlock} from './PuckDescomplicandoBannerBlock';
import type {DescomplicandoBannerProps} from './types';

export const descomplicandoBannerPuckComponent: ComponentConfig<DescomplicandoBannerProps> = {
  label: 'Descomplicando Banner',
  defaultProps: createDefaultDescomplicandoBanner(),
  fields: {
    logoSrc: puckImageUrlField('Logo'),
    logoAlt: {type: 'text', label: 'Logo alt'},
  },
  render: props => <PuckDescomplicandoBannerBlock {...props} />,
};
