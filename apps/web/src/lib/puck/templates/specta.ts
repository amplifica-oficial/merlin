import type {PuckData} from '@merlin/types';

import {createDefaultSpectaTemplate} from '../../../components/puck/pageui/specta/specta-template/defaults';

export const SPECTA_TEMPLATE: PuckData = {
  root: {props: {}},
  content: [
    {
      type: 'Specta',
      props: {
        id: 'specta-root',
        ...createDefaultSpectaTemplate(),
      },
    },
  ],
};
