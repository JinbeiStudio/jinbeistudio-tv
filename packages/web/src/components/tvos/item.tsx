/* eslint-disable lingui/no-unlocalized-strings -- the tvOS style's words go through tr() (./i18n), which this rule doesn't know */
import React from 'react';
import {
  BiCast,
  BiCheck,
  BiGroup,
  BiHeart,
  BiListPlus,
  BiListUl,
  BiPlay,
  BiRevision,
  BiShuffle,
  BiSolidHeart,
  BiX,
} from 'react-icons/bi';
import {
  openingSeason,
  useEpisodes,
  useItem,
  useNextUpFor,
  useItemPages,
  useSeasons,
  useSetFavorite,
  useRemoteDevices,
  useSetDropped,
  useSetPlayed,
  useShowAhead,
  useSimilar,
} from '../../lib/queries';
import { TrailerButton } from '../trailers';
import { RatingButton } from '../rating';
import { DownloadButton, ShowDownloadMenu } from '../download-button';
import { ExternalLinks } from '../external-links';
import { openRandom } from '../random-pick';
import { openPartySheet } from '../party/party-sheet';
import { openRemote } from '../remote-sheet';
import { openAddToPlaylist } from '../playlists';
import { playable } from '../../lib/playlists';
import { useParty } from '../../lib/party/party';
import { useFeature } from '../../lib/server-info';
import { fullTitle } from '../../lib/format';
import { useSession } from '../../lib/session';
import { landscapeUrls } from '../../lib/images';
import { Artwork } from '../cards';
import { useExternalReturn } from '../../lib/playback/external-return';
import {
  duration,
  episodeMarks,
  markLabel,
  progressOf,
  ticksToMs,
  unavailableKind,
  unavailableLabel,
  untilLabel,
} from '../../lib/format';
import { itemPath, navigate, to } from '../../lib/paths';
import { formatLocale } from '../../lib/i18n';
import { airsLine, linksFor } from '../../pages/item';
import type { BaseItemDto } from '../../lib/types';
import {
  PickOnArrival,
  usePreloadVersions,
  useVersionPicker,
} from '../version-picker';
import { ItemMenu } from '../item-menu';
import { upToIndex } from '../episodes';
import {
  Backdrop,
  Logo,
  Meta,
  PersonCard,
  PosterCard,
  Row,
  Spinner,
  useFocusInside,
  useScrolledDown,
  Failed,
  Later,
  ArtTile,
  Pinned,
  Scroller,
} from './parts';
import { tr } from './i18n';

/**
 * A title's page as the Apple TV app lays it out: the artwork full screen with
 * its logo and Play, then seasons and episodes, cast, and related titles.
 * Play and Versions are the app's own, through its version picker.
 */
export function TvosItem({
  itemId,
  seasonId,
  episodeId,
  pickId,
  playlistId,
}: {
  itemId: string;
  seasonId?: string;
  episodeId?: string;
  pickId?: string;
  playlistId?: string;
}) {
  const itemQuery = useItem(itemId, { page: true });
  const item = itemQuery.data;
  // As Apple TV: a spinner until the details and the artwork are both in, then the page shows whole.
  const [artReady, setArtReady] = React.useState(false);
  const onArtReady = React.useCallback(() => setArtReady(true), []);
  const [late, setLate] = React.useState(false);
  React.useEffect(() => {
    const timer = window.setTimeout(() => setLate(true), 2500);
    return () => window.clearTimeout(timer);
  }, []);
  const ready = late || (!!item && !itemQuery.isPlaceholderData && artReady);
  const series = item?.Type === 'Series';
  // As the app's page: a show's next episode, seasons and episodes asked at once, not one after another.
  useShowAhead(itemId, series, seasonId);
  // As the app's page: what an external player reports back is saved on return.
  useExternalReturn();
  const seasons = useSeasons(itemId, series).data?.Items ?? [];
  const next = useNextUpFor(itemId, series).data?.Items?.[0];
  const [picked, setPicked] = React.useState(seasonId);
  // Passing over tabs doesn't load each season, only the one the focus rests on.
  const resting = React.useRef(0);
  // As the app's: the season goes in the address, so coming back from the player finds it.
  const choose = (id: string | undefined) => {
    setPicked(id);
    if (id)
      navigate(`${to.item(itemId)}?season=${id}`, {
        replace: true,
        keepScroll: true,
      });
  };
  const pickSoon = (id: string | undefined) => {
    window.clearTimeout(resting.current);
    resting.current = window.setTimeout(() => choose(id), 350);
  };
  React.useEffect(() => () => window.clearTimeout(resting.current), []);
  const season = picked ?? next?.SeasonId ?? openingSeason(seasons)?.Id;
  const episodes =
    useEpisodes(itemId, series ? season : undefined).data?.Items ?? [];
  const picker = useVersionPicker();
  const lowerRef = React.useRef<HTMLDivElement>(null);
  const setPlayed = useSetPlayed();
  const setFavorite = useSetFavorite();
  const boxset = item?.Type === 'BoxSet';
  const members = useItemPages(itemId, {
    types: 'Movie,Series',
    enabled: boxset,
  });
  const memberItems = members.data?.pages.flatMap((p) => p.Items ?? []) ?? [];
  // A collection is shown whole, its later pages following the first.
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = members;
  React.useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  const setDropped = useSetDropped();
  const canDrop = useFeature('dropped');
  const inParty = !!useParty();
  const devices = useRemoteDevices();
  const dropped = item?.UserData?.Likes === false;
  const played = !!item?.UserData?.Played;
  const favourite = !!item?.UserData?.IsFavorite;

  const target: BaseItemDto | undefined = series
    ? (episodes.find((e) => e.Id === episodeId) ?? next ?? episodes[0])
    : item;
  // Upstream's "Find versions when a title opens", for what Play would start.
  usePreloadVersions(
    target?.Type === 'Movie' || target?.Type === 'Episode' ? target : undefined
  );
  const resumeMs = ticksToMs(target?.UserData?.PlaybackPositionTicks);
  const code =
    target?.Type === 'Episode' &&
    target.ParentIndexNumber != null &&
    target.IndexNumber != null
      ? ` S${target.ParentIndexNumber}, E${target.IndexNumber}`
      : '';
  const playLabel = `${tr(resumeMs > 0 ? 'Resume' : 'Play')}${code}`;

  // The row opens on the episode one is up to, as the app's list does, without taking the focus.
  const episodesRef = React.useRef<HTMLDivElement>(null);
  const episodeCards = React.useRef<HTMLDivElement>(null);
  const openingEpisode = episodeId
    ? episodes.findIndex((e) => e.Id === episodeId)
    : upToIndex(episodes);
  React.useEffect(() => {
    const row = episodesRef.current;
    const card = episodeCards.current?.children[openingEpisode];
    if (row && card)
      row.scrollLeft = Math.max(
        0,
        row.scrollLeft +
          card.getBoundingClientRect().left -
          row.getBoundingClientRect().left -
          row.clientWidth * 0.06
      );
  }, [openingEpisode, episodes]);

  // The Play button starts focused, as on tvOS.
  const playRef = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (ready) playRef.current?.focus({ preventScroll: true });
  }, [ready]);

  if (itemQuery.isError && !item)
    return (
      <div className="tv-page">
        <Failed
          what={tr("This title didn't load")}
          retry={() => void itemQuery.refetch()}
        />
      </div>
    );
  return (
    <div className="tv-page" data-loading={ready ? undefined : ''}>
      {pickId && <PickOnArrival itemId={pickId} playlist={playlistId} />}
      <ItemBackdrop
        item={item}
        lowerRef={lowerRef}
        waiting={!ready}
        onReady={onArtReady}
      />
      {!ready && (
        <Pinned>
          <Spinner className="tv-page-spinner" />
        </Pinned>
      )}
      <div className="tv-content">
        <div className="tv-hero">
          {item && (
            <>
              <Logo item={item} />
              {item.Taglines?.[0] && (
                <div className="tv-tagline">{item.Taglines[0]}</div>
              )}
              <Meta item={item} />
              {item.Overview && (
                <div className="tv-overview">{item.Overview}</div>
              )}
              <div className="tv-buttons">
                {!boxset && (
                  <>
                    <button
                      ref={playRef}
                      type="button"
                      className="tv-glass tv-button"
                      disabled={!target}
                      onClick={() =>
                        target &&
                        picker.play(target, {
                          startMs: resumeMs,
                          playlist: playlistId,
                        })
                      }
                    >
                      <BiPlay />
                      {playLabel}
                    </button>
                    <button
                      type="button"
                      className="tv-glass tv-button"
                      disabled={!target}
                      onClick={() =>
                        target && picker.open(target, { startMs: resumeMs })
                      }
                    >
                      <BiListUl />
                      {tr('Versions')}
                    </button>
                    {!!resumeMs && target && (
                      <RoundAction
                        label="Play from the start"
                        onClick={() =>
                          picker.play(target, {
                            startMs: 0,
                            playlist: playlistId,
                          })
                        }
                      >
                        <BiRevision />
                      </RoundAction>
                    )}
                  </>
                )}
                <span className="tv-app-action">
                  <TrailerButton item={item} />
                </span>
                {!boxset && (
                  <button
                    type="button"
                    className="tv-glass tv-button round"
                    aria-label={tr(played ? 'Mark unwatched' : 'Mark watched')}
                    data-label={tr(played ? 'Mark unwatched' : 'Mark watched')}
                    data-on={played ? '' : undefined}
                    onClick={() =>
                      setPlayed.mutate({ itemId: item.Id!, played: !played })
                    }
                  >
                    <BiCheck />
                  </button>
                )}
                <button
                  type="button"
                  className="tv-glass tv-button round"
                  aria-label={tr(
                    favourite ? 'Remove from favourites' : 'Add to favourites'
                  )}
                  data-label={tr(favourite ? 'Favourite' : 'Add to favourites')}
                  onClick={() =>
                    setFavorite.mutate({
                      itemId: item.Id!,
                      favorite: !favourite,
                    })
                  }
                >
                  {favourite ? <BiSolidHeart /> : <BiHeart />}
                </button>
                {series && (
                  <RoundAction
                    label="Random episode"
                    onClick={() =>
                      openRandom({ kind: 'episode', series: item })
                    }
                  >
                    <BiShuffle />
                  </RoundAction>
                )}
                {!boxset && (
                  <RoundAction
                    label={inParty ? 'Watch party' : 'Watch together'}
                    onClick={() =>
                      openPartySheet(
                        target && !inParty
                          ? {
                              play: {
                                title: fullTitle(target),
                                run: () =>
                                  picker.play(target, { startMs: resumeMs }),
                              },
                            }
                          : {}
                      )
                    }
                  >
                    <BiGroup />
                  </RoundAction>
                )}
                {target && !!devices.data?.length && (
                  <RoundAction
                    label="Play on another device"
                    onClick={() =>
                      openRemote({ play: { item: target, startMs: resumeMs } })
                    }
                  >
                    <BiCast />
                  </RoundAction>
                )}
                {item.Type === 'Movie' && playable(item) && (
                  <RoundAction
                    label="Add to playlist"
                    onClick={() => openAddToPlaylist([item])}
                  >
                    <BiListPlus />
                  </RoundAction>
                )}
                {canDrop && series && (
                  <RoundAction
                    label={dropped ? 'Resume following' : 'Drop show'}
                    on={dropped}
                    onClick={() =>
                      setDropped.mutate({ itemId: item.Id!, dropped: !dropped })
                    }
                  >
                    <BiX />
                  </RoundAction>
                )}
                {/* The app's own rating and download controls, made glass. */}
                <span className="tv-app-action">
                  {(item.Type === 'Movie' || series) && (
                    <RatingButton item={item} />
                  )}
                  {item.Type === 'Movie' && item.LocationType !== 'Virtual' && (
                    <DownloadButton item={item} />
                  )}
                  {series && (
                    <ShowDownloadMenu
                      series={item}
                      season={seasons.find((s) => s.Id === season)}
                    />
                  )}
                </span>
              </div>
            </>
          )}
        </div>
        <div ref={lowerRef}>
          {series && seasons.length > 0 && (
            <div className="tv-tabs">
              {seasons.map((s) => (
                <button
                  key={s.Id}
                  type="button"
                  className="tv-tab"
                  data-on={s.Id === season ? '' : undefined}
                  // tvOS shows a season's episodes as soon as its tab is focused.
                  onFocus={() => pickSoon(s.Id)}
                  onClick={() => choose(s.Id)}
                >
                  {s.Name}
                </button>
              ))}
            </div>
          )}
          {series && episodes.length > 0 && (
            <Scroller
              // A season opens its own window of cards.
              key={season}
              scrollRef={episodesRef}
              rowRef={episodeCards}
              shape="wide"
              start={Math.max(0, openingEpisode)}
            >
              {episodes.map((e) => (
                <EpisodeCard
                  key={e.Id}
                  episode={e}
                  onClick={() =>
                    picker.play(e, {
                      startMs: ticksToMs(e.UserData?.PlaybackPositionTicks),
                    })
                  }
                />
              ))}
            </Scroller>
          )}
          {/* Below the episodes, drawn once scrolled near, so the page opens light. */}
          <Later room="25vw">
            {boxset && memberItems.length > 0 && (
              <Row title={tr('In this collection')}>
                {memberItems.map((m) => (
                  <PosterCard key={m.Id} item={m} />
                ))}
              </Row>
            )}
            {!!item?.People?.length && (
              <Row title={tr('Cast & Crew')}>
                {item.People.map((p, i) => (
                  <PersonCard key={`${p.Id}-${i}`} person={p} />
                ))}
              </Row>
            )}
            <Related itemId={itemId} />
            {item && <About item={item} />}
            {!!item?.ExternalUrls?.length && (
              <div className="tv-links tv-app-action">
                <ExternalLinks
                  links={linksFor(
                    item,
                    seasons.find((s) => s.Id === season)
                  )}
                />
              </div>
            )}
          </Later>
          <div style={{ height: '20vh' }} />
        </div>
      </div>
    </div>
  );
}

/**
 * The page's artwork, lowered to the sea (as on home) as focus or scrolling goes below
 * the hero: kept apart so that change redraws only the artwork, not every episode.
 */
function ItemBackdrop({
  lowerRef,
  ...props
}: Omit<React.ComponentProps<typeof Backdrop>, 'lowered'> & {
  lowerRef: React.RefObject<HTMLElement | null>;
}) {
  const focused = useFocusInside(lowerRef);
  const scrolled = useScrolledDown();
  return <Backdrop {...props} lowered={focused || scrolled} ambient />;
}

/** Asked for only once scrolled near, as the app's page does. */
function Related({ itemId }: { itemId: string }) {
  const similar = useSimilar(itemId, true).data?.Items ?? [];
  if (!similar.length) return null;
  return (
    <Row title={tr('Related')}>
      {similar.map((s) => (
        <PosterCard key={s.Id} item={s} />
      ))}
    </Row>
  );
}

/** An episode as the app's own list shows it, in tvOS's layout: its still, then a line with its number, length and rating (or when it airs), its name and summary. */
function EpisodeCard({
  episode,
  onClick,
}: {
  episode: BaseItemDto;
  onClick: () => void;
}) {
  const { client } = useSession();
  const own = !!episode.ImageTags?.Primary;
  const progress = progressOf(episode);
  const unavailable = unavailableKind(episode);
  const watched = !!episode.UserData?.Played;
  const badges = [
    unavailableLabel(episode),
    ...episodeMarks(episode).map(markLabel),
  ].filter(Boolean);
  const runtime = ticksToMs(episode.RunTimeTicks);
  const when =
    unavailable === 'unaired' && episode.PremiereDate
      ? tr('Airs {when}', { when: untilLabel(episode.PremiereDate) })
      : runtime
        ? duration(runtime)
        : null;
  const kicker = [
    episode.IndexNumber != null
      ? tr('Episode {n}', { n: episode.IndexNumber })
      : null,
    when,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <ItemMenu item={episode} onPage>
      <button
        type="button"
        className="tv-card tv-wide tv-episode"
        data-focus="own"
        data-unavailable={unavailable ?? undefined}
        // An episode not out yet, or missing, has nothing to play.
        onClick={unavailable ? undefined : onClick}
      >
        <ArtTile>
          <Artwork
            src={(width) => landscapeUrls(client, episode, { maxWidth: width })}
            alt=""
          />
          {/* Over the show's own art, which several episodes may share, its number tells them apart. */}
          {!own && episode.IndexNumber != null && (
            <span className="tv-number">{episode.IndexNumber}</span>
          )}
          {badges.length > 0 && (
            <div className="tv-badges">
              {badges.map((b) => (
                <span key={b} className="tv-tag">
                  {b}
                </span>
              ))}
            </div>
          )}
          {watched && (
            <span className="tv-watched" aria-label={tr('Watched')}>
              ✓
            </span>
          )}
          {progress != null && progress > 0 && !watched && (
            <div className="tv-overlay" style={{ paddingTop: 0 }}>
              <div className="tv-progress">
                <i style={{ width: `${Math.min(progress, 1) * 100}%` }} />
              </div>
            </div>
          )}
        </ArtTile>
        <small>
          {kicker}
          {episode.CommunityRating
            ? ` · ★ ${episode.CommunityRating.toFixed(1)}`
            : ''}
        </small>
        <strong>{episode.Name}</strong>
        {episode.Overview && <p>{episode.Overview}</p>}
      </button>
    </ItemMenu>
  );
}

/** The title's facts, as tvOS lists them at the foot of its page. */
function About({ item }: { item: BaseItemDto }) {
  const series = item.Type === 'Series';
  const facts: [string, string | undefined | null][] = [
    ['Genres', item.Genres?.join(', ')],
    [
      series ? 'First aired' : 'Released',
      item.PremiereDate
        ? new Date(item.PremiereDate).toLocaleDateString(formatLocale(), {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : item.ProductionYear?.toString(),
    ],
    [
      'Studios',
      item.Studios?.map((s) => s.Name)
        .filter(Boolean)
        .join(', '),
    ],
    // As the app's details: when a running show airs, and where it's made.
    [
      'Airs',
      series && item.Status === 'Continuing'
        ? airsLine(item.AirDays, item.AirTime)
        : null,
    ],
    ['Country', item.ProductionLocations?.join(', ')],
    ['Rated', item.OfficialRating ?? undefined],
    [
      'Score',
      item.CommunityRating ? `★ ${item.CommunityRating.toFixed(1)}` : undefined,
    ],
  ];
  const shown = facts.filter(([, v]) => !!v);
  if (!shown.length && !item.Overview) return null;
  return (
    <section className="tv-row tv-about">
      <h2>{tr('About')}</h2>
      <div className="tv-about-body">
        {item.Overview && <p>{item.Overview}</p>}
        <dl>
          {shown.map(([k, v]) => (
            <React.Fragment key={k}>
              <dt>{tr(k)}</dt>
              <dd>{v}</dd>
            </React.Fragment>
          ))}
        </dl>
      </div>
    </section>
  );
}

/** A round glass button whose name shows under it while focused, as tvOS labels its icon buttons. */
function RoundAction({
  label,
  on,
  onClick,
  children,
}: {
  label: string;
  on?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="tv-glass tv-button round"
      aria-label={tr(label)}
      data-label={tr(label)}
      data-on={on ? '' : undefined}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
