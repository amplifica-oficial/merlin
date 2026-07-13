import type {BaseLayoutProps} from 'fumadocs-ui/layouts/shared';
import {AppWindowIcon, GithubIcon, MessageSquareShareIcon} from 'lucide-react';
import Image from 'next/image';
import React from 'react';

/**
 * Shared layout configurations
 *
 * you can customise layouts individually from:
 * Home Layout: app/(home)/layout.tsx
 * Docs Layout: app/docs/layout.tsx
 */
export const baseOptions: BaseLayoutProps = {
  themeSwitch: {
    enabled: false,
  },
  nav: {
    title: (
      <div className="flex items-center gap-2">
        <Image src="/assets/logo.png" alt="Merlin" width={24} height={24} className="rounded" />
        <span>Merlin</span>
      </div>
    ),
  },
  links: [
    {
      icon: <AppWindowIcon />,
      text: 'Dashboard',
      url: 'https://next-app.merlin.example',
    },
    {
      icon: <GithubIcon />,
      text: 'GitHub',
      url: 'https://github.com/amplifica-oficial/merlin',
    },
    {
      icon: <MessageSquareShareIcon />,
      text: 'Discord',
      url: 'https://merlin.example/discord',
    },
  ],
};
