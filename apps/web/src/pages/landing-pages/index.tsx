import {
  Badge,
  Button,
  Card,
  CardContent,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  IconSpinner,
  Input,
  Label,
} from '@merlin/ui';
import type {LandingPage} from '@merlin/db';
import {LandingPageSchemas} from '@merlin/shared';
import {EMPTY_PUCK_DATA, type LandingPageSettings, type PuckData} from '@merlin/types';
import {ClipboardCopy, Edit, ExternalLink, Layout, Plus, Search, Settings, Trash2} from 'lucide-react';
import {NextSeo} from 'next-seo';
import Link from 'next/link';
import {useRouter} from 'next/router';
import {useMemo, useState} from 'react';
import {toast} from 'sonner';
import useSWR from 'swr';

import {DashboardLayout} from '../../components/DashboardLayout';
import {isLandingPageSlugReady, LandingPageSlugField} from '../../components/landing-pages/LandingPageSlugField';
import {HtmlImportForm} from '../../components/landing-pages/HtmlImportForm';
import {LandingPageHtmlActions} from '../../components/landing-pages/LandingPageHtmlActions';
import {LandingPageTemplatePicker} from '../../components/landing-pages/LandingPageTemplatePicker';
import {DASHBOARD_URI} from '../../lib/constants';
import {formatRelativeTime} from '../../lib/dateUtils';
import {network} from '../../lib/network';
import type {HtmlImportResult} from '../../lib/puck/html/import/html-to-puck';
import {LANDING_PAGE_TEMPLATES, type LandingPageTemplateId} from '../../lib/puck/templates/front-centre';

export default function LandingPagesPage() {
  const router = useRouter();
  const {
    data: pages,
    mutate,
    isLoading,
  } = useSWR<LandingPage[]>('/landing-pages', {
    revalidateOnFocus: false,
  });

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [pageToDelete, setPageToDelete] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createSlug, setCreateSlug] = useState('');
  const [createSlugReady, setCreateSlugReady] = useState(false);
  const [createSlugFieldKey, setCreateSlugFieldKey] = useState(0);
  const [createTemplate, setCreateTemplate] = useState<LandingPageTemplateId>('blank');
  const [createMode, setCreateMode] = useState<'template' | 'html'>('template');
  const [htmlImport, setHtmlImport] = useState<HtmlImportResult | null>(null);
  const [creating, setCreating] = useState(false);

  const filteredPages = useMemo(() => {
    if (!pages || !searchInput.trim()) return pages;
    const q = searchInput.toLowerCase();
    return pages.filter(p => p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q));
  }, [pages, searchInput]);

  const handleDelete = async () => {
    if (!pageToDelete) return;
    try {
      await network.fetch('DELETE', `/landing-pages/${pageToDelete}`);
      toast.success('Landing page deleted');
      void mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete landing page');
    } finally {
      setPageToDelete(null);
    }
  };

  const resetCreateDialog = () => {
    setCreateName('');
    setCreateSlug('');
    setCreateSlugReady(false);
    setCreateTemplate('blank');
    setCreateMode('template');
    setHtmlImport(null);
    setCreateSlugFieldKey(key => key + 1);
  };

  const copyLink = async (slug: string) => {
    const url = `${DASHBOARD_URI}/p/${slug}`;
    await navigator.clipboard.writeText(url);
    toast.success('Link copied to clipboard');
  };

  const handleCreate = async () => {
    const name = createName.trim();
    if (!name) {
      toast.error('Name is required');
      return;
    }
    if (!createSlugReady) {
      toast.error('Choose an available URL slug');
      return;
    }

    if (createMode === 'html' && !htmlImport) {
      toast.error('Paste or upload HTML first');
      return;
    }

    try {
      setCreating(true);
      const template = LANDING_PAGE_TEMPLATES.find(t => t.id === createTemplate);
      const payload = LandingPageSchemas.create.parse({
        name,
        slug: createSlug,
        data: createMode === 'html' ? (htmlImport?.data ?? EMPTY_PUCK_DATA) : (template?.data ?? EMPTY_PUCK_DATA),
        settings: createMode === 'html' ? (htmlImport?.settings ?? {}) : {},
        published: false,
        kind: createMode === 'html' ? 'HTML' : 'PUCK',
      });
      const page = await network.fetch<{id: string}, typeof LandingPageSchemas.create>(
        'POST',
        '/landing-pages',
        payload,
      );
      toast.success('Landing page created');
      setShowCreateDialog(false);
      resetCreateDialog();
      void router.push(`/landing-pages/edit/${page.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create landing page');
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <NextSeo title="Landing Pages" />
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900">Landing Pages</h1>
              <p className="text-neutral-500 mt-1">Build hosted pages with forms, content blocks, and more</p>
            </div>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Landing Page
            </Button>
          </div>

          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <Input
              placeholder="Search landing pages..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="pl-9"
            />
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <IconSpinner />
            </div>
          ) : !filteredPages?.length ? (
            <EmptyState
              icon={Layout}
              title={searchInput ? 'No landing pages found' : 'No landing pages yet'}
              description={
                searchInput
                  ? 'Try a different search term'
                  : 'Create a landing page and add your forms as blocks in the visual editor'
              }
              action={
                !searchInput ? (
                  <Button onClick={() => setShowCreateDialog(true)}>Create your first landing page</Button>
                ) : undefined
              }
            />
          ) : (
            <div className="grid gap-4">
              {filteredPages.map(page => (
                <Card key={page.id}>
                  <CardContent className="p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            href={`/landing-pages/${page.id}`}
                            className="text-lg font-semibold text-neutral-900 hover:underline truncate"
                          >
                            {page.name}
                          </Link>
                          <Badge variant={page.published ? 'default' : 'secondary'}>
                            {page.published ? 'Published' : 'Draft'}
                          </Badge>
                          {page.kind === 'HTML' ? <Badge variant="outline">HTML</Badge> : null}
                        </div>
                        <p className="text-sm text-neutral-500 truncate">/p/{page.slug}</p>
                        <p className="text-xs text-neutral-400">Created {formatRelativeTime(page.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        <Button variant="outline" size="sm" onClick={() => void copyLink(page.slug)}>
                          <ClipboardCopy className="h-4 w-4 mr-1" />
                          Copy link
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <a href={`/p/${page.slug}`} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/landing-pages/${page.id}`}>
                            <Settings className="h-4 w-4 mr-1" />
                            Settings
                          </Link>
                        </Button>
                        <LandingPageHtmlActions
                          page={{
                            id: page.id,
                            name: page.name,
                            slug: page.slug,
                            kind: page.kind,
                            published: page.published,
                            settings: (page.settings ?? {}) as LandingPageSettings,
                            getData: () => page.data as unknown as PuckData,
                          }}
                          onReimported={() => void mutate()}
                        />
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/landing-pages/edit/${page.id}`} title="Edit page content">
                            <Edit className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setPageToDelete(page.id);
                            setShowDeleteDialog(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <Dialog
          open={showCreateDialog}
          onOpenChange={open => {
            setShowCreateDialog(open);
            if (!open) {
              resetCreateDialog();
            }
          }}
        >
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Create landing page</DialogTitle>
            </DialogHeader>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={createMode === 'template' ? 'default' : 'outline'}
                onClick={() => setCreateMode('template')}
              >
                Template
              </Button>
              <Button
                type="button"
                size="sm"
                variant={createMode === 'html' ? 'default' : 'outline'}
                onClick={() => setCreateMode('html')}
              >
                Import HTML
              </Button>
            </div>
            {createMode === 'template' ? (
              <LandingPageTemplatePicker value={createTemplate} onChange={setCreateTemplate} />
            ) : (
              <HtmlImportForm onChange={setHtmlImport} />
            )}
            <div className="space-y-2">
              <Label htmlFor="landing-page-name">Name</Label>
              <Input
                id="landing-page-name"
                value={createName}
                onChange={e => setCreateName(e.target.value)}
                placeholder="Product launch"
                onKeyDown={e => {
                  if (e.key === 'Enter' && createSlugReady) void handleCreate();
                }}
              />
            </div>
            <LandingPageSlugField
              key={createSlugFieldKey}
              id="landing-page-slug"
              name={createName}
              slug={createSlug}
              onSlugChange={setCreateSlug}
              syncFromName
              onStatusChange={status => setCreateSlugReady(isLandingPageSlugReady(status))}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button
                disabled={creating || !createSlugReady || !createName.trim() || (createMode === 'html' && !htmlImport)}
                onClick={() => void handleCreate()}
              >
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ConfirmDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          onConfirm={() => void handleDelete()}
          title="Delete landing page"
          description="This will permanently delete the landing page. The public link will stop working."
          confirmText="Delete"
          variant="destructive"
        />
      </DashboardLayout>
    </>
  );
}
