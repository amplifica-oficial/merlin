import type {Config} from '@puckeditor/core';
import type {HtmlAttribute, HtmlPageScript} from '@merlin/types';

import {
  HtmlElementRender,
  HtmlImageRender,
  HtmlLinkRender,
  HtmlRawRender,
  HtmlRootRender,
  HtmlTextRender,
  htmlElementFields,
  htmlImageFields,
  htmlLinkFields,
  htmlRawFields,
  htmlTextFields,
  type HtmlElementProps,
  type HtmlImageProps,
  type HtmlLinkProps,
  type HtmlRawProps,
  type HtmlTextProps,
} from './components';

type HtmlPageComponents = {
  HtmlElement: HtmlElementProps;
  HtmlText: HtmlTextProps;
  HtmlLink: HtmlLinkProps;
  HtmlImage: HtmlImageProps;
  HtmlRaw: HtmlRawProps;
};

const attributeArray = {
  type: 'array' as const,
  label: 'Attributes',
  arrayFields: {
    name: {type: 'text' as const, label: 'Name'},
    value: {type: 'text' as const, label: 'Value'},
  },
  defaultItemProps: {name: '', value: ''},
  getItemSummary: (item: HtmlAttribute) => item.name || 'Attribute',
};

export const htmlPuckConfig: Config<HtmlPageComponents> = {
  categories: {
    html: {
      title: 'HTML',
      components: ['HtmlElement', 'HtmlText', 'HtmlLink', 'HtmlImage', 'HtmlRaw'],
    },
  },
  root: {
    defaultProps: {
      headHtml: '',
      htmlAttributes: [],
      bodyAttributes: [],
      scripts: [],
    },
    fields: {
      headHtml: {type: 'textarea', label: 'Head HTML'},
      htmlAttributes: {...attributeArray, label: 'HTML attributes'},
      bodyAttributes: {...attributeArray, label: 'Body attributes'},
      scripts: {
        type: 'array',
        label: 'Scripts',
        arrayFields: {
          src: {type: 'text', label: 'Source URL'},
          content: {type: 'textarea', label: 'Inline script'},
          placement: {
            type: 'select',
            label: 'Placement',
            options: [
              {label: 'Head', value: 'head'},
              {label: 'End of body', value: 'body'},
            ],
          },
          runInEditor: {
            type: 'radio',
            label: 'Run in editor',
            options: [
              {label: 'Yes', value: true},
              {label: 'No', value: false},
            ],
          },
          attributes: attributeArray,
        },
        defaultItemProps: {
          src: '',
          content: '',
          placement: 'body',
          runInEditor: false,
          attributes: [],
        },
        getItemSummary: (item: HtmlPageScript) => item.src || 'Inline script',
      },
    },
    render: HtmlRootRender,
  },
  components: {
    HtmlElement: {
      label: 'HTML element',
      defaultProps: {tag: 'div', className: '', style: '', attributes: [], children: []},
      fields: htmlElementFields,
      render: HtmlElementRender,
    },
    HtmlText: {
      label: 'HTML text',
      defaultProps: {tag: 'p', className: '', style: '', attributes: [], html: '', richSafe: false},
      fields: htmlTextFields,
      render: HtmlTextRender,
    },
    HtmlLink: {
      label: 'HTML link',
      defaultProps: {tag: 'a', className: '', style: '', attributes: [], href: '', target: '', label: 'Link'},
      fields: htmlLinkFields,
      render: HtmlLinkRender,
    },
    HtmlImage: {
      label: 'HTML image',
      defaultProps: {className: '', style: '', attributes: [], src: '', alt: ''},
      fields: htmlImageFields,
      render: HtmlImageRender,
    },
    HtmlRaw: {
      label: 'HTML raw',
      defaultProps: {tag: 'div', className: '', style: '', attributes: [], html: ''},
      fields: htmlRawFields,
      render: HtmlRawRender,
    },
  },
};

export type {HtmlPageComponents};
