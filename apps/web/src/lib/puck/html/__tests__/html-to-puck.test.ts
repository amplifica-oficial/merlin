// @vitest-environment happy-dom
import {describe, expect, it} from 'vitest';

import {buildHtmlDocument} from '../document';
import {HtmlImportError, htmlToPuckData} from '../import/html-to-puck';

const SAMPLE = `<!doctype html>
<html lang="pt-BR">
  <head>
    <title>Hello</title>
    <meta name="description" content="A landing page">
    <meta property="og:title" content="OG Hello">
    <link rel="icon" href="https://cdn.example/favicon.ico">
    <link rel="canonical" href="https://example.com/hello">
    <style>.hero { color: red; }</style>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body class="page">
    <section class="hero">
      <h1>Olá <strong>mundo</strong></h1>
      <a href="/go" class="cta">Start</a>
      <img src="img.png" alt="Pic">
      <form action="/submit"><input name="email"></form>
    </section>
    <script>console.log(1)</script>
  </body>
</html>`;

describe('htmlToPuckData', () => {
  it('maps elements, head metadata, and scripts', () => {
    const result = htmlToPuckData(SAMPLE, {baseUrl: 'https://example.com/landing/'});

    expect(result.settings).toMatchObject({
      title: 'Hello',
      description: 'A landing page',
      ogTitle: 'OG Hello',
      faviconUrl: 'https://cdn.example/favicon.ico',
      canonicalUrl: 'https://example.com/hello',
    });
    expect(result.data.root.props.headHtml).toContain('.hero');
    expect(result.data.root.props.headHtml).not.toContain('<script');
    expect(result.data.root.props.htmlAttributes).toEqual([{name: 'lang', value: 'pt-BR'}]);
    expect(result.data.root.props.bodyAttributes).toEqual([{name: 'class', value: 'page'}]);
    expect(result.report.scripts).toBe(2);

    const scripts = result.data.root.props.scripts as Array<{src?: string; placement: string; runInEditor: boolean}>;
    expect(scripts[0]).toMatchObject({
      src: 'https://cdn.tailwindcss.com',
      placement: 'head',
      runInEditor: true,
    });
    expect(scripts[1]).toMatchObject({placement: 'body', runInEditor: false, content: 'console.log(1)'});

    const section = result.data.content[0] as {type: string; props: Record<string, unknown>};
    expect(section.type).toBe('HtmlElement');
    expect(section.props).toMatchObject({tag: 'section', className: 'hero'});

    const children = section.props.children as Array<{type: string; props: Record<string, unknown>}>;
    expect(children.map(child => child.type)).toEqual(['HtmlText', 'HtmlLink', 'HtmlImage', 'HtmlRaw']);
    expect(children[0]?.props).toMatchObject({tag: 'h1', richSafe: true, html: 'Olá <strong>mundo</strong>'});
    expect(children[1]?.props).toMatchObject({tag: 'a', href: 'https://example.com/go', label: 'Start'});
    expect(children[2]?.props).toMatchObject({src: 'https://example.com/landing/img.png', alt: 'Pic'});
    expect(children[3]?.props.tag).toBe('form');
    expect(result.report.rawFallbacks).toBeGreaterThan(0);
  });

  it('keeps hash and mailto links relative to the page', () => {
    const result = htmlToPuckData('<a href="#pricing">Price</a><a href="mailto:a@b.co">Mail</a>', {
      baseUrl: 'https://example.com/landing/',
    });
    const links = result.data.content as Array<{props: {href: string}}>;
    expect(links.map(link => link.props.href)).toEqual(['#pricing', 'mailto:a@b.co']);
  });

  it('collapses the remaining tree once the block limit is hit', () => {
    const result = htmlToPuckData('<div>one</div><div>two</div><div>three</div>', {maxBlocks: 1});
    expect(result.data.content).toHaveLength(2);
    expect(result.data.content[0]).toMatchObject({type: 'HtmlText'});
    expect(result.data.content[1]).toMatchObject({type: 'HtmlRaw'});
    expect(result.report.rawFallbacks).toBeGreaterThan(0);
  });

  it('rejects documents over the size limit', () => {
    expect(() => htmlToPuckData('<p>hello</p>', {maxBytes: 4})).toThrow(HtmlImportError);
  });

  it('round-trips tags, classes, and attributes through the static document', () => {
    const imported = htmlToPuckData(SAMPLE, {baseUrl: 'https://example.com/landing/'});
    const exported = buildHtmlDocument({
      data: imported.data,
      settings: imported.settings,
      pageUrl: 'https://dash.example/p/hello',
      name: 'Hello',
      includeTracking: false,
    });
    const again = htmlToPuckData(exported);

    const originalSection = imported.data.content[0] as {
      props: {className: string; children: Array<{type: string; props: {className?: string; tag?: string}}>};
    };
    const exportedSection = again.data.content[0] as {
      props: {className: string; children: Array<{type: string; props: {className?: string; tag?: string}}>};
    };
    expect(exportedSection.props.className).toBe(originalSection.props.className);
    expect(exportedSection.props.children.map(child => child.type)).toEqual(
      originalSection.props.children.map(child => child.type),
    );
    expect(exported).toContain('class="hero"');
    expect(exported).toContain('class="cta"');
    expect(exported).toContain('<h1>Olá <strong>mundo</strong></h1>');
    expect(exported).not.toContain('data-puck');
    expect(exported.indexOf('cdn.tailwindcss.com')).toBeLessThan(exported.indexOf('<body'));
    expect(exported.lastIndexOf('console.log(1)')).toBeGreaterThan(exported.indexOf('</form>'));
  });
});
