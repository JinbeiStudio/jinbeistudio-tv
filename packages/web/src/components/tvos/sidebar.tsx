/* eslint-disable lingui/no-unlocalized-strings -- the tvOS style's words go through tr() (./i18n), which this rule doesn't know */
import React from 'react';
import type { IconType } from 'react-icons';
import {
  BiCalendar,
  BiCog,
  BiCompass,
  BiDownload,
  BiGroup,
  BiHistory,
  BiHomeAlt2,
  BiLibrary,
  BiListUl,
  BiSearch,
} from 'react-icons/bi';
import { formatLocale } from '../../lib/i18n';
import { useSession } from '../../lib/session';
import { useOwnAvatar } from '../../lib/queries';
import { navigate, to } from '../../lib/paths';
import { downloadsHost } from '../../lib/downloads';
import { usePlaylistsOffered } from '../../lib/playlists';
import { useParty } from '../../lib/party/party';
import { openPartySheet } from '../party/party-sheet';
import { openPlaylists } from '../playlists';
import { tr } from './i18n';

interface Section {
  name: string;
  icon: IconType;
  path?: string;
  match?: (p: string) => boolean;
  /** Opens a sheet instead of a page. */
  open?: () => void;
}

// In the app's own order.
const SECTIONS: Record<string, Section> = {
  home: {
    name: 'Home',
    icon: BiHomeAlt2,
    path: to.home,
    match: (p) => p === '/',
  },
  discover: {
    name: 'Discover',
    icon: BiCompass,
    path: to.discover(),
    match: (p) => p.startsWith('/discover') || p.startsWith('/library'),
  },
  search: {
    name: 'Search',
    icon: BiSearch,
    path: to.search(),
    match: (p) => p.startsWith('/search'),
  },
  library: {
    name: 'Library',
    icon: BiLibrary,
    path: to.favourites(),
    match: (p) => p.startsWith('/favourites'),
  },
  calendar: {
    name: 'Calendar',
    icon: BiCalendar,
    path: to.calendar(),
    match: (p) => p.startsWith('/calendar'),
  },
  history: {
    name: 'History',
    icon: BiHistory,
    path: to.history,
    match: (p) => p.startsWith('/history'),
  },
  settings: {
    name: 'Settings',
    icon: BiCog,
    path: to.settings(),
    match: (p) => p.startsWith('/settings'),
  },
};

/**
 * The Apple TV app's sidebar (tvOS 27): a glass panel at the left with who is
 * watching and the time, then the sections. It takes the focus while open;
 * Right, Back, a click outside or a section closes it.
 */
export function Sidebar({
  open,
  pathname,
  onClose,
}: {
  open: boolean;
  pathname: string;
  onClose: () => void;
}) {
  const { user, switchUser } = useSession();
  // The app's other sections, where it offers them.
  const playlists = usePlaylistsOffered();
  const inParty = !!useParty();
  const sections: Section[] = [
    SECTIONS.home!,
    SECTIONS.discover!,
    SECTIONS.search!,
    SECTIONS.library!,
    SECTIONS.calendar!,
    SECTIONS.history!,
    ...(playlists
      ? [{ name: 'Playlists', icon: BiListUl, open: openPlaylists }]
      : []),
    {
      name: inParty ? 'Watch party' : 'Watch together',
      icon: BiGroup,
      open: () => openPartySheet(),
    },
    ...(downloadsHost()
      ? [
          {
            name: 'Downloads',
            icon: BiDownload,
            path: to.downloads,
            match: (p: string) => p.startsWith('/downloads'),
          },
        ]
      : []),
    SECTIONS.settings!,
  ];
  const avatar = useOwnAvatar();
  const panel = React.useRef<HTMLElement>(null);
  const before = React.useRef<HTMLElement | null>(null);
  const [now, setNow] = React.useState(() => new Date());

  React.useEffect(() => {
    if (!open) return;
    before.current = document.activeElement as HTMLElement | null;
    setNow(new Date());
    // Focus lands on the section showing, as Apple's sidebar opens on it; else the first section, not the profile.
    const current =
      panel.current?.querySelector<HTMLElement>('[data-current]') ??
      panel.current?.querySelector<HTMLElement>('.tv-sidebar-item');
    current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      // Focus goes back where it was, as the page underneath never moved.
      if (before.current?.isConnected)
        before.current.focus({ preventScroll: true });
    };
  }, [open, onClose]);

  const go = (s: Section) => {
    if (s.open) {
      onClose();
      return s.open();
    }
    before.current = null;
    onClose();
    if (s.path) navigate(s.path);
  };

  return (
    <>
      <div
        className="tv-sidebar-shade"
        data-open={open ? '' : undefined}
        onClick={onClose}
      />
      <nav
        ref={panel}
        className="tv-sidebar"
        data-open={open ? '' : undefined}
        aria-hidden={!open}
        inert={!open}
      >
        <button
          type="button"
          className="tv-sidebar-who"
          onClick={() => switchUser()}
        >
          <span className="tv-avatar">
            {avatar ? (
              <img src={avatar} alt="" />
            ) : (
              (user.Name ?? '?').slice(0, 1)
            )}
          </span>
          <span className="tv-sidebar-name">{user.Name}</span>
          <span className="tv-sidebar-time">
            {now.toLocaleTimeString(formatLocale(), {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </button>
        {sections.map((s) => (
          <button
            key={s.name}
            type="button"
            className="tv-sidebar-item"
            data-section={s.name}
            data-current={s.match?.(pathname) ? '' : undefined}
            onClick={() => go(s)}
          >
            <s.icon />
            {tr(s.name)}
          </button>
        ))}
      </nav>
    </>
  );
}
