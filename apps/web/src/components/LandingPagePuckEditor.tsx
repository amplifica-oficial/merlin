
import '@puckeditor/core/puck.css';

import {Puck, type Data} from '@puckeditor/core';
import {Button, IconSpinner} from '@merlin/ui';
import {LandingPageSchemas} from '@merlin/shared';
import {ArrowLeft, Save} from 'lucide-react';
import Link from 'next/link';
import {useRouter} from 'next/router';
import {useCallback, useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import {toast} from 'sonner';

import {network} from '../lib/network';
import {puckConfig} from '../lib/puck/config';
import {normalizePuckData} from '../lib/puck/normalize-data';

import {ElementInspector} from './landing-pages/ai/ElementInspector';
import {InspectorToggle} from './landing-pages/ai/InspectorToggle';
import {LandingAiProvider} from './landing-pages/ai/LandingAiProvider';
import {RightSidebarTabs} from './landing-pages/ai/RightSidebarTabs';

interface LandingPageRecord {
  id: string;
  name: string;
  published: boolean;
  data: Data;
}

interface LandingPagePuckEditorProps {
  landingPageId: string;
}

function normalizeData(data: unknown): Data {
  return normalizePuckData(data);
}

export default function LandingPagePuckEditor({landingPageId}: LandingPagePuckEditorProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState<LandingPageRecord | null>(null);
  const [data, setData] = useState<Data>(() => normalizePuckData(null));
  const dataRef = useRef<Data>(data);

  useEffect(() => {
    const fetchPage = async () => {
      try {
        setLoading(true);
        const result = await network.fetch<LandingPageRecord>('GET', `/landing-pages/${landingPageId}`);
        const normalized = normalizeData(result.data);
        dataRef.current = normalized;
        setPage(result);
        setData(normalized);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to load landing page');
        void router.push('/landing-pages');
      } finally {
        setLoading(false);
      }
    };

    void fetchPage();
  }, [landingPageId, router]);

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
        dataRef.current = normalizeData(updated.data);
        setPage(updated);
        toast.success(publish ? 'Landing page published' : 'Landing page saved');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to save landing page');
      } finally {
        setSaving(false);
      }
    },
    [landingPageId],
  );

  const onPuckChange = useCallback((next: Data) => {
    dataRef.current = next;
  }, []);

  const onPublish = useCallback(
    (nextData: Data) => {
      dataRef.current = nextData;
      void save(nextData, true);
    },
    [save],
  );

  const overrides = useMemo(
    () => ({
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
    }),
    [landingPageId],
  );

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
          key={landingPageId}
          config={puckConfig}
          data={data}
          onChange={onPuckChange}
          onPublish={onPublish}
          headerTitle={page.name}
          height="100%"
          overrides={overrides}
        />
      </div>
    </div>
  );
}
