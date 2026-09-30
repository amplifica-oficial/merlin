import type {ComponentConfig} from '@puckeditor/core';

import {puckImageUrlField} from '../../../shared/puckImageUrlField';

import {createDefaultDescomplicandoFooter} from './defaults';
import {PuckDescomplicandoFooterBlock} from './PuckDescomplicandoFooterBlock';
import type {DescomplicandoFooterProps} from './types';

export const descomplicandoFooterPuckComponent: ComponentConfig<DescomplicandoFooterProps> = {
  label: 'Descomplicando Footer',
  defaultProps: createDefaultDescomplicandoFooter(),
  fields: {
    logoSrc: puckImageUrlField('Logo'),
    logoAlt: {type: 'text', label: 'Logo alt'},
    termsLabel: {type: 'text', label: 'Terms label', contentEditable: true},
    termsHref: {type: 'text', label: 'Terms URL'},
    privacyLabel: {type: 'text', label: 'Privacy label', contentEditable: true},
    privacyHref: {type: 'text', label: 'Privacy URL'},
    email: {type: 'text', label: 'Email', contentEditable: true},
    cnpj: {type: 'text', label: 'CNPJ', contentEditable: true},
  },
  render: props => <PuckDescomplicandoFooterBlock {...props} />,
};
