/* eslint-disable lingui/no-unlocalized-strings -- the tvOS style's words go through tr() (./i18n), which this rule doesn't know */
import React from 'react';
import {
  defaultGenre,
  libraryTypes,
  needsGenre,
  useGenres,
  useItemPages,
  useViews,
} from '@/lib/jellyfin/queries';
import { useFeature } from '@/lib/jellyfin/server-info';
import { lastCatalog, rememberCatalog } from '../../lib/settings';
import type { BaseItemDto } from '@/lib/jellyfin/types';
// The app's own kinds, so a new one there shows here too.
import { KINDS, kindOf, type Kind } from '@/app/discover/page';
import { navigate, to } from '../../lib/paths';
import { PosterGrid } from './grid';
import { Failed, TopBar } from './parts';
import { catalogTag } from './home';
import { catalogGroup, catalogName, count, isServiceLibrary, tr } from './i18n';

// The app's own kinds, so a new one there shows here too.

type TabKind = Kind | 'Anime';

/** Movies, Shows, then Anime, then Collections: the app's kinds with an Anime tab among them. */
const TABS: { kind: TabKind; label: string }[] = [
  ...KINDS.filter((k) => k.kind !== 'BoxSet'),
  {
    kind: 'Anime',
    get label() {
      return tr('Anime');
    },
  },
  ...KINDS.filter((k) => k.kind === 'BoxSet'),
];

/** The tab a catalog belongs to: Anime when the server's name or id says so, else its own kind. */
function kindIn(view: BaseItemDto | undefined): TabKind | undefined {
  return view && catalogTag(view) === 'Anime' ? 'Anime' : kindOf(view);
}

/**
 * Discover, as the app's: Movies, Shows or Collections, the catalogs of that
 * kind, then a catalog's genres (or years, services…), all as glass tabs, and
 * its titles in a poster grid. "See all" on a home row opens it on that row's catalog.
 */
export function TvosCatalog({
  viewId,
  genre,
  kind,
}: {
  viewId: string;
  genre?: string;
  kind?: string;
}) {
  const views = useViews();
  const all = (views.data?.Items ?? []).filter((v) => !isServiceLibrary(v));
  const view = all.find((v) => v.Id === viewId);
  const current: TabKind =
    TABS.find((k) => k.kind === kind)?.kind ?? kindIn(view) ?? 'Movie';
  // As the app's: a catalog with no kind of its own holds any kind, so every tab offers it.
  const untyped = all.some((v) => !kindIn(v));
  const siblings = all.filter(
    (v) => kindIn(v) === current || !kindIn(v) || v.Id === viewId
  );
  // Two lists of a tab can share a name (Crunchyroll's films and shows): the kind is added to tell them apart.
  const shown = (v: BaseItemDto) => {
    const name = catalogName(v);
    const twins = siblings.filter(
      (s) => s.Id !== v.Id && catalogName(s) === name
    );
    if (!twins.length) return name;
    return `${name} – ${kindOf(v) === 'Movie' ? tr('Movies') : tr('Series')}`;
  };
  const offered = TABS.filter(
    (k) =>
      k.kind === current ||
      all.some((v) => kindIn(v) === k.kind) ||
      (untyped && k.kind !== 'BoxSet' && k.kind !== 'Anime')
  );
  const genres = useGenres(viewId);
  const required = useFeature('genreRequired') && needsGenre(view);
  const opening = defaultGenre(genres.data?.Items, required);
  const pickable = genres.data?.Items?.filter((g) => g.Name !== 'None') ?? [];
  // A catalog that needs a genre and lacks None has no All.
  const withAll = !required || opening?.Name === 'None';
  const chosen = genre
    ? genres.data?.Items?.find(
        (g) => g.Name?.toLowerCase() === genre.toLowerCase()
      )
    : opening;
  // As the app's Discover: everything, or only what hasn't been watched.
  const [unwatched, setUnwatched] = React.useState(false);
  const pages = useItemPages(viewId, {
    filter: unwatched ? 'unplayed' : undefined,
    types:
      view && kindIn(view) === current
        ? libraryTypes(view)
        : current === 'Anime'
          ? 'Series'
          : current,
    genreId: chosen?.Id,
    recursive: true,
    enabled: !!view && !genres.isLoading,
  });
  const items = pages.data?.pages.flatMap((p) => p.Items ?? []) ?? [];
  const total = pages.data?.pages[0]?.TotalRecordCount;
  React.useEffect(() => {
    if (view) rememberCatalog(viewId, current);
  }, [view, viewId, current]);
  // A genre carried from another catalog is dropped when this one lacks it.
  React.useEffect(() => {
    if (genre && genres.isSuccess && !chosen)
      navigate(to.discover(viewId, { kind }), { replace: true });
  }, [genre, genres.isSuccess, chosen, viewId, kind]);

  // Pushed, as the app's, so Back steps back through the genres tried.
  const pick = (name?: string) =>
    navigate(to.discover(viewId, { genre: name, kind }));
  // The genre travels by name, as its id belongs to the catalog it came from.
  const open = (id: string, next: TabKind) =>
    navigate(
      to.discover(id, {
        genre: genre ?? undefined,
        kind: kindIn(all.find((v) => v.Id === id)) === next ? undefined : next,
      }),
      { replace: true }
    );
  // As the app's switch: the same catalog in the other kind, else this one filtered, else the last of that kind.
  const switchKind = (next: TabKind) => {
    if (next === current) return;
    const twin = all.find(
      (v) =>
        !!view &&
        catalogGroup(v) === catalogGroup(view) &&
        kindIn(v) === next &&
        v.Id !== viewId
    );
    if (twin) return open(twin.Id!, next);
    if (view && !kindIn(view)) return open(viewId, next);
    const previous = lastCatalog(next);
    const target =
      all.find((v) => v.Id === previous && kindIn(v) === next) ??
      all.find((v) => kindIn(v) === next);
    if (target) open(target.Id!, next);
  };
  const tag = view && catalogTag(view);
  return (
    <div className="tv-page tv-list-page">
      <TopBar />
      <h1 className="tv-page-title">
        {view ? shown(view) : ''}
        {tag && (
          <span className="tv-tag" data-tag={tag.toLowerCase()}>
            {tr(tag)}
          </span>
        )}
        {total != null && !unwatched && (
          <span className="tv-count">
            {count(total, '{n} title', '{n} titles')}
          </span>
        )}
      </h1>
      {offered.length > 1 && (
        <div className="tv-tabs">
          {offered.map((k) => (
            <button
              key={k.kind}
              type="button"
              className="tv-tab"
              data-on={k.kind === current ? '' : undefined}
              onClick={() => switchKind(k.kind)}
            >
              {k.label}
            </button>
          ))}
          <span className="tv-tabs-gap" />
          {(
            [
              [false, tr('All')],
              [true, tr('Unwatched')],
            ] as const
          ).map(([value, label]) => (
            <button
              key={label}
              type="button"
              className="tv-tab"
              data-on={unwatched === value ? '' : undefined}
              onClick={() => setUnwatched(value)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {siblings.length > 1 && (
        <div className="tv-tabs tv-tabs-wrap">
          {siblings.map((v) => (
            <button
              key={v.Id}
              type="button"
              className="tv-tab"
              data-on={v.Id === viewId ? '' : undefined}
              onClick={() => v.Id !== viewId && open(v.Id!, current)}
            >
              {shown(v)}
            </button>
          ))}
        </div>
      )}
      {pickable.length > 0 && (
        <div className="tv-tabs">
          {withAll && (
            <button
              type="button"
              className="tv-tab"
              data-on={!genre || chosen?.Name === 'None' ? '' : undefined}
              onClick={() => pick()}
            >
              {tr('All')}
            </button>
          )}
          {pickable.map((g) => (
            <button
              key={g.Id}
              type="button"
              className="tv-tab"
              data-on={g.Id === chosen?.Id ? '' : undefined}
              onClick={() => pick(g.Name ?? undefined)}
            >
              {g.Name}
            </button>
          ))}
        </div>
      )}
      {(views.isError || pages.isError) && !items.length && (
        <Failed
          what={tr("This catalog didn't load")}
          retry={() => void (views.isError ? views.refetch() : pages.refetch())}
        />
      )}
      <PosterGrid
        items={items}
        loading={views.isLoading || pages.isLoading || pages.isFetchingNextPage}
        more={() =>
          pages.hasNextPage &&
          !pages.isFetchingNextPage &&
          void pages.fetchNextPage()
        }
      />
    </div>
  );
}
