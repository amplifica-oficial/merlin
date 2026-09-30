import type {PuckData} from '@merlin/types';

import {createDefaultDescomplicandoTemplate} from '../../../components/puck/pageui/descomplicando/descomplicando-template/defaults';

export const DESCOMPLICANDO_TEMPLATE: PuckData = {
  root: {props: {}},
  content: [
    {
      type: 'Descomplicando',
      props: {
        id: 'descomplicando-root',
        ...createDefaultDescomplicandoTemplate(),
      },
    },
  ],
};
