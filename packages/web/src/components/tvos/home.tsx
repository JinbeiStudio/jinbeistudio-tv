/* eslint-disable lingui/no-unlocalized-strings -- the tvOS style's words go through tr() (./i18n), which this rule doesn't know */
import React from 'react';
import {
  libraryTypes,
  mergeRows,
  needsGenre,
  useItemPages,
  useLibraryHeads,
  useNextUp,
  useResume,
  useUpcoming,
  useViews,
} from '../../lib/queries';
import { useFeature } from '../../lib/server-info';
import { autoSources, interleave } from '../../pages/home';
import { cardShape } from '../../lib/images';
import { useNear } from '../../lib/use-in-view';
import { usePageShown } from '../../lib/page-shown';
import { settings, useSetting } from '../../lib/settings';
import { duration, progressOf, remainingMs, ticksToMs } from '../../lib/format';
import { itemPath, navigate, to } from '../../lib/paths';
import {
  BiChevronRight,
  BiHeart,
  BiInfoCircle,
  BiPlay,
  BiSolidHeart,
} from 'react-icons/bi';
import { useFetchNextUp, useSetFavorite } from '../../lib/queries';
import type { BaseItemDto } from '../../lib/types';
import { useVersionPicker } from '../version-picker';
import {
  Backdrop,
  Logo,
  Meta,
  PosterCard,
  Row,
  SeeAll,
  Spinner,
  TopBar,
  WideCard,
  FollowCard,
  useSaverOn,
  useScrolledDown,
  useFocusWithin,
} from './parts';
import {
  catalogName,
  isAnimeCatalog,
  isForYouCatalog,
  isServiceLibrary,
  nameKind,
  tr,
} from './i18n';

const HERO_EACH = 8;
const HERO_MAX = 10;

/**
 * The tvOS style's home: a hero of the movies and shows libraries over the
 * whole screen, then the same rows as the app's own home, in its order.
 */
// Memoised as the app's kept home, so pages over it don't redraw it.
export const TvosHome = React.memo(function TvosHome() {
  // Kept hidden under another page, it holds still and leaves the screen to it.
  const shown = usePageShown();
  const [rowsRef, rowsFocusedOnly] = useFocusWithin<HTMLDivElement>();
  // Down in the rows, by focus or by scrolling, the artwork turns to frosted glass.
  const scrolled = useScrolledDown(shown);
  const rowsFocused = rowsFocusedOnly || scrolled;
  // The app's hero setting: following, the artwork behind the rows is the card the focus rests on.
  const [heroMode] = useSetting(settings.interface.heroMode);
  const [followed, setFollowed] = React.useState<BaseItemDto>();
  const resting = React.useRef(0);
  const follow = React.useCallback((item: BaseItemDto) => {
    window.clearTimeout(resting.current);
    resting.current = window.setTimeout(() => setFollowed(item), 400);
  }, []);
  React.useEffect(() => () => window.clearTimeout(resting.current), []);
  return (
    <div className="tv-page tv-home">
      {shown && <TopBar hidden={rowsFocused} />}
      <div className="tv-content">
        <Hero
          lowered={rowsFocused}
          shown={shown}
          followed={
            heroMode !== 'rotate' && rowsFocusedOnly ? followed : undefined
          }
        />
        <div ref={rowsRef}>
          <FollowCard.Provider value={heroMode !== 'rotate' ? follow : null}>
            <HomeRows />
          </FollowCard.Provider>
        </div>
      </div>
    </div>
  );
});

/** A "For you" pick with its synopsis alone: the model's reason before it is always English. */
function withoutReason(item: BaseItemDto): BaseItemDto {
  const overview = item.Overview ?? '';
  const gap = overview.indexOf('\n\n');
  // The model is asked for under 15 words; a longer first paragraph is the synopsis's own.
  if (gap < 0 || gap > 160 || overview.slice(0, gap).includes('\n'))
    return item;
  return { ...item, Overview: overview.slice(gap + 2) };
}

function useCatalogs() {
  const views = useViews();
  const genreRequired = useFeature('genreRequired');
  const all = (views.data?.Items ?? []).filter((v) => !isServiceLibrary(v));
  return {
    views,
    catalogs: genreRequired ? all.filter((v) => !needsGenre(v)) : all,
  };
}

/** The hero and its artwork, apart from the rows and memoised, so its turning and the page's scrolling don't redraw each other. */
const Hero = React.memo(function Hero({
  lowered,
  shown,
  followed,
}: {
  lowered: boolean;
  shown: boolean;
  /** The card the focus rests on, whose artwork shows instead while following. */
  followed?: BaseItemDto;
}) {
  const { views, catalogs } = useCatalogs();
  const all = views.data?.Items ?? [];
  // As the app's hero, from the sources chosen in its settings (catalogs, Continue watching, Next up), else automatic.
  const [featured] = useSetting(settings.interface.featured);
  const live =
    featured === 'auto' || !views.data
      ? featured
      : featured.filter(
          (s) => !s.startsWith('view:') || all.some((v) => `view:${v.Id}` === s)
        );
  const sources =
    live === 'auto' || (!live.length && featured.length)
      ? autoSources(catalogs)
      : live;
  const heroViews = sources
    .filter((s) => s.startsWith('view:'))
    .flatMap((s) => all.find((v) => v.Id === s.slice(5)) ?? []);
  const heads = useLibraryHeads(heroViews, HERO_EACH);
  const resume = useResume();
  const nextUp = useNextUp();
  const hero = React.useMemo(() => {
    const headOf = new Map(heroViews.map((view, i) => [view.Id, heads[i]]));
    const forYou = new Set(
      heroViews.filter(isForYouCatalog).map((view) => view.Id)
    );
    const pick = (s: string) =>
      s === 'resume'
        ? mergeRows(resume.data?.Items, nextUp.data?.Items)
        : s === 'next-up'
          ? (nextUp.data?.Items ?? [])
          : forYou.has(s.slice(5))
            ? (headOf.get(s.slice(5))?.data?.Items ?? []).map(withoutReason)
            : (headOf.get(s.slice(5))?.data?.Items ?? []);
    // Only what has artwork to fill the screen with.
    return interleave(
      sources.map((s) =>
        pick(s)
          .filter(
            (i) =>
              i.BackdropImageTags?.length || i.ParentBackdropImageTags?.length
          )
          .slice(0, HERO_EACH)
      ),
      HERO_MAX
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heads, resume.data, nextUp.data, sources.join()]);

  const [index, setIndex] = React.useState(0);
  const [heroSeconds] = useSetting(settings.interface.heroSeconds);
  const [heroRef, heroFocused] = useFocusWithin<HTMLDivElement>();
  const saverOn = useSaverOn();
  // The hero moves on by itself until it is focused, and not while down in the rows.
  React.useEffect(() => {
    if (heroFocused || lowered || !shown || saverOn || hero.length < 2) return;
    const timer = window.setInterval(
      () => setIndex((i) => (i + 1) % hero.length),
      heroSeconds * 1000
    );
    return () => window.clearInterval(timer);
  }, [heroFocused, lowered, shown, saverOn, hero.length, heroSeconds]);
  const current = hero[index % Math.max(hero.length, 1)];

  return (
    <>
      {shown && (
        <Backdrop item={followed ?? current} lowered={lowered} ambient />
      )}
      <div ref={heroRef} className="tv-hero">
        {!current && (views.isLoading || heads.some((h) => h.isLoading)) && (
          <Spinner />
        )}
        {views.isSuccess && !views.data?.Items?.length && (
          <div className="tv-note">
            {tr('No catalogs: add some in your AIOStreams configuration.')}
          </div>
        )}
        {current && (
          <>
            <Logo item={current} />
            <Meta item={current} max={3} />
            {current.Overview && (
              <div className="tv-overview">{current.Overview}</div>
            )}
            <HeroButtons
              item={current}
              onNext={() => setIndex((i) => (i + 1) % Math.max(hero.length, 1))}
            />
          </>
        )}
      </div>
    </>
  );
});

const HomeRows = React.memo(function HomeRows() {
  const resume = useResume();
  const nextUp = useNextUp();
  const { catalogs } = useCatalogs();
  const [mergeNextUp] = useSetting(settings.interface.mergeNextUp);
  // As the app's row: merged without repeats, most recently watched first.
  const continueItems = React.useMemo(
    () =>
      mergeRows(resume.data?.Items, mergeNextUp ? nextUp.data?.Items : null),
    [resume.data, nextUp.data, mergeNextUp]
  );
  return (
    <>
      <EpisodeRow title={tr('Continue watching')} items={continueItems} />
      {!mergeNextUp && (
        <EpisodeRow title={tr('Next up')} items={nextUp.data?.Items ?? []} />
      )}
      <UpcomingRow />
      {catalogs.map((view, i) => (
        <CatalogRow key={view.Id} view={view} first={i === 0} />
      ))}
    </>
  );
});

/** Plays straight away, as Continue Watching and Up Next do on tvOS. */
function EpisodeRow({ title, items }: { title: string; items: BaseItemDto[] }) {
  const picker = useVersionPicker();
  if (!items.length) return null;
  return (
    <Row title={title}>
      {items.map((item) => (
        <WideCard
          key={item.Id}
          item={item}
          // As the app's row: how long is left of what was started.
          subtitle={
            [
              item.Type === 'Episode' ? itemSubtitleOf(item) : null,
              leftOf(item),
            ]
              .filter(Boolean)
              .join(' · ') || undefined
          }
          onClick={() =>
            picker.play(item, {
              startMs: ticksToMs(item.UserData?.PlaybackPositionTicks),
            })
          }
        />
      ))}
    </Row>
  );
}

function UpcomingRow() {
  const upcoming = useUpcoming();
  const items = upcoming.data?.Items ?? [];
  if (!items.length) return null;
  return (
    <Row title={tr('Upcoming')}>
      {items.map((item) => (
        <WideCard
          key={item.Id}
          item={item}
          onClick={() => navigate(itemPath(item))}
        />
      ))}
    </Row>
  );
}

/** Catalogs whose names say they are anime; the server only tells movies from shows. */
const ANIME = /anime|anilist|crunchyroll|\bmal\b|anidb|kitsu/i;

export function catalogTag(view: BaseItemDto): string | undefined {
  // A name that says its kind is believed; the rest is read from the path, the id or the words in the name.
  const named = nameKind(view.Name);
  if (named) return named;
  if (isAnimeCatalog(view) || ANIME.test(view.Name ?? '')) return 'Anime';
  if (view.CollectionType === 'movies') return 'Movies';
  if (view.CollectionType === 'tvshows') return 'Series';
  return nameKind(view.Name);
}

function leftOf(item: BaseItemDto): string | null {
  const left = remainingMs(item);
  return left && progressOf(item)
    ? tr('{time} left', { time: duration(left) })
    : null;
}

function itemSubtitleOf(item: BaseItemDto): string {
  return item.ParentIndexNumber != null && item.IndexNumber != null
    ? `S${item.ParentIndexNumber}, E${item.IndexNumber}`
    : '';
}

/** Fetched and drawn once near the screen, as the app's home rows, so the home opens light. */
function CatalogRow({ view, first }: { view: BaseItemDto; first: boolean }) {
  const [ref, near] = useNear<HTMLDivElement>('400px', first);
  const pages = useItemPages(view.Id!, {
    types: libraryTypes(view),
    recursive: true,
    pageSize: 20,
    enabled: near,
  });
  const items = pages.data?.pages.flatMap((p) => p.Items ?? []) ?? [];
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = pages;
  if (pages.isSuccess && !items.length) return null;
  // As the app's rows: a catalog of mostly landscape artwork shows wide cards.
  const landscape =
    items.length > 0 &&
    items.filter((i) => cardShape(i) === 'landscape').length > items.length / 2;
  // More of the catalog loads as focus nears the end of the row, as the app's rows do.
  const more = (i: number) => {
    if (i >= items.length - 5 && hasNextPage && !isFetchingNextPage)
      void fetchNextPage();
  };
  return (
    <div ref={ref}>
      <Row
        title={catalogName(view)}
        tag={catalogTag(view)}
        shape={landscape ? 'wide' : 'poster'}
      >
        {items.length ? (
          <>
            {items.map((item, i) => (
              <div key={item.Id} onFocus={() => more(i)}>
                {landscape ? (
                  <WideCard
                    item={item}
                    onClick={() => navigate(itemPath(item))}
                  />
                ) : (
                  <PosterCard item={item} />
                )}
              </div>
            ))}
            <SeeAll onClick={() => navigate(to.discover(view.Id!))} />
          </>
        ) : (
          // Keeps the row's room while it loads, so the rows below don't all come near at once.
          <div className="tv-card tv-poster" aria-hidden>
            <div className="tv-art" data-loading="" />
          </div>
        )}
      </Row>
    </div>
  );
}

/**
 * The hero's buttons as Apple's: Play, then round buttons to add to
 * favourites, open the title's page and go to the next title.
 */
function HeroButtons({
  item,
  onNext,
}: {
  item: BaseItemDto;
  onNext: () => void;
}) {
  const picker = useVersionPicker();
  const fetchNextUp = useFetchNextUp();
  const setFavorite = useSetFavorite();
  const favourite = !!item.UserData?.IsFavorite;
  const play = async () => {
    // A show plays the episode it continues with, as Apple's Play does.
    const target = item.Type === 'Series' ? await fetchNextUp(item.Id!) : item;
    if (target)
      picker.play(target, {
        startMs: ticksToMs(target.UserData?.PlaybackPositionTicks),
      });
    else navigate(itemPath(item));
  };
  return (
    <div className="tv-buttons">
      <button
        type="button"
        className="tv-glass tv-button"
        onClick={() => void play()}
      >
        <BiPlay /> {tr('Play')}
      </button>
      <button
        type="button"
        className="tv-glass tv-button round"
        aria-label={tr(
          favourite ? 'Remove from favourites' : 'Add to favourites'
        )}
        data-label={tr(favourite ? 'Favourite' : 'Add to favourites')}
        onClick={() =>
          setFavorite.mutate({ itemId: item.Id!, favorite: !favourite })
        }
      >
        {favourite ? <BiSolidHeart /> : <BiHeart />}
      </button>
      <button
        type="button"
        className="tv-glass tv-button round"
        aria-label={tr('Details')}
        data-label={tr('Details')}
        onClick={() => navigate(itemPath(item))}
      >
        <BiInfoCircle />
      </button>
      <button
        type="button"
        className="tv-glass tv-button round"
        aria-label={tr('Next')}
        data-label={tr('Next')}
        onClick={onNext}
      >
        <BiChevronRight />
      </button>
    </div>
  );
}
