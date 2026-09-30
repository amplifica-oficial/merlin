import type {Content} from '@puckeditor/core';

import {DESCOMPLICANDO_HERO_BACKGROUND, DESCOMPLICANDO_HERO_ICON} from '../shared-defaults';
import type {DescomplicandoHeroProps} from './types';

function defaultFormSlot(): Content {
  return [
    {
      type: 'FormBlock',
      props: {
        id: 'descomplicando-hero-form',
        formPublicId: '',
      },
    },
  ];
}

export function createDefaultDescomplicandoHero(): DescomplicandoHeroProps {
  return {
    title: 'Aulão Descomplicando os algoritmos na educação básica',
    subtitle: 'Desmistificando o conceito de algoritmos para professores da educação básica.',
    date: '📅 6 de julho',
    time: '19h às 20h30 (horário padrão de Brasília)',
    iconSrc: DESCOMPLICANDO_HERO_ICON,
    iconAlt: 'Descomplicando Algoritmos',
    backgroundImageSrc: DESCOMPLICANDO_HERO_BACKGROUND,
    form: defaultFormSlot(),
  };
}
