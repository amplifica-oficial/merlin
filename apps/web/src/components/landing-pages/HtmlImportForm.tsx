import {Input, Label, Textarea} from '@merlin/ui';
import {useState} from 'react';

import {HtmlImportError, htmlToPuckData, type HtmlImportResult} from '../../lib/puck/html/import/html-to-puck';

interface HtmlImportFormProps {
  onChange: (result: HtmlImportResult | null) => void;
}

export function HtmlImportForm({onChange}: HtmlImportFormProps) {
  const [html, setHtml] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<HtmlImportResult['report'] | null>(null);

  const convert = (nextHtml: string, nextBaseUrl: string) => {
    if (!nextHtml.trim()) {
      setError(null);
      setReport(null);
      onChange(null);
      return;
    }

    try {
      const result = htmlToPuckData(nextHtml, {baseUrl: nextBaseUrl.trim() || undefined});
      setError(null);
      setReport(result.report);
      onChange(result);
    } catch (caught) {
      const message = caught instanceof HtmlImportError ? caught.message : 'Could not read this HTML';
      setError(message);
      setReport(null);
      onChange(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="landing-html-source">HTML</Label>
        <Textarea
          id="landing-html-source"
          value={html}
          onChange={event => {
            const next = event.target.value;
            setHtml(next);
            convert(next, baseUrl);
          }}
          placeholder="Paste a full HTML document"
          className="min-h-40 font-mono text-xs"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="landing-html-file">Or upload a .html file</Label>
        <Input
          id="landing-html-file"
          type="file"
          accept=".html,text/html"
          onChange={event => {
            const file = event.target.files?.[0];
            if (!file) {
              return;
            }
            const reader = new FileReader();
            reader.onload = () => {
              const next = typeof reader.result === 'string' ? reader.result : '';
              setHtml(next);
              convert(next, baseUrl);
            };
            reader.readAsText(file);
          }}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="landing-html-base-url">Base URL for relative links (optional)</Label>
        <Input
          id="landing-html-base-url"
          value={baseUrl}
          onChange={event => {
            const next = event.target.value;
            setBaseUrl(next);
            convert(html, next);
          }}
          placeholder="https://example.com/landing/"
        />
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {report ? (
        <p className="text-sm text-neutral-600">
          {report.blocks} blocks, {report.rawFallbacks} raw sections, {report.scripts} scripts.
        </p>
      ) : null}
    </div>
  );
}
