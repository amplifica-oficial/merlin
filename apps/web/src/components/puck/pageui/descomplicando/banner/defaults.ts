import {DESCOMPLICANDO_BANNER_LOGO} from '../shared-defaults';
import type {DescomplicandoBannerProps} from './types';

export function createDefaultDescomplicandoBanner(): DescomplicandoBannerProps {
  return {
    logoSrc: DESCOMPLICANDO_BANNER_LOGO,
    logoAlt: 'Amplifica',
  };
}
