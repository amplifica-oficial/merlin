import './global.css';
import {DocsLayout} from 'fumadocs-ui/layouts/docs';
import {RootProvider} from 'fumadocs-ui/provider/next';
import Script from 'next/script';
import type {ReactNode} from 'react';
import React from 'react';

import {baseOptions} from '@/app/layout.config';
import {source} from '@/lib/source';

export default function Layout({children}: {children: ReactNode}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Runtime environment configuration - must load before any app code */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/__env.js" />

        {/* Primary Meta Tags */}
        <title>Merlin Documentation</title>
        <meta name="title" content="Merlin Documentation" />
        <meta
          name="description"
          content="Documentation for Merlin, the open-source email platform. Learn how to integrate Merlin into your application and manage your email communications."
        />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://docs.merlin.example/" />
        <meta property="og:title" content="Merlin Documentation" />
        <meta
          property="og:description"
          content="Documentation for Merlin, the open-source email platform. Learn how to integrate Merlin into your application and manage your email communications."
        />
        <meta property="og:image" content="https://docs.merlin.example/api/og?title=Documentation" />

        {/* Twitter */}
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:url" content="https://docs.merlin.example/" />
        <meta property="twitter:title" content="Merlin Documentation" />
        <meta
          property="twitter:description"
          content="Documentation for Merlin, the open-source email platform. Learn how to integrate Merlin into your application and manage your email communications."
        />
        <meta property="twitter:image" content="https://docs.merlin.example/api/og?title=Documentation" />

        {/* Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@100;200;300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />

        {/* Favicon */}
        <link rel="icon" type="image/svg+xml" href="/favicon/favicon.svg" />
        <link rel="icon" type="image/png" href="/favicon/favicon-32x32.png" sizes="32x32" />
        <link rel="icon" type="image/png" href="/favicon/favicon-16x16.png" sizes="16x16" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/favicon/apple-touch-icon.png" />
        <link rel="mask-icon" href="/favicon/safari-pinned-tab.svg" color="#5bbad5" />
        <meta name="apple-mobile-web-app-title" content="Merlin" />
        <meta name="application-name" content="Merlin" />
        <meta name="msapplication-TileColor" content="#da532c" />
        <meta name="theme-color" content="#ffffff" />
        <link rel="manifest" href="/favicon/site.webmanifest" />
      </head>
      <Script
        defer
        src="https://analytics.driaug.com/script.js"
        data-website-id="ba0b7094-e693-492e-902a-c62aab868715"
        data-domains="docs.merlin.example"
      />
      <body className="flex flex-col min-h-screen antialiased text-neutral-800" suppressHydrationWarning>
        <RootProvider
          theme={{
            enabled: false,
          }}
        >
          <DocsLayout
            tree={source.pageTree}
            {...baseOptions}
            sidebar={{
              banner: (
                <p className="rounded-lg border border-fd-border bg-fd-muted/40 px-3 py-2 text-[11px] leading-snug text-fd-muted-foreground">
                  Modified version of{' '}
                  <a
                    href="https://github.com/useplunk/plunk"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-fd-foreground underline decoration-dotted underline-offset-2 hover:text-fd-primary"
                  >
                    Plunk
                  </a>{' '}
                  · AGPL-3.0
                  <br />
                  Mods ©{' '}
                  <a
                    href="https://github.com/amplifica-oficial/merlin/blob/next/NOTICE"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-fd-foreground underline decoration-dotted underline-offset-2 hover:text-fd-primary"
                  >
                    Amplifica Soluções Digitais LTDA
                  </a>
                </p>
              ),
            }}
          >
            {children}
          </DocsLayout>
        </RootProvider>
      </body>
    </html>
  );
}
