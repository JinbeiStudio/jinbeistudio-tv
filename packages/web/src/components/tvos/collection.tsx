import React from 'react';
import { useItemPages } from '@/lib/jellyfin/queries';
import { backgroundVideoOf } from '@/lib/artwork/urls';
import { libraryLabel } from '@/lib/format';
import { KINDS } from '@/components/media/kind-tabs';
import { useTrailersOn } from '@/features/trailers/preview';
import type {
  BaseItemDto,
  CollectionExtension,
  CollectionPart,
} from '@/lib/jellyfin/types';
import { Pinned, PosterCard, Row } from './parts';
import { tr } from './i18n';

const kindOf = (part: CollectionPart) =>
  libraryLabel({ CollectionType: part.collectionType }) || undefined;

/** One row of a collection's members (or one of its parts), loaded whole, as the app's grid pages through it. */
function Members({
  parentId,
  types = 'Movie,Series',
  genre,
  title,
  tag,
}: {
  parentId: string;
  types?: string;
  genre?: string;
  title: string;
  tag?: string;
}) {
  const pages = useItemPages(parentId, { types, genre });
  const items = pages.data?.pages.flatMap((p) => p.Items ?? []) ?? [];
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = pages;
  React.useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  if (!items.length) return null;
  return (
    <Row title={title} tag={tag}>
      {items.map((m) => (
        <PosterCard key={m.Id} item={m} />
      ))}
    </Row>
  );
}

/**
 * A collection's members as the server lays them out: one row, a row per source
 * (`layout: rows`), or the sources as tabs over one row, as a show's seasons.
 */
export function CollectionMembers({ item }: { item: BaseItemDto }) {
  const extension = (item as { aiostreams?: CollectionExtension }).aiostreams;
  const parts = extension?.sources ?? [];
  const all = extension?.showAll !== false;
  const [picked, setPicked] = React.useState<string>();
  // Passing over tabs doesn't load each source, only the one the focus rests on.
  const resting = React.useRef(0);
  React.useEffect(() => () => window.clearTimeout(resting.current), []);
  if (parts.length < 2)
    return <Members parentId={item.Id!} title={tr('In this collection')} />;
  if (extension?.layout === 'rows')
    return (
      <>
        {parts.map((part) => (
          <Members
            key={part.id}
            parentId={part.id}
            genre={part.genre}
            title={part.name}
            tag={kindOf(part)}
          />
        ))}
      </>
    );
  const tabs = [
    ...(all ? [{ id: '', name: KINDS[0].label }] : []),
    ...parts.map((p) => ({ id: p.id, name: p.name })),
  ];
  const shown = tabs.find((t) => t.id === picked)?.id ?? tabs[0].id;
  const part = parts.find((p) => p.id === shown);
  const pickSoon = (id: string) => {
    window.clearTimeout(resting.current);
    resting.current = window.setTimeout(() => setPicked(id), 350);
  };
  return (
    <>
      <div className="tv-tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className="tv-tab"
            data-on={t.id === shown ? '' : undefined}
            onFocus={() => pickSoon(t.id)}
            onClick={() => setPicked(t.id)}
          >
            {t.name}
          </button>
        ))}
      </div>
      {part ? (
        <Members
          key={part.id}
          parentId={part.id}
          genre={part.genre}
          title={part.name}
          tag={kindOf(part)}
        />
      ) : (
        <Members parentId={item.Id!} title={tr('In this collection')} />
      )}
    </>
  );
}

/**
 * A collection's own background video, muted and looping in place of its
 * artwork while the page sits at its top, where trailers may start by themselves.
 */
export function CollectionVideo({
  item,
  shown,
}: {
  item: BaseItemDto | undefined;
  shown: boolean;
}) {
  const on = useTrailersOn('item');
  const url = item?.Type === 'BoxSet' ? backgroundVideoOf(item) : undefined;
  const [playing, setPlaying] = React.useState<string>();
  const [failed, setFailed] = React.useState<string>();
  const usable = url && url !== failed && on ? url : undefined;
  const visible = shown && !!usable && playing === usable;
  // As a trailer (trailer.css): the sea and the artwork give way, the glass goes flat on TVs.
  React.useEffect(() => {
    if (!visible) return;
    const html = document.documentElement;
    html.setAttribute('data-trailer', '');
    return () => html.removeAttribute('data-trailer');
  }, [visible]);
  if (!usable) return null;
  return (
    <Pinned under>
      <video
        key={usable}
        className="tv-collection-video"
        data-on={visible ? '' : undefined}
        src={usable}
        autoPlay
        muted
        loop
        playsInline
        aria-hidden
        onPlaying={() => setPlaying(usable)}
        onError={() => setFailed(usable)}
      />
    </Pinned>
  );
}
