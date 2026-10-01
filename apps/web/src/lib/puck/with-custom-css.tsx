import type {ComponentConfig, Config} from '@puckeditor/core';
import React from 'react';

import {sanitizeCss, scopeCss} from './sanitize-css';

export const CUSTOM_CSS_FIELD = {
  type: 'textarea' as const,
  label: 'Custom CSS',
};

export function withCustomCss(component: ComponentConfig): ComponentConfig {
  const originalResolve = component.resolveFields;

  return {
    ...component,
    defaultProps: {
      ...(component.defaultProps ?? {}),
      customCss: '',
    },
    fields: {
      ...(component.fields ?? {}),
      customCss: CUSTOM_CSS_FIELD,
    },
    resolveFields: originalResolve
      ? async (data, params) => {
          const fields = await originalResolve(data, params);
          return {
            ...fields,
            customCss: CUSTOM_CSS_FIELD,
          };
        }
      : undefined,
    render: props => {
      const id = typeof props.id === 'string' ? props.id : '';
      const css = typeof props.customCss === 'string' ? props.customCss : '';
      const scoped = id ? scopeCss(id, css) : sanitizeCss(css);

      return (
        <>
          {scoped ? <style>{scoped}</style> : null}
          <div data-lp-block={id} style={{display: 'contents'}}>
            {component.render(props)}
          </div>
        </>
      );
    },
  };
}

export function applyCustomCssToComponents<C extends Config>(config: C): C {
  const components = Object.fromEntries(
    Object.entries(config.components ?? {}).map(([name, component]) => [name, withCustomCss(component)]),
  );

  return {
    ...config,
    components,
  };
}
