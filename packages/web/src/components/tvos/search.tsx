/* eslint-disable lingui/no-unlocalized-strings -- the tvOS style's words go through tr() (./i18n), which this rule doesn't know */
import React from 'react';
import { BiSearch, BiTime, BiX } from 'react-icons/bi';
import { useDebounce } from '@aiostreams/ui/hooks/debounce';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@aiostreams/ui/context-menu';
import { settings, useSetting } from '../../lib/settings';
import { useAction } from '../../lib/input';
import {
  useLiveTvView,
  useSearch,
  useSearchSuggestions,
} from '@/lib/jellyfin/queries';
import {
  airedShare,
  airingAt,
  useNow,
  useSchedules,
} from '@/features/live-tv/live-tv';
import { posterUrl } from '@/lib/artwork/urls';
import { BATCH } from '@/features/live-tv/channel-list';
import { CachedImage } from '../cached-image';
import { ItemMenu } from '@/components/media/item-menu';
import { useVersionPicker } from '@/features/versions/version-picker';
import { useSession } from '@/lib/jellyfin/session';
import { useSearchHistory } from '@/app/search/search-history';
import { goBack, itemPath, navigate, to } from '../../lib/paths';
import type { BaseItemDto } from '@/lib/jellyfin/types';
import { nameWords, useKeyboardCompletions, useVoice } from '@/app/search/page';
import { ArtTile, PersonCard, PosterCard, Row, Spinner } from './parts';
import { tr } from './i18n';

/**
 * Search as tvOS has it: a glass field, then movies, shows and people as the
 * results arrive; the recent searches while nothing is typed.
 */
export function TvosSearch({ initialTerm }: { initialTerm: string }) {
  const { user } = useSession();
  const [term, setTerm] = React.useState(initialTerm);
  // As the app's: a term picked (Enter, a recent one, the voice) searches at once and is remembered.
  const [chosen, setChosen] = React.useState(initialTerm);
  const typed = term.trim();
  const debounced = useDebounce(typed, 350);
  const settled = typed === chosen ? typed : debounced;
  const [combine] = useSetting(settings.interface.combineSearch);
  const mixed = useSearch(settled, 'Movie,Series', combine);
  const movies = useSearch(settled, 'Movie', !combine);
  const shows = useSearch(settled, 'Series', !combine);
  const people = useSearch(settled, 'Person');
  // As the app's: channels too, where the server has Live TV.
  const live = !!useLiveTvView().data;
  const channels = useSearch(settled, 'TvChannel', live);
  const history = useSearchHistory(user.Id!);
  // As the app's: titles the typing could mean, offered before it settles, and to a TV's own keyboard.
  const suggesting = typed !== chosen;
  const suggestions = useSearchSuggestions(
    useDebounce(typed, 200),
    5,
    suggesting
  );
  const hints =
    suggesting && typed.length >= 2
      ? (suggestions.data?.SearchHints ?? [])
      : [];
  useKeyboardCompletions(hints.map((h) => h.Name ?? '').filter(Boolean));
  const choose = (picked: string) => {
    const next = picked.trim();
    setTerm(next);
    setChosen(next);
    history.add(next);
  };
  const searching = settled.length >= 2;
  const list = (q: typeof movies) =>
    q.isPlaceholderData ? [] : (q.data?.Items ?? []);
  // Only people the term names, and first when it names them exactly, as the app's search.
  const queryWords = nameWords(settled);
  const named = list(people)
    .map((person) => ({ person, words: nameWords(person.Name ?? '') }))
    .filter(({ words }) =>
      queryWords.every((q) => words.some((w) => w.startsWith(q)))
    );
  const peopleFirst = named.some(
    ({ words }) => words.join(' ') === queryWords.join(' ')
  );
  const found = {
    mixed: combine ? list(mixed) : [],
    movies: combine ? [] : list(movies),
    shows: combine ? [] : list(shows),
    people: named.map(({ person }) => person),
    channels: live ? list(channels) : [],
  };
  const loading =
    searching &&
    (combine ? [mixed, people] : [movies, shows, people]).some(
      (q) => q.isLoading || q.isPlaceholderData
    );
  const any =
    found.mixed.length +
      found.movies.length +
      found.shows.length +
      found.people.length +
      found.channels.length >
    0;

  // Back (Esc or the remote's) leaves search at once, even from the field, rather than only unfocusing it.
  useAction('back', () => {
    goBack(to.home);
    return true;
  });
  // Keeps the term in the address, so coming back shows the same results.
  React.useEffect(() => {
    if (settled !== initialTerm)
      navigate(to.search(settled), { replace: true });
  }, [settled, initialTerm]);

  // The app's voice search, where the device can hear (a TV's or phone's microphone).
  const voice = useVoice(choose, setTerm);

  const peopleRow = found.people.length > 0 && (
    <Row title={tr('People')}>
      {found.people.map((p) => (
        <span key={p.Id} onClick={() => history.add(settled)}>
          <PersonCard
            person={{
              Id: p.Id,
              Name: p.Name,
              PrimaryImageTag: p.ImageTags?.Primary,
              Type: 'Actor',
            }}
          />
        </span>
      ))}
    </Row>
  );

  const open = (item: BaseItemDto) => {
    history.add(settled);
    navigate(itemPath(item));
  };

  return (
    <div className="tv-page tv-search">
      <label className="tv-glass tv-field">
        <BiSearch size="2vw" />
        <input
          autoFocus
          value={term}
          placeholder={tr(
            voice?.hearing ? 'Listening…' : 'Movies, shows and people'
          )}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && typed) choose(typed);
          }}
        />
        {loading && <Spinner size="2vw" />}
      </label>
      {voice && <span className="tv-voice">{voice.button}</span>}
      {hints.length > 0 && (
        <div className="tv-tabs tv-tabs-flush tv-suggestions">
          {hints.map((hint) => (
            <button
              key={hint.Id}
              type="button"
              className="tv-tab"
              onClick={() => choose(hint.Name ?? '')}
            >
              <BiSearch /> {hint.Name}
              {hint.ProductionYear && <small> {hint.ProductionYear}</small>}
            </button>
          ))}
        </div>
      )}
      {!searching && history.terms.length > 0 && (
        <div className="tv-recent">
          <h2>{tr('Recent')}</h2>
          <div className="tv-tabs tv-tabs-flush">
            {history.terms.map((t) => (
              // As the app's on TVs: hold Select to remove one.
              <ContextMenu key={t}>
                <ContextMenuTrigger asChild>
                  <button
                    type="button"
                    className="tv-tab"
                    onClick={() => choose(t)}
                  >
                    <BiTime /> {t}
                  </button>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem onClick={() => history.remove(t)}>
                    <BiX /> {tr('Remove')}
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            ))}
            <button
              type="button"
              className="tv-tab tv-tab-action"
              onClick={history.clear}
            >
              {tr('Clear all')}
            </button>
          </div>
        </div>
      )}
      {searching && (
        <div className="tv-results">
          {peopleFirst && peopleRow}
          {found.mixed.length > 0 && (
            <Row title={tr('Results')}>
              {found.mixed.map((i) => (
                <PosterCard key={i.Id} item={i} onClick={() => open(i)} />
              ))}
            </Row>
          )}
          {found.movies.length > 0 && (
            <Row title={tr('Movies')}>
              {found.movies.map((i) => (
                <PosterCard key={i.Id} item={i} onClick={() => open(i)} />
              ))}
            </Row>
          )}
          {found.shows.length > 0 && (
            <Row title={tr('Shows')}>
              {found.shows.map((i) => (
                <PosterCard key={i.Id} item={i} onClick={() => open(i)} />
              ))}
            </Row>
          )}
          {!peopleFirst && peopleRow}
          {found.channels.length > 0 && (
            <ChannelRow
              channels={found.channels}
              onPlay={() => history.add(settled)}
            />
          )}
          {!loading && !any && (
            <div className="tv-note">
              {tr('No results for “{term}”', { term: settled })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Channels found, each showing what is on now over its logo; Select plays it. */
function ChannelRow({
  channels,
  onPlay,
}: {
  channels: BaseItemDto[];
  onPlay: () => void;
}) {
  const { client } = useSession();
  const picker = useVersionPicker();
  const schedules = useSchedules([channels.slice(0, BATCH).map((c) => c.Id!)]);
  const now = useNow();
  return (
    <Row title={tr('Channels')} shape="wide">
      {channels.map((channel) => {
        const programmes = schedules.get(channel.Id!);
        const programme =
          (programmes && airingAt(programmes, now)) ??
          (channel.CurrentProgram && airingAt([channel.CurrentProgram], now));
        const logo = posterUrl(client, channel, { maxWidth: 240 });
        return (
          <ItemMenu key={channel.Id} item={channel}>
            <button
              type="button"
              className="tv-card tv-wide tv-channel"
              data-focus="own"
              onClick={() => {
                onPlay();
                picker.play(channel);
              }}
            >
              <ArtTile>
                {logo && <CachedImage src={logo} alt="" />}
                <div className="tv-overlay">
                  <strong>
                    {channel.ChannelNumber && (
                      <small>{channel.ChannelNumber} </small>
                    )}
                    {channel.Name}
                  </strong>
                  {programme?.Name && <span>{programme.Name}</span>}
                  {programme && (
                    <div className="tv-progress">
                      <i
                        style={{
                          width: `${airedShare(programme, now) * 100}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              </ArtTile>
            </button>
          </ItemMenu>
        );
      })}
    </Row>
  );
}
