import type {ComponentConfig} from '@puckeditor/core';

import {createDefaultDescomplicandoAgenda} from './defaults';
import {PuckDescomplicandoAgendaBlock} from './PuckDescomplicandoAgendaBlock';
import type {DescomplicandoAgendaProps} from './types';

export const descomplicandoAgendaPuckComponent: ComponentConfig<DescomplicandoAgendaProps> = {
  label: 'Descomplicando Agenda',
  defaultProps: createDefaultDescomplicandoAgenda(),
  fields: {
    title: {type: 'text', label: 'Title', contentEditable: true},
    bulletOne: {type: 'textarea', label: 'First topic', contentEditable: true},
    bulletTwo: {type: 'textarea', label: 'Second topic', contentEditable: true},
    invite: {type: 'textarea', label: 'Invite', contentEditable: true},
  },
  render: props => <PuckDescomplicandoAgendaBlock {...props} />,
};
