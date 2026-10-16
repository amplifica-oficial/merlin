import type {PuckData} from '@merlin/types';
import {describe, expect, it} from 'vitest';

import {planChatGptOpen} from '../chatgpt';
import {buildHtmlDocument} from '../document';
import {minifyHtml} from '../minify';

const data: PuckData = {
  root: {
    props: {
      headHtml: '<style>.hero{color:red}</style>',
      htmlAttributes: [{name: 'lang', value: 'pt-BR'}],
      bodyAttributes: [{name: 'class', value: 'page'}],
      scripts: [
        {src: 'https://cdn.example/a.js', attributes: [], placement: 'head', runInEditor: false},
        {content: 'console.log(1)', attributes: [], placement: 'body', runInEditor: false},
      ],
    },
  },
  content: [
    {
      type: 'HtmlElement',
      props: {
        id: 'section',
        tag: 'section',
        className: 'hero',
        style: '',
        attributes: [{name: 'onclick', value: 'alert(1)'}],
        children: [
          {
            type: 'HtmlText',
            props: {
              id: 'title',
              tag: 'h1',
              className: '',
              style: '',
              attributes: [],
              html: 'Olá <strong>mundo</strong>',
              richSafe: true,
            },
          },
        ],
      },
    },
  ],
};

describe('buildHtmlDocument', () => {
  it('emits a standalone document without editor wrappers', () => {
    const html = buildHtmlDocument({
      data,
      settings: {title: 'Hello', gtmId: 'GTM-ABC', canonicalUrl: 'https://example.com/hello'},
      pageUrl: 'https://dash.example/p/hello',
      name: 'Hello',
    });

    expect(html.startsWith('<!doctype html><html lang="pt-BR">')).toBe(true);
    expect(html).toContain('<title>Hello</title>');
    expect(html).toContain('rel="canonical" href="https://example.com/hello"');
    expect(html).toContain('<style>.hero{color:red}</style>');
    expect(html).toContain('src="https://cdn.example/a.js"');
    expect(html).toContain('<body class="page">');
    expect(html).toContain('<section class="hero" onclick="alert(1)"><h1>Olá <strong>mundo</strong></h1></section>');
    expect(html).toContain('GTM-ABC');
    expect(html.indexOf('cdn.example/a.js')).toBeLessThan(html.indexOf('<body'));
    expect(html.indexOf('console.log(1)')).toBeGreaterThan(html.indexOf('<h1>'));
    expect(html).not.toContain('data-puck');
    expect(html).not.toContain('<div class="rich-text"');
  });

  it('omits tracking snippets when requested', () => {
    const html = buildHtmlDocument({
      data,
      settings: {gtmId: 'GTM-ABC', ga4Id: 'G-123', fbPixelId: '999', canonicalUrl: 'https://example.com/hello'},
      pageUrl: 'https://dash.example/p/hello',
      name: 'Hello',
      includeTracking: false,
    });

    expect(html).not.toContain('GTM-ABC');
    expect(html).not.toContain('G-123');
    expect(html).not.toContain('fbevents');
    expect(html).not.toContain('rel="canonical"');
  });
});

describe('minifyHtml', () => {
  it('strips comments and repeated whitespace without touching protected tags', () => {
    const html = '<div>  hello  </div><!-- note --><pre>  a  \n  b  </pre><script>const x = 1;</script>';
    const minified = minifyHtml(html);
    expect(minified).not.toContain('<!--');
    expect(minified).toContain('<pre>  a  \n  b  </pre>');
    expect(minified).toContain('<script>const x = 1;</script>');
    expect(minified).toContain('<div> hello </div>');
  });
});

describe('planChatGptOpen', () => {
  it('puts short pages in the chatgpt.com query string', () => {
    const plan = planChatGptOpen('<p>Hi</p>');
    expect(plan.mode).toBe('url');
    if (plan.mode !== 'url') {
      return;
    }
    expect(plan.url.startsWith('https://chatgpt.com/?q=')).toBe(true);
    expect(plan.url.length).toBeLessThanOrEqual(8000);
    expect(decodeURIComponent(plan.url)).toContain('<p>Hi</p>');
  });

  it('falls back to the clipboard when the encoded url is too long', () => {
    const plan = planChatGptOpen(`<p>${'x'.repeat(5000)}</p>`, 1000);
    expect(plan.mode).toBe('clipboard');
    if (plan.mode !== 'clipboard') {
      return;
    }
    expect(plan.url.startsWith('https://chatgpt.com/?q=')).toBe(true);
    expect(plan.url.length).toBeLessThanOrEqual(1000);
    expect(plan.clipboardText).toContain('x'.repeat(5000));
  });
});
