import React from 'react';

import {SLOT_MIN_HEIGHT} from '../shared/fields';
import sharedStyles from '../shared/styles.module.css';
import {gridColumnForWidth} from './defaults';
import type {GridCellPuckRenderProps} from './types';

function assignRef<T>(ref: React.Ref<T>, value: T | null) {
  if (typeof ref === 'function') {
    ref(value);
    return;
  }

  if (ref) {
    ref.current = value;
  }
}

export function PuckGridCellBlock({content: Content, width, puck}: GridCellPuckRenderProps) {
  return (
    <div
      ref={node => assignRef(puck.dragRef, node)}
      className={sharedStyles.cell}
      style={{gridColumn: gridColumnForWidth(width)}}
    >
      <Content className={sharedStyles.cellContent} collisionAxis="y" minEmptyHeight={SLOT_MIN_HEIGHT} />
    </div>
  );
}
