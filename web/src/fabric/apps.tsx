import { StrictMode, type ReactNode } from 'react';
import { App as ExplorerApp } from '../explorer/App';
import explorerCss from '../explorer/explorer.css?inline';
import pageCss from '../kit/page.css?inline';
import resetCss from '../kit/reset.css?inline';
import type { AppId } from '../kit/route';
import tokensCss from '../kit/tokens.css?inline';
import ch1Css from '../platform/ch1/ch1.css?inline';
import { PlatformPage } from '../platform/Page';
import platformCss from '../platform/platform.css?inline';
import { App as RetrievalApp } from '../retrieval/App';
import retrievalCss from '../retrieval/retrieval.css?inline';
import { App as StudioApp } from '../studio/App';
import studioCss from '../studio/studio.css?inline';

/** One of the page's four apps, with the stylesheet that's in the page only while it shows. */
export type AppDef = {
  id: AppId; label: string;
  /** Where the app starts, and the colour of its tab. */
  start: string; color: string;
  /** Whether its content runs wider than the others. */
  wide?: boolean;
  css: string; el: ReactNode;
};

const kit = [tokensCss, resetCss, pageCss];

export const APPS: AppDef[] = [
  { id: '', label: 'Overview', start: '#map', color: 'var(--ink)', css: [platformCss, ch1Css].join('\n'), el: <PlatformPage /> },
  { id: 'retrieval', label: 'Retrieval', start: '#retrieval', color: 'var(--query)', css: [...kit, retrievalCss].join('\n'), el: <StrictMode><RetrievalApp /></StrictMode> },
  { id: 'explorer', label: 'Explorer', start: '#explorer', color: 'var(--onto)', wide: true, css: [...kit, explorerCss].join('\n'), el: <StrictMode><ExplorerApp /></StrictMode> },
  { id: 'studio', label: 'Studio', start: '#studio', color: 'var(--query)', wide: true, css: [...kit, explorerCss, studioCss].join('\n'), el: <StrictMode><StudioApp /></StrictMode> },
];
