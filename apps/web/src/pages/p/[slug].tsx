import '@puckeditor/core/puck.css';

import type {Data} from '@puckeditor/core';
import {Render} from '@puckeditor/core';
import {isLandingPageUuidShape} from '@merlin/shared';
import type {PublicLandingPageConfig} from '@merlin/types';
import type {GetServerSideProps} from 'next';

import {LandingPagePublicHead} from '../../components/LandingPagePublicHead';
import {API_URI, DASHBOARD_URI} from '../../lib/constants';
import {puckConfig} from '../../lib/puck/config';
import {buildHtmlDocument} from '../../lib/puck/html/document';
import {normalizePuckData} from '../../lib/puck/normalize-data';

interface PublicLandingPageProps {
  config?: PublicLandingPageConfig;
}

export default function PublicLandingPage({config}: PublicLandingPageProps) {
  if (!config) {
    return null;
  }

  const pageUrl = `${DASHBOARD_URI}/p/${config.slug}`;

  return (
    <>
      <LandingPagePublicHead
        name={config.name}
        publicId={config.publicId}
        pageUrl={pageUrl}
        settings={config.settings}
      />
      <Render config={puckConfig} data={normalizePuckData(config.data) as Data} />
    </>
  );
}

export const getServerSideProps: GetServerSideProps<PublicLandingPageProps> = async ctx => {
  const slug = ctx.params?.slug;
  if (!slug || typeof slug !== 'string') {
    return {notFound: true};
  }

  try {
    const response = await fetch(`${API_URI}/landing-pages/public/${encodeURIComponent(slug)}`);

    if (response.status === 404) {
      return {notFound: true};
    }

    if (!response.ok) {
      throw new Error(`Failed to load landing page (${response.status})`);
    }

    const config = (await response.json()) as PublicLandingPageConfig;

    if (isLandingPageUuidShape(slug) && config.slug && slug !== config.slug) {
      return {
        redirect: {
          destination: `/p/${encodeURIComponent(config.slug)}`,
          permanent: false,
        },
      };
    }

    ctx.res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');

    if (config.kind === 'HTML') {
      const html = buildHtmlDocument({
        data: config.data,
        settings: config.settings,
        pageUrl: `${DASHBOARD_URI}/p/${config.slug}`,
        name: config.name,
      });
      ctx.res.setHeader('Content-Type', 'text/html; charset=utf-8');
      ctx.res.statusCode = 200;
      ctx.res.end(html);
      return {props: {}};
    }

    return {props: {config}};
  } catch {
    return {notFound: true};
  }
};
