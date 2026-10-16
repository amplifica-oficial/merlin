import '@puckeditor/core/puck.css';

import {migrate, Puck, type Data} from '@puckeditor/core';
import {Button, IconSpinner} from '@merlin/ui';
import {LandingPageSchemas} from '@merlin/shared';
import type {LandingPageSettings, PuckData} from '@merlin/types';
import {ArrowLeft, Eye, Save} from 'lucide-react';
import Link from 'next/link';
import {useRouter} from 'next/router';
import {useCallback, useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import {toast} from 'sonner';

import {network} from '../lib/network';
import {puckConfig} from '../lib/puck/config';
import {htmlPuckConfig} from '../lib/puck/html/config';
import {HtmlEditorFrame} from '../lib/puck/html/HtmlEditorFrame';
import {readHtmlRoot} from '../lib/puck/html/markup';
import {normalizePuckData} from '../lib/puck/normalize-data';

import {LandingPageHtmlActions, renderLandingHtml} from './landing-pages/LandingPageHtmlActions';
import {ElementInspector} from './landing-pages/ai/ElementInspector';
import {InspectorToggle} from './landing-pages/ai/InspectorToggle';
import {LandingAiProvider} from './landing-pages/ai/LandingAiProvider';
import {RightSidebarTabs} from './landing-pages/ai/RightSidebarTabs';

interface LandingPageRecord {
  id: string;
  name: string;
  slug: string;
  kind: 'PUCK' | 'HTML';
  published: boolean;
  data: Data;
  settings: LandingPageSettings;
}

interface LandingPagePuckEditorProps {
  landingPageId: string;
}

function normalizeData(data: unknown, kind: LandingPageRecord['kind']): Data {
  if (kind === 'HTML') {
    if (!data || typeof data !== 'object') {
      return {root: {props: {}}, content: []} as Data;
    }
    return migrate(data as Data, htmlPuckConfig) as Data;
  }
  return normalizePuckData(data);
}

export default function LandingPagePuckEditor({landingPageId}: LandingPagePuckEditorProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState<LandingPageRecord | null>(null);
  const [data, setData] = useState<Data>(() => normalizePuckData(null));
  const [editorKey, setEditorKey] = useState(0);
  const dataRef = useRef<Data>(data);
  const isHtml = page?.kind === 'HTML';

  const loadPage = useCallback(async () => {
    try {
      setLoading(true);
      const result = await network.fetch<LandingPageRecord & {settings: unknown}>(
        'GET',
        `/landing-pages/${landingPageId}`,
      );
      const normalized = normalizeData(result.data, result.kind);
      const nextPage = {...result, settings: (result.settings ?? {}) as LandingPageSettings};
      dataRef.current = normalized;
      setPage(nextPage);
      setData(normalized);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load landing page');
      void router.push('/landing-pages');
    } finally {
      setLoading(false);
    }
  }, [landingPageId, router]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const save = useCallback(
    async (nextData: Data, publish?: boolean) => {
      try {
        setSaving(true);
        const payload = LandingPageSchemas.update.parse({
          data: nextData,
          ...(publish !== undefined ? {published: publish} : {}),
        });
        const updated = await network.fetch<LandingPageRecord, typeof LandingPageSchemas.update>(
          'PATCH',
          `/landing-pages/${landingPageId}`,
          payload,
        );
        dataRef.current = normalizeData(updated.data, updated.kind ?? page?.kind ?? 'PUCK');
        setPage(current => (current ? {...current, ...updated, settings: current.settings} : updated));
        toast.success(publish ? 'Landing page published' : 'Landing page saved');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to save landing page');
      } finally {
        setSaving(false);
      }
    },
    [landingPageId, page?.kind],
  );

  const onPuckChange = useCallback(
    (next: Data) => {
      dataRef.current = next;
      setData(current => {
        if (page?.kind !== 'HTML') {
          return current;
        }
        return JSON.stringify(readHtmlRoot(current)) === JSON.stringify(readHtmlRoot(next)) ? current : next;
      });
    },
    [page?.kind],
  );

  const onPublish = useCallback(
    (nextData: Data) => {
      dataRef.current = nextData;
      void save(nextData, true);
    },
    [save],
  );

  const frameRoot = useMemo(() => readHtmlRoot(data), [data]);

  const overrides = useMemo(() => {
    if (isHtml) {
      return {
        iframe: ({children, document: iframeDocument}: {children: ReactNode; document?: Document}) => (
          <HtmlEditorFrame document={iframeDocument} root={frameRoot}>
            {children}
          </HtmlEditorFrame>
        ),
      };
    }

    return {
      puck: ({children}: {children: ReactNode}) => (
        <LandingAiProvider landingPageId={landingPageId}>
          {children}
          <ElementInspector />
        </LandingAiProvider>
      ),
      headerActions: ({children}: {children: ReactNode}) => (
        <>
          <InspectorToggle compact />
          {children}
        </>
      ),
      fields: ({children}: {children: ReactNode}) => <RightSidebarTabs>{children}</RightSidebarTabs>,
    };
  }, [frameRoot, isHtml, landingPageId]);

  if (loading || !page) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-neutral-100">
        <IconSpinner />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-100">
      <div className="flex items-center justify-between gap-4 border-b border-neutral-200 bg-white px-4 py-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Button asChild variant="outline" size="sm">
            <Link href={`/landing-pages/${landingPageId}`}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Link>
          </Button>
          <div className="min-w-0">
            <p className="font-semibold text-neutral-900 truncate">{page.name}</p>
            <p className="text-xs text-neutral-500">Page editor</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isHtml ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const html = renderLandingHtml(
                  {
                    id: page.id,
                    name: page.name,
                    slug: page.slug,
                    kind: page.kind,
                    published: page.published,
                    settings: page.settings,
                    getData: () => dataRef.current as unknown as PuckData,
                  },
                  true,
                );
                const url = URL.createObjectURL(new Blob([html], {type: 'text/html'}));
                window.open(url, '_blank', 'noopener,noreferrer');
              }}
            >
              <Eye className="h-4 w-4 mr-1" />
              Preview
            </Button>
          ) : null}
          <LandingPageHtmlActions
            page={{
              id: page.id,
              name: page.name,
              slug: page.slug,
              kind: page.kind,
              published: page.published,
              settings: page.settings,
              getData: () => dataRef.current as unknown as PuckData,
            }}
            onReimported={() => {
              setEditorKey(key => key + 1);
              void loadPage();
            }}
          />
          <Button variant="outline" size="sm" disabled={saving} onClick={() => void save(dataRef.current)}>
            <Save className="h-4 w-4 mr-1" />
            Save
          </Button>
          <Button size="sm" disabled={saving} onClick={() => void save(dataRef.current, true)}>
            Publish
          </Button>
        </div>
      </div>
      <div className="flex-1 min-h-0 [&_.Puck]:h-full [&_[class*='FieldsPlugin']]:flex [&_[class*='FieldsPlugin']]:min-h-0 [&_[class*='FieldsPlugin']]:flex-col [&_[class*='FieldsPlugin']]:overflow-hidden">
        <Puck
          key={`${landingPageId}-${page.kind}-${editorKey}`}
          config={isHtml ? htmlPuckConfig : puckConfig}
          data={data}
          onChange={onPuckChange}
          onPublish={onPublish}
          headerTitle={page.name}
          height="100%"
          overrides={overrides}
          iframe={isHtml ? {enabled: true, syncHostStyles: false} : undefined}
        />
      </div>
    </div>
  );
}
