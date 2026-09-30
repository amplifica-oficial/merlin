import {DESCOMPLICANDO_FOOTER_LOGO, DESCOMPLICANDO_LEGAL_URL} from '../shared-defaults';
import type {DescomplicandoFooterProps} from './types';

export function createDefaultDescomplicandoFooter(): DescomplicandoFooterProps {
  return {
    logoSrc: DESCOMPLICANDO_FOOTER_LOGO,
    logoAlt: 'Amplifica',
    termsLabel: 'Termos de Uso',
    termsHref: DESCOMPLICANDO_LEGAL_URL,
    privacyLabel: 'Políticas de privacidade',
    privacyHref: DESCOMPLICANDO_LEGAL_URL,
    email: 'contato@amplifica.me',
    cnpj: 'CNPJ: 24.046.480/0001-9',
  };
}
