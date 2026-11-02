/* eslint-disable lingui/no-unlocalized-strings -- the tvOS style's words go through tr() (./i18n), which this rule doesn't know */
import React from 'react';
import { useInView, watch } from '../../lib/use-in-view';
import type { BaseItemDto } from '../../lib/types';
import { PosterCard, Spinner } from './parts';

/** Posters in a grid, loading more as the end comes into view. */
export function PosterGrid({
  items,
  more,
  loading,
}: {
  items: BaseItemDto[];
  more?: () => void;
  loading?: boolean;
}) {
  // The app's watcher, which on TVs measures by hand rather than slow every animation with an observer.
  const end = useInView<HTMLDivElement>(() => more?.(), '600px', [
    items.length,
  ]);
  // As the app's grids: posters well out of sight are marked, so arrow moves needn't measure them all.
  const grid = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const cards = grid.current?.children;
    if (!cards) return;
    const stops = [...cards].map((card) =>
      watch(card, null, '50% 0px', (entry) =>
        card.toggleAttribute('data-nav-out', !entry.isIntersecting)
      )
    );
    return () => stops.forEach((stop) => stop());
  }, [items.length]);
  return (
    <>
      <div
        ref={grid}
        className="tv-grid tv-gutter-grid"
        data-nav-group
        data-nav-wrap
      >
        {items.map((item) => (
          <PosterCard key={item.Id} item={item} />
        ))}
      </div>
      {loading && (
        // Alone in the middle until the first posters come; under them while more load.
        <div className={items.length ? 'tv-gutter tv-more' : 'tv-loading'}>
          <Spinner />
        </div>
      )}
      <div ref={end} style={{ height: 1 }} />
    </>
  );
}
