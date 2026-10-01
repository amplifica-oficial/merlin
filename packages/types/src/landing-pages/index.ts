/** Puck page data shape (compatible with @puckeditor/core Data) */
export interface PuckData {
  root: {props: Record<string, unknown>};
  content: Array<Record<string, unknown>>;
}

export interface LandingPageSettings {
  title?: string;
  description?: string;
  faviconUrl?: string;
  canonicalUrl?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImageUrl?: string;
  twitterCard?: 'summary' | 'summary_large_image';
  gtmId?: string;
  ga4Id?: string;
  fbPixelId?: string;
}

export interface PublicLandingPageConfig {
  publicId: string;
  slug: string;
  name: string;
  data: PuckData;
  settings: LandingPageSettings;
}

export const EMPTY_PUCK_DATA: PuckData = {
  root: {props: {}},
  content: [],
};

export interface LandingAiFieldCatalog {
  type: string;
  label?: string;
  hint?: string;
  options?: Array<{label: string; value?: unknown}>;
  allow?: string[];
  objectFields?: Record<string, LandingAiFieldCatalog>;
  arrayFields?: Record<string, LandingAiFieldCatalog>;
}

export interface LandingAiComponentCatalog {
  type: string;
  label: string;
  category?: string;
  description?: string;
  useWhen?: string;
  fields: Record<string, LandingAiFieldCatalog>;
  slots: string[];
  defaultProps?: Record<string, unknown>;
}

export interface LandingAiOutlineNode {
  id: string;
  type: string;
  props: Record<string, unknown>;
  slots?: Record<string, LandingAiOutlineNode[]>;
}

export interface LandingAiOutline {
  root: Record<string, unknown>;
  content: LandingAiOutlineNode[];
  truncated?: boolean;
  omittedBlocks?: number;
}

export interface LandingAiPickedElement {
  id: string;
  blockId: string | null;
  blockType: string | null;
  selector: string;
  tag: string;
  classes: string[];
  text: string;
  outerHtml: string;
  rect: {width: number; height: number};
  styles: Record<string, string>;
  propMatches: string[];
}

export interface LandingAiFormSummary {
  name: string;
  publicId: string;
  slug?: string;
  enabled?: boolean;
}

export interface LandingAiToolResult {
  ok: boolean;
  error?: string;
  outline?: LandingAiOutline;
  id?: string;
  props?: Record<string, unknown>;
  schema?: LandingAiComponentCatalog;
  changed?: {id: string; type: string};
  forms?: LandingAiFormSummary[];
  truncated?: boolean;
  omittedBlocks?: number;
}

export interface LandingAiConfigResponse {
  enabled: boolean;
}
