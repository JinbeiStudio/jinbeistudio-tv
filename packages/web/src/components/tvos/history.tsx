/* eslint-disable lingui/no-unlocalized-strings -- the tvOS style's words go through tr() (./i18n), which this rule doesn't know */
import React from 'react';
import { BiHeart, BiMoviePlay, BiTimeFive, BiTv } from 'react-icons/bi';
import { useInView } from '../../lib/use-in-view';
import { useSession } from '../../lib/session';
import { useFeature } from '../../lib/server-info';
import { toast } from 'sonner';
import { ContextMenuItem } from '@aiostreams/ui/context-menu';
import {
  useActivity,
  useClearHistory,
  useHistory,
  useOwnHistory,
  useOwnSessions,
  useOwnTotals,
  useSetPlayed,
} from '../../lib/queries';
import { clock, itemTitle, ticksToMs } from '../../lib/format';
import { openRemote } from '../remote-sheet';
import { ExportButton, ResetButton } from '../../pages/history';
import { itemPath, navigate } from '../../lib/paths';
import type { HistoryEntry, SessionInfoDto } from '../../lib/types';
import { Failed, Scroller, Spinner, TopBar, WideCard } from './parts';
import { count, tr } from './i18n';

const at = (e: HistoryEntry) => e.lastPlayedAt ?? (e.sortAt || null);

function dayName(date: Date | null): string {
  if (!date) return tr('Earlier');
  const days = Math.round(
    (new Date(new Date().toDateString()).getTime() -
      new Date(date.toDateString()).getTime()) /
      86_400_000
  );
  if (days === 0) return tr('Today');
  if (days === 1) return tr('Yesterday');
  return date.toLocaleDateString([], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/**
 * What was watched, newest first, a row per day; the same history as the
 * app's Activity page, for the signed-in user.
 */
export function TvosHistory() {
  const { user } = useSession();
  const full = useFeature('history');
  const activity = useActivity(full);
  const profiles = (activity.data?.users ?? []).filter((u) => u.counts);
  // Starts on the signed-in profile each time, by choice (the app's page starts on everyone); null is everyone.
  const [shown, setShown] = React.useState<string | null>(user.Id ?? null);
  const fullHistory = useHistory(shown, false, full);
  const own = useOwnTotals(!full);
  // The same totals as the app's Activity page: for the chosen profile, or everyone's added up.
  const counts = full
    ? (shown ? profiles.filter((p) => p.user.Id === shown) : profiles).reduce(
        (sum, p) => ({
          movies: sum.movies + (p.counts?.movies ?? 0),
          episodes: sum.episodes + (p.counts?.episodes ?? 0),
          inProgress: sum.inProgress + (p.counts?.inProgress ?? 0),
          favorites: sum.favorites + (p.counts?.favorites ?? 0),
        }),
        { movies: 0, episodes: 0, inProgress: 0, favorites: 0 }
      )
    : {
        movies: own.movies ?? 0,
        episodes: own.episodes ?? 0,
        inProgress: own.inProgress ?? 0,
        favorites: own.favorites ?? 0,
      };
  const stats = [
    counts.movies && {
      icon: BiMoviePlay,
      text: count(counts.movies, '{n} movie', '{n} movies'),
    },
    counts.episodes && {
      icon: BiTv,
      text: count(counts.episodes, '{n} episode', '{n} episodes'),
    },
    counts.inProgress && {
      icon: BiTimeFive,
      text: tr('{n} in progress', { n: counts.inProgress }),
    },
    counts.favorites && {
      icon: BiHeart,
      text: count(counts.favorites, '{n} favourite', '{n} favourites'),
    },
  ].filter((s) => !!s);
  const ownHistory = useOwnHistory(!full);
  const history = full ? fullHistory : ownHistory;
  const ownSessions = useOwnSessions(!full);
  // Now playing follows the chosen profile; everyone shows all of them.
  const sameUser = (a?: string | null, b?: string | null) =>
    !!a &&
    !!b &&
    a.replace(/-/g, '').toLowerCase() === b.replace(/-/g, '').toLowerCase();
  const sessions = (
    (full ? activity.data?.sessions : ownSessions.data) ?? []
  ).filter((s) => !shown || !s.UserId || sameUser(s.UserId, shown));
  const owner = profiles.find((p) => p.user.Id === shown);
  const days = React.useMemo(() => {
    const list: { key: string; date: Date | null; entries: HistoryEntry[] }[] =
      [];
    for (const entry of history.data?.pages.flatMap((p) => p.items) ?? []) {
      const when = at(entry);
      const date = when ? new Date(when) : null;
      const key = date?.toDateString() ?? 'undated';
      let day = list.find((d) => d.key === key);
      if (!day) list.push((day = { key, date, entries: [] }));
      if (!day.entries.some((e) => e.itemKey === entry.itemKey))
        day.entries.push(entry);
    }
    // As the app's: plays with no date come last.
    return [...list.filter((d) => d.date), ...list.filter((d) => !d.date)];
  }, [history.data]);
  // A server that ignores the played filter answers with its catalogs instead, as the app's page notes.
  const unlisted =
    !full && !!history.data?.pages.some((p) => p.items.some((e) => !e.played));

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = history;
  // More days load as focus nears the end of the page.
  const endRef = useInView<HTMLDivElement>(
    () => {
      if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
    },
    '600px',
    [hasNextPage, isFetchingNextPage]
  );

  return (
    <div className="tv-page tv-list-page">
      <TopBar />
      <h1 className="tv-page-title">
        {tr('History')}
        {/* As the app's Activity page: export everything, reset the chosen profile. */}
        {full && (
          <span className="tv-title-actions tv-app-action">
            <ExportButton />
            {owner && <ResetButton owner={owner} />}
          </span>
        )}
      </h1>
      {stats.length > 0 && (
        <div className="tv-stats">
          {stats.map((s) => (
            <span key={s.text} className="tv-tag">
              <s.icon />
              {s.text}
            </span>
          ))}
        </div>
      )}
      {full && profiles.length > 1 && (
        <div className="tv-tabs">
          {[
            { id: null, name: tr('Everyone') },
            ...profiles.map((p) => ({
              id: p.user.Id ?? null,
              name: p.user.Name ?? '',
            })),
          ].map((p) => (
            <button
              key={p.id ?? 'everyone'}
              type="button"
              className="tv-tab"
              data-on={p.id === shown ? '' : undefined}
              onClick={() => setShown(p.id)}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
      <NowPlaying sessions={sessions} />
      {!unlisted &&
        days.map((day) => (
          <section key={day.key} className="tv-row">
            <h2>{dayName(day.date)}</h2>
            <Scroller>
              {day.entries.map((entry) => (
                <WideCard
                  key={entry.itemKey}
                  item={entry.item}
                  menu={<EntryItems entry={entry} />}
                  onClick={() => navigate(itemPath(entry.item))}
                />
              ))}
            </Scroller>
          </section>
        ))}
      {history.isLoading && (
        <div className="tv-loading">
          <Spinner />
        </div>
      )}
      {history.isError && !days.length && (
        <Failed
          what={tr("Your history didn't load")}
          retry={() => void history.refetch()}
        />
      )}
      {unlisted && (
        <div className="tv-note tv-gutter">
          {tr("This server can't list what you've watched.")}
        </div>
      )}
      {!history.isLoading && !history.isError && !unlisted && !days.length && (
        <div className="tv-note tv-gutter">{tr('Nothing watched yet')}</div>
      )}
      <div ref={endRef} style={{ height: 1 }} />
    </div>
  );
}

/** What's playing now on the server's devices, as the app's Activity page shows first. */
function NowPlaying({ sessions }: { sessions: SessionInfoDto[] }) {
  const playing = sessions.filter((s) => s.NowPlayingItem);
  if (!playing.length) return null;
  return (
    <section className="tv-row">
      <h2>{tr('Now playing')}</h2>
      <Scroller shape="wide">
        {playing.map((s) => {
          const item = s.NowPlayingItem!;
          const position = ticksToMs(s.PlayState?.PositionTicks);
          const runtime = ticksToMs(item.RunTimeTicks);
          return (
            <WideCard
              key={s.Id}
              item={item}
              subtitle={[
                s.UserName,
                s.DeviceName || s.Client,
                s.PlayState?.IsPaused
                  ? tr('Paused')
                  : runtime
                    ? `${clock(position)} / ${clock(runtime)}`
                    : clock(position),
              ]
                .filter(Boolean)
                .join(' · ')}
              // A device that takes remote control opens its remote, as in the app.
              onClick={() =>
                s.SupportsRemoteControl
                  ? openRemote({ device: s.Id! })
                  : navigate(itemPath(item))
              }
            />
          );
        })}
      </Scroller>
    </section>
  );
}

/** A history entry's own menu, as the app's: open it, mark it unwatched, take it out of the history. */
function EntryItems({ entry }: { entry: HistoryEntry }) {
  const setPlayed = useSetPlayed();
  const clear = useClearHistory();
  const full = useFeature('history');
  return (
    <>
      <ContextMenuItem onClick={() => navigate(itemPath(entry.item))}>
        {tr('Open')} {itemTitle(entry.item)}
      </ContextMenuItem>
      {entry.played && (
        <ContextMenuItem
          onClick={() =>
            setPlayed.mutate(
              { itemId: entry.item.Id!, played: false, userId: entry.userId },
              { onSuccess: () => toast.success(tr('Marked unwatched')) }
            )
          }
        >
          {tr('Mark unwatched')}
        </ContextMenuItem>
      )}
      {full && (
        <ContextMenuItem
          className="text-red-300"
          onClick={() =>
            clear.mutate(
              { userId: entry.userId, itemKeys: [entry.itemKey] },
              { onSuccess: () => toast.success(tr('Removed from history')) }
            )
          }
        >
          {tr('Remove from history')}
        </ContextMenuItem>
      )}
    </>
  );
}
