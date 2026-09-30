import type {Content} from '@puckeditor/core';

import {createDefaultDescomplicandoAgenda} from '../agenda/defaults';
import {createDefaultDescomplicandoBanner} from '../banner/defaults';
import {createDefaultDescomplicandoFooter} from '../footer/defaults';
import {createDefaultDescomplicandoHero} from '../hero/defaults';
import {createDefaultDescomplicandoSpeaker} from '../speaker/defaults';

function section<T extends object>(id: string, type: string, props: T): Content[number] {
  return {
    type,
    props: {
      id,
      ...props,
    },
  };
}

export function createDescomplicandoSlotContent(): Content {
  return [
    section('descomplicando-banner', 'DescomplicandoBanner', createDefaultDescomplicandoBanner()),
    section('descomplicando-hero', 'DescomplicandoHero', createDefaultDescomplicandoHero()),
    section('descomplicando-agenda', 'DescomplicandoAgenda', createDefaultDescomplicandoAgenda()),
    section('descomplicando-speaker', 'DescomplicandoSpeaker', createDefaultDescomplicandoSpeaker()),
    section('descomplicando-footer', 'DescomplicandoFooter', createDefaultDescomplicandoFooter()),
  ];
}
