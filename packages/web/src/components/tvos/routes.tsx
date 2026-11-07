/* eslint-disable lingui/no-unlocalized-strings -- the tvOS style's words go through tr() (./i18n), which this rule doesn't know */
import React from 'react';
import { Outlet, useChildMatches } from '@tanstack/react-router';

// The tvOS style's own pages, loaded only when it is chosen.
const TvosItem = React.lazy(() =>
  import('./item').then((m) => ({ default: m.TvosItem }))
);
const TvosCalendar = React.lazy(() =>
  import('./calendar').then((m) => ({ default: m.TvosCalendar }))
);
const TvosHistory = React.lazy(() =>
  import('./history').then((m) => ({ default: m.TvosHistory }))
);
const TvosPerson = React.lazy(() =>
  import('./person').then((m) => ({ default: m.TvosPerson }))
);
const TvosCatalog = React.lazy(() =>
  import('./catalog').then((m) => ({ default: m.TvosCatalog }))
);
const TvosLibrary = React.lazy(() =>
  import('./library').then((m) => ({ default: m.TvosLibrary }))
);
const TvosLive = React.lazy(() =>
  import('./live').then((m) => ({ default: m.TvosLive }))
);
const TvosSearch = React.lazy(() =>
  import('./search').then((m) => ({ default: m.TvosSearch }))
);

interface Match {
  routeId: string;
  params: Record<string, string | undefined>;
  search: Record<string, string | undefined>;
}

/**
 * The page the address names, in the tvOS style where it has its own, else the
 * app's. Chosen here rather than in the app's router, so its updates merge cleanly.
 */
export function TvosOutlet() {
  const match = useChildMatches({
    select: (matches) => matches[0] as unknown as Match | undefined,
  });
  return (match && tvosPage(match)) ?? <Outlet />;
}

const PATHS = [
  '/history',
  '/favourites',
  '/calendar',
  '/live',
  '/search',
  '/discover/$viewId',
  '/item/$itemId',
  '/person/$personId',
] as const;

/** The routes' search params arrive already parsed by the app's router. */
function tvosPage({ routeId, params, search }: Match): React.ReactNode {
  // Matched by its path's end, whatever the app names the layout route above it.
  const path = PATHS.find((p) => routeId.endsWith(p));
  switch (path) {
    case '/history':
      return <TvosHistory />;
    case '/favourites':
      return <TvosLibrary kind={search.kind} />;
    case '/calendar':
      return <TvosCalendar month={search.month} />;
    case '/live':
      return <TvosLive group={search.group} view={search.view} />;
    case '/search':
      return <TvosSearch initialTerm={search.q ?? ''} />;
    case '/discover/$viewId':
      return (
        <TvosCatalog
          key={params.viewId}
          viewId={params.viewId!}
          genre={search.genre}
          kind={search.kind}
        />
      );
    case '/item/$itemId':
      return (
        <TvosItem
          key={params.itemId}
          itemId={params.itemId!}
          seasonId={search.season}
          episodeId={search.episode}
          pickId={search.pick}
          playlistId={search.playlist}
        />
      );
    case '/person/$personId':
      return <TvosPerson key={params.personId} personId={params.personId!} />;
    default:
      return null;
  }
}
