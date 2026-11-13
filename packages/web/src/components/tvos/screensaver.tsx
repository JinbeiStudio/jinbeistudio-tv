/* eslint-disable lingui/no-unlocalized-strings -- the tvOS style's words go through tr() (./i18n), which this rule doesn't know */
import React from 'react';
import { formatLocale } from '../../lib/i18n';
import { useSession } from '@/lib/jellyfin/session';
import { useLibraryHeads, useViews } from '@/lib/jellyfin/queries';
import { backdropUrl, logoUrl } from '@/lib/artwork/urls';
import type { BaseItemDto } from '@/lib/jellyfin/types';
import { setSaverOn } from './parts';

const IDLE_MS = 3 * 60_000;
const SLIDE_MS = 12_000;

/**
 * Apple TV's screensaver, with the catalogs' artwork: after a few idle minutes
 * (never while playing), a slow pan from one backdrop to the next, with its
 * logo and the time. Any key, click or move wakes it, and that press does
 * nothing else, so it never opens what was under the focus.
 */
export function Screensaver({ playing }: { playing: boolean }) {
  const [on, setOn] = React.useState(false);
  React.useEffect(() => {
    if (playing) return setOn(false);
    let timer = window.setTimeout(() => setOn(true), IDLE_MS);
    const wake = (e: Event) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setOn(true), IDLE_MS);
      setOn((was) => {
        if (was && e.type !== 'pointermove') {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
        return false;
      });
    };
    const events = ['keydown', 'pointerdown', 'pointermove', 'wheel'];
    events.forEach((name) => window.addEventListener(name, wake, true));
    return () => {
      window.clearTimeout(timer);
      events.forEach((name) => window.removeEventListener(name, wake, true));
    };
  }, [playing]);
  React.useEffect(() => setSaverOn(on), [on]);
  return on ? <Slides /> : null;
}

function Slides() {
  const { client } = useSession();
  const views = useViews();
  const heads = useLibraryHeads((views.data?.Items ?? []).slice(0, 4), 12);
  const items = React.useMemo(
    () =>
      heads
        .flatMap((h) => h.data?.Items ?? [])
        .filter((i: BaseItemDto) => i.BackdropImageTags?.length)
        .sort(() => Math.random() - 0.5),
    // Shuffled once per showing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [heads.map((h) => h.dataUpdatedAt).join()]
  );
  const [index, setIndex] = React.useState(0);
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const slide = window.setInterval(() => setIndex((i) => i + 1), SLIDE_MS);
    const clock = window.setInterval(() => setNow(new Date()), 20_000);
    return () => {
      window.clearInterval(slide);
      window.clearInterval(clock);
    };
  }, []);
  const item = items.length ? items[index % items.length] : undefined;
  const url = item && backdropUrl(client, item, { maxWidth: 1920 });
  const logo = item && logoUrl(client, item, { maxWidth: 700 });
  // Each slide comes in once decoded, fading over the last one, which stays under it until the next.
  const [slides, setSlides] = React.useState<{ url: string; logo?: string }[]>(
    []
  );
  React.useEffect(() => {
    if (!url) return;
    let live = true;
    const image = new Image();
    image.src = url;
    void image
      .decode()
      .catch(() => undefined)
      .then(() => {
        if (live)
          setSlides((s) => [...s.slice(-1), { url, logo: logo ?? undefined }]);
      });
    return () => {
      live = false;
    };
  }, [url, logo]);
  const current = slides[slides.length - 1];
  return (
    <div className="tv-saver" aria-hidden>
      {slides.map((slide) => (
        <img key={slide.url} className="tv-saver-art" src={slide.url} alt="" />
      ))}
      <div className="tv-saver-shade" />
      {current?.logo && (
        <img
          key={current.logo}
          className="tv-saver-logo"
          src={current.logo}
          alt=""
        />
      )}
      <div className="tv-saver-time">
        {now.toLocaleTimeString(formatLocale(), {
          hour: '2-digit',
          minute: '2-digit',
        })}
      </div>
    </div>
  );
}
