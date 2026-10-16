import {
  Button,
  Checkbox,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Label,
} from '@merlin/ui';
import {LandingPageSchemas} from '@merlin/shared';
import type {LandingPageSettings, PuckData} from '@merlin/types';
import {useState} from 'react';
import {toast} from 'sonner';

import {DASHBOARD_URI} from '../../lib/constants';
import {network} from '../../lib/network';
import {planChatGptOpen} from '../../lib/puck/html/chatgpt';
import {buildHtmlDocument} from '../../lib/puck/html/document';
import type {HtmlImportResult} from '../../lib/puck/html/import/html-to-puck';

import {HtmlImportForm} from './HtmlImportForm';

export interface LandingPageHtmlSource {
  id: string;
  name: string;
  slug: string;
  kind: string;
  published: boolean;
  settings: LandingPageSettings;
  getData: () => PuckData;
}

interface LandingPageHtmlActionsProps {
  page: LandingPageHtmlSource;
  onReimported?: () => void;
}

function pageSettings(value: unknown): LandingPageSettings {
  if (!value || typeof value !== 'object') {
    return {};
  }
  return value as LandingPageSettings;
}

export function renderLandingHtml(page: LandingPageHtmlSource, includeTracking: boolean): string {
  return buildHtmlDocument({
    data: page.getData(),
    settings: pageSettings(page.settings),
    pageUrl: `${DASHBOARD_URI}/p/${page.slug}`,
    name: page.name,
    includeTracking,
  });
}

export function openLandingPageInChatGpt(html: string) {
  const plan = planChatGptOpen(html);
  if (plan.mode === 'clipboard') {
    void navigator.clipboard.writeText(plan.clipboardText);
    toast.success('HTML copiado. Cole no ChatGPT (Cmd+V).');
  }
  window.open(plan.url, '_blank', 'noopener,noreferrer');
}

export function downloadLandingHtml(slug: string, html: string) {
  const blob = new Blob([html], {type: 'text/html'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${slug}.html`;
  link.click();
  URL.revokeObjectURL(url);
}

export function LandingPageHtmlActions({page, onReimported}: LandingPageHtmlActionsProps) {
  const [includeTracking, setIncludeTracking] = useState(true);
  const [reimportOpen, setReimportOpen] = useState(false);
  const isHtml = page.kind === 'HTML';

  const html = () => renderLandingHtml(page, includeTracking);

  return (
    <>
      {isHtml ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              HTML
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="font-normal text-neutral-500 whitespace-normal">
              The page HTML will be sent to ChatGPT.
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={includeTracking}
              onCheckedChange={checked => setIncludeTracking(checked === true)}
            >
              Include tracking pixels
            </DropdownMenuCheckboxItem>
            <DropdownMenuItem
              onSelect={() => {
                openLandingPageInChatGpt(html());
              }}
            >
              Open in ChatGPT
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                downloadLandingHtml(page.slug, html());
              }}
            >
              Download .html
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setReimportOpen(true)}>Reimport HTML</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setReimportOpen(true)}>
          Reimport HTML
        </Button>
      )}
      <ReimportHtmlDialog page={page} open={reimportOpen} onOpenChange={setReimportOpen} onReimported={onReimported} />
    </>
  );
}

function ReimportHtmlDialog({
  page,
  open,
  onOpenChange,
  onReimported,
}: {
  page: LandingPageHtmlSource;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReimported?: () => void;
}) {
  const [result, setResult] = useState<HtmlImportResult | null>(null);
  const [updateSeo, setUpdateSeo] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const replace = async () => {
    if (!result) {
      return;
    }
    try {
      setSaving(true);
      const payload = LandingPageSchemas.replaceHtml.parse({
        data: result.data,
        ...(updateSeo ? {settings: result.settings} : {}),
      });
      await network.fetch<unknown, typeof LandingPageSchemas.replaceHtml>(
        'PUT',
        `/landing-pages/${page.id}/html`,
        payload,
      );
      toast.success('HTML imported');
      onOpenChange(false);
      setResult(null);
      setUpdateSeo(false);
      onReimported?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to import HTML');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={next => {
          onOpenChange(next);
          if (!next) {
            setResult(null);
            setUpdateSeo(false);
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Reimport HTML</DialogTitle>
          </DialogHeader>
          <HtmlImportForm onChange={setResult} />
          <div className="flex items-center gap-2">
            <Checkbox
              id={`update-seo-${page.id}`}
              checked={updateSeo}
              onCheckedChange={checked => setUpdateSeo(checked === true)}
            />
            <Label htmlFor={`update-seo-${page.id}`}>Fill empty SEO fields from this HTML</Label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button disabled={!result || saving} onClick={() => setConfirmOpen(true)}>
              Replace HTML
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={() => void replace()}
        title="Replace page HTML?"
        description={
          page.published
            ? 'This replaces the entire page content. Edits made in the visual editor since the last import will be lost. This page is published, so the change goes live immediately.'
            : 'This replaces the entire page content. Edits made in the visual editor since the last import will be lost.'
        }
        confirmText="Replace"
        variant="destructive"
      />
    </>
  );
}
