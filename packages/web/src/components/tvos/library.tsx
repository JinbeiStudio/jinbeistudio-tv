/* eslint-disable lingui/no-unlocalized-strings -- the tvOS style's words go through tr() (./i18n), which this rule doesn't know */
import React from 'react';
import { BiDownload, BiListUl } from 'react-icons/bi';
import { useItemPages } from '@/lib/jellyfin/queries';
import { downloadsHost } from '../../lib/downloads';
import { navigate, to } from '../../lib/paths';
import { openPlaylists } from '@/features/playlists/playlists';
import { PosterGrid } from './grid';
import { Failed, TopBar } from './parts';
import { tr } from './i18n';

const KINDS = [
  { label: 'All', value: 'Movie,Series' },
  { label: 'Movies', value: 'Movie' },
  { label: 'Shows', value: 'Series' },
];

/**
 * The Library, behind the top bar's button: favourites as a poster grid, with
 * the app's own Playlists and Downloads a press away, where they are offered.
 */
export function TvosLibrary({ kind }: { kind?: string }) {
  const types = KINDS.find((k) => k.value === kind)?.value ?? KINDS[0]!.value;
  const pages = useItemPages('', {
    filter: 'favorite',
    types,
    recursive: true,
  });
  const items = pages.data?.pages.flatMap((p) => p.Items ?? []) ?? [];
  const downloads = !!downloadsHost();
  return (
    <div className="tv-page tv-list-page">
      <TopBar />
      <h1 className="tv-page-title">{tr('Library')}</h1>
      <div className="tv-tabs">
        {KINDS.map((k) => (
          <button
            key={k.label}
            type="button"
            className="tv-tab"
            data-on={k.value === types ? '' : undefined}
            onClick={() =>
              navigate(
                to.favourites(
                  k.value === KINDS[0]!.value ? undefined : k.value
                ),
                { replace: true }
              )
            }
          >
            {tr(k.label)}
          </button>
        ))}
        <button
          type="button"
          className="tv-tab tv-tab-action"
          onClick={() => openPlaylists()}
        >
          <BiListUl /> {tr('Playlists')}
        </button>
        {downloads && (
          <button
            type="button"
            className="tv-tab tv-tab-action"
            onClick={() => navigate(to.downloads)}
          >
            <BiDownload /> {tr('Downloads')}
          </button>
        )}
      </div>
      {pages.isError && !items.length ? (
        <Failed
          what={tr("Your favourites didn't load")}
          retry={() => void pages.refetch()}
        />
      ) : !pages.isLoading && !items.length ? (
        <div className="tv-note tv-gutter">
          {tr(
            'Nothing in your favourites yet: add a title with ♡ on its page.'
          )}
        </div>
      ) : (
        <PosterGrid
          items={items}
          loading={pages.isLoading || pages.isFetchingNextPage}
          more={() =>
            pages.hasNextPage &&
            !pages.isFetchingNextPage &&
            void pages.fetchNextPage()
          }
        />
      )}
    </div>
  );
}
