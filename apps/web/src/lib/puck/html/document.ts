import type {LandingPageSettings, PuckData} from '@merlin/types';

import {escapeAttr, escapeHtml, openTag, readHtmlRoot, safeTag} from './markup';
import {serializeHtmlContent} from './serialize';

export interface BuildHtmlDocumentInput {
  data: PuckData;
  settings: LandingPageSettings;
  pageUrl: string;
  name: string;
  includeTracking?: boolean;
}

function safeId(value: string | undefined, pattern: RegExp): string | undefined {
  if (!value || !pattern.test(value)) {
    return undefined;
  }
  return value;
}

function seoHead(settings: LandingPageSettings, pageUrl: string, name: string, includeTracking: boolean): string {
  const pageTitle = settings.title || name;
  const pageDescription = settings.description;
  const ogTitle = settings.ogTitle || pageTitle;
  const ogDescription = settings.ogDescription || pageDescription;
  const canonicalUrl = includeTracking ? settings.canonicalUrl || pageUrl : undefined;
  const twitterCard = settings.twitterCard || (settings.ogImageUrl ? 'summary_large_image' : 'summary');

  const tags = [
    `<title>${escapeHtml(pageTitle)}</title>`,
    pageDescription ? `<meta name="description" content="${escapeAttr(pageDescription)}">` : '',
    canonicalUrl ? `<link rel="canonical" href="${escapeAttr(canonicalUrl)}">` : '',
    settings.faviconUrl ? `<link rel="icon" href="${escapeAttr(settings.faviconUrl)}">` : '',
    `<meta property="og:type" content="website">`,
    canonicalUrl ? `<meta property="og:url" content="${escapeAttr(canonicalUrl)}">` : '',
    `<meta property="og:title" content="${escapeAttr(ogTitle)}">`,
    ogDescription ? `<meta property="og:description" content="${escapeAttr(ogDescription)}">` : '',
    settings.ogImageUrl ? `<meta property="og:image" content="${escapeAttr(settings.ogImageUrl)}">` : '',
    `<meta name="twitter:card" content="${escapeAttr(twitterCard)}">`,
    `<meta name="twitter:title" content="${escapeAttr(ogTitle)}">`,
    ogDescription ? `<meta name="twitter:description" content="${escapeAttr(ogDescription)}">` : '',
    settings.ogImageUrl ? `<meta name="twitter:image" content="${escapeAttr(settings.ogImageUrl)}">` : '',
  ];

  return tags.filter(Boolean).join('');
}

function trackingHead(settings: LandingPageSettings): string {
  const parts: string[] = [];
  const gtmId = safeId(settings.gtmId, /^GTM-[A-Z0-9]+$/i);
  const ga4Id = safeId(settings.ga4Id, /^G-[A-Z0-9]+$/i);
  const fbPixelId = safeId(settings.fbPixelId, /^\d+$/);

  if (gtmId) {
    parts.push(
      `<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');</script>`,
    );
  }

  if (ga4Id) {
    parts.push(
      `<script async src="https://www.googletagmanager.com/gtag/js?id=${ga4Id}"></script>`,
      `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga4Id}');</script>`,
    );
  }

  if (fbPixelId) {
    parts.push(
      `<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${fbPixelId}');fbq('track','PageView');</script>`,
    );
  }

  return parts.join('');
}

function trackingBody(settings: LandingPageSettings): {start: string; end: string} {
  const gtmId = safeId(settings.gtmId, /^GTM-[A-Z0-9]+$/i);
  const fbPixelId = safeId(settings.fbPixelId, /^\d+$/);
  return {
    start: gtmId
      ? `<noscript><iframe title="Google Tag Manager" src="https://www.googletagmanager.com/ns.html?id=${gtmId}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>`
      : '',
    end: fbPixelId
      ? `<noscript><img alt="" height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${fbPixelId}&ev=PageView&noscript=1"></noscript>`
      : '',
  };
}

function scriptTag(script: ReturnType<typeof readHtmlRoot>['scripts'][number]): string {
  const extra = script.attributes
    .filter(attribute => attribute.name !== 'src')
    .map(attribute => ` ${attribute.name}="${escapeAttr(attribute.value)}"`)
    .join('');
  if (script.src) {
    return `<script${extra} src="${escapeAttr(script.src)}"></script>`;
  }
  const content = (script.content ?? '').replace(/<\/script/gi, '<\\/script');
  return `<script${extra}>${content}</script>`;
}

function elementOpen(tag: string, attributes: {name: string; value: string}[]): string {
  const safe = safeTag(tag, tag === 'html' ? 'html' : 'body');
  return openTag(safe, {attributes});
}

export function buildHtmlDocument({
  data,
  settings,
  pageUrl,
  name,
  includeTracking = true,
}: BuildHtmlDocumentInput): string {
  const root = readHtmlRoot(data);
  const tracking = includeTracking ? trackingBody(settings) : {start: '', end: ''};
  const headScripts = root.scripts
    .filter(script => script.placement !== 'body')
    .map(scriptTag)
    .join('');
  const bodyScripts = root.scripts
    .filter(script => script.placement === 'body')
    .map(scriptTag)
    .join('');
  const htmlOpen = elementOpen('html', root.htmlAttributes);
  const bodyOpen = elementOpen('body', root.bodyAttributes);
  const bodyInner = `${tracking.start}${serializeHtmlContent(data)}${tracking.end}${bodyScripts}`;

  return `<!doctype html>${htmlOpen}<head><meta charset="utf-8">${seoHead(settings, pageUrl, name, includeTracking)}${root.headHtml}${headScripts}${includeTracking ? trackingHead(settings) : ''}</head>${bodyOpen}${bodyInner}</body></html>`;
}
