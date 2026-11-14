import React from 'react';
import type { BaseItemDto } from '@/lib/jellyfin/types';
import type { TrailerSpot } from '@/lib/settings';
import { useLatest } from '@/hooks/use-latest';
import { TrailerPreview, useTrailersOn } from '@/features/trailers/preview';
import { Pinned } from './parts';

/** How long a title rests before its trailer starts, as in the app's hero. */
const REST_MS = 2500;

/** Marks the page while a trailer shows (trailer.css): the sea and the artwork fade away from it. */
function useShowingMark(shown: boolean) {
  React.useEffect(() => {
    if (!shown) return;
    const html = document.documentElement;
    html.setAttribute('data-trailer', '');
    // The apps' players draw beneath the page, which this keeps see-through on Android.
    const hole = !html.hasAttribute('data-video-hole');
    if (hole) html.setAttribute('data-video-hole', '');
    return () => {
      html.removeAttribute('data-trailer');
      if (hole) html.removeAttribute('data-video-hole');
    };
  }, [shown]);
}

const INPUT = ['keydown', 'pointerdown', 'wheel', 'touchstart'] as const;
const LISTEN = { capture: true, passive: true };

/**
 * The trailer of `item` over the whole window, beneath the page and in place of
 * its artwork, once the title has rested there (`untouched`: with no key
 * pressed meanwhile); null stops it. One that ended waits for another title.
 */
export function useTvosTrailer(
  item: BaseItemDto | null | undefined,
  spot: TrailerSpot,
  { restMs = REST_MS, untouched = false } = {}
) {
  const on = useTrailersOn(spot);
  const [playing, setPlaying] = React.useState<BaseItemDto | null>(null);
  const [ended, setEnded] = React.useState(false);
  const [shown, setShown] = React.useState(false);
  const [box, setBox] = React.useState<HTMLDivElement | null>(null);
  const [frame, setFrame] = React.useState<HTMLDivElement | null>(null);
  const id = item?.Id;
  const playingId = playing?.Id;
  const latest = useLatest(item);
  React.useEffect(() => {
    setPlaying(null);
    setEnded(false);
  }, [id, on]);
  React.useEffect(() => {
    if (!id || !on || ended || playingId === id) return;
    let timer: ReturnType<typeof setTimeout>;
    const wait = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setPlaying(latest.current ?? null), restMs);
    };
    wait();
    const inputs = untouched ? INPUT : [];
    for (const name of inputs) addEventListener(name, wait, LISTEN);
    return () => {
      clearTimeout(timer);
      for (const name of inputs) removeEventListener(name, wait, LISTEN);
    };
  }, [id, on, ended, playingId, restMs, untouched, latest]);
  React.useEffect(() => {
    if (!playing) setShown(false);
  }, [playing]);
  useShowingMark(shown);

  const preview = playing && (
    <Pinned under>
      <div ref={setFrame} aria-hidden className="tv-trailer">
        {/* Wider than the window, as the app's hero box: a trailer's bars and YouTube's own title and logo are cropped away. */}
        <div ref={setBox} data-ui="tv-trailer" />
      </div>
      {box && frame && (
        <TrailerPreview
          key={playing.Id}
          item={playing}
          spot={box}
          within={frame}
          onShown={setShown}
          onEnded={() => {
            setPlaying(null);
            setEnded(true);
          }}
        />
      )}
    </Pinned>
  );
  return { preview, shown };
}
