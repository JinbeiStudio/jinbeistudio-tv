import './styles.css';
import './components/tvos/tvos.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';

import React from 'react';
import ReactDOM from 'react-dom/client';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import JellyfinWebApp from './app';
import { clearCategory, persister } from './lib/cache';
import { followReachable } from './lib/connection';
import { onLanguageSwitch, startI18n } from './lib/i18n';
import { markTvosStyle } from './lib/tvos-style';
import { setupTv } from './lib/tv';

onlineManager.setEventListener(followReachable);
setupTv();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // A TV coming back would refetch every list at once and freeze for seconds; lists refresh as they are opened.
      refetchOnWindowFocus: false,
      retry: false,
      persister,
      // Runs even while the server is out of reach, so saved copies still load.
      networkMode: 'offlineFirst',
    },
  },
});

// Titles and lists are the server's, written in the language it was asked for.
onLanguageSwitch(async () => {
  await Promise.all(
    (['home', 'titles', 'history', 'search'] as const).map(clearCategory)
  );
  await queryClient.resetQueries();
});

const container = document.getElementById('root')!;
// React listens at its root and at the body, where portals go, for every event
// it knows, so the browser would build and send one as each CSS transition and
// animation starts, which nothing uses. Their ends are used.
const UNUSED = /^(transition(run|start|cancel)|animation(start|iteration))$/;
for (const el of [container, document.body]) {
  const listen = el.addEventListener;
  el.addEventListener = function (
    this: HTMLElement,
    ...args: Parameters<HTMLElement['addEventListener']>
  ) {
    if (!UNUSED.test(args[0])) listen.apply(this, args);
  };
}

// Before anything draws, so the first screen already has the chosen look.
markTvosStyle();

// The page waits for its language, so it never shows English first.
void startI18n().then(() =>
  ReactDOM.createRoot(container).render(
    <React.StrictMode>
      <I18nProvider i18n={i18n}>
        <QueryClientProvider client={queryClient}>
          <JellyfinWebApp />
        </QueryClientProvider>
      </I18nProvider>
    </React.StrictMode>
  )
);
