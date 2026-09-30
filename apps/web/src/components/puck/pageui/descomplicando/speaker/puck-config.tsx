import type {ComponentConfig} from '@puckeditor/core';

import {puckImageUrlField} from '../../../shared/puckImageUrlField';

import {createDefaultDescomplicandoSpeaker} from './defaults';
import {PuckDescomplicandoSpeakerBlock} from './PuckDescomplicandoSpeakerBlock';
import type {DescomplicandoSpeakerProps} from './types';

export const descomplicandoSpeakerPuckComponent: ComponentConfig<DescomplicandoSpeakerProps> = {
  label: 'Descomplicando Speaker',
  defaultProps: createDefaultDescomplicandoSpeaker(),
  fields: {
    imageSrc: puckImageUrlField('Photo'),
    imageAlt: {type: 'text', label: 'Photo alt'},
    eyebrow: {type: 'text', label: 'Eyebrow', contentEditable: true},
    name: {type: 'text', label: 'Name', contentEditable: true},
    bio: {type: 'textarea', label: 'Bio', contentEditable: true},
  },
  render: props => <PuckDescomplicandoSpeakerBlock {...props} />,
};
