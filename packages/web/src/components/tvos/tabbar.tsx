/* eslint-disable lingui/no-unlocalized-strings -- the tvOS style's words go through tr() (./i18n), which this rule doesn't know */
import React from 'react';
import type { IconType } from 'react-icons';
import {
  BiCalendar,
  BiCompass,
  BiDotsHorizontalRounded,
  BiHistory,
  BiHomeAlt2,
  BiSearch,
} from 'react-icons/bi';
import { navigate, to } from '../../lib/paths';
import { tr } from './i18n';

interface Tab {
  name: string;
  icon: IconType;
  path: string;
  match: (p: string) => boolean;
}

const TABS: Tab[] = [
  { name: 'Home', icon: BiHomeAlt2, path: to.home, match: (p) => p === '/' },
  {
    name: 'Search',
    icon: BiSearch,
    path: to.search(),
    match: (p) => p.startsWith('/search'),
  },
  {
    name: 'Discover',
    icon: BiCompass,
    path: to.discover(),
    match: (p) => p.startsWith('/discover'),
  },
  {
    name: 'History',
    icon: BiHistory,
    path: to.history,
    match: (p) => p.startsWith('/history'),
  },
  {
    name: 'Calendar',
    icon: BiCalendar,
    path: to.calendar(),
    match: (p) => p.startsWith('/calendar'),
  },
];

// The sidebar's other pages, which the More tab stands for.
const MORE_PAGES = /^\/(library|favourites|settings|downloads)/;

/** A tab's own page, where iOS shows no Back: the tab bar is the way out. */
export function isTabRoot(pathname: string): boolean {
  return TABS.some((t) => t.match(pathname));
}

/**
 * The iPhone's tab bar, at the foot of the screen on phones only (phone.css shows it);
 * More opens the sidebar as a sheet with the sections left out of it.
 */
export function TabBar({
  pathname,
  moreOpen,
  onMore,
}: {
  pathname: string;
  moreOpen: boolean;
  onMore: () => void;
}) {
  const current = moreOpen ? undefined : TABS.find((t) => t.match(pathname));
  const go = (tab: Tab) => {
    // As iOS: the tab showing scrolls back to its top instead.
    if (tab === current && pathname === tab.path.split('?')[0])
      window.scrollTo({ top: 0, behavior: 'smooth' });
    else navigate(tab.path);
  };
  return (
    <nav className="tv-tabbar" aria-label={tr('Menu')}>
      {TABS.map((tab) => (
        <button
          key={tab.name}
          type="button"
          className="tv-tabbar-item"
          data-current={tab === current ? '' : undefined}
          onClick={() => go(tab)}
        >
          <tab.icon />
          <span>{tr(tab.name)}</span>
        </button>
      ))}
      <button
        type="button"
        className="tv-tabbar-item tv-tabbar-more"
        data-current={moreOpen || MORE_PAGES.test(pathname) ? '' : undefined}
        onClick={onMore}
      >
        <BiDotsHorizontalRounded />
        <span>{tr('More')}</span>
      </button>
    </nav>
  );
}

/** A swipe in from the left edge goes back, as iOS does; only installed to the home screen, where Safari's own is missing. */
export function useSwipeBack(onBack: () => void, enabled: boolean) {
  React.useEffect(() => {
    const standalone =
      matchMedia('(display-mode: standalone)').matches ||
      (navigator as { standalone?: boolean }).standalone;
    if (!enabled || !standalone) return;
    let start: { x: number; y: number } | null = null;
    const down = (e: TouchEvent) => {
      const t = e.touches[0];
      start = t && t.clientX < 24 ? { x: t.clientX, y: t.clientY } : null;
    };
    const up = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      if (!start || !t) return;
      const dx = t.clientX - start.x;
      if (dx > 80 && Math.abs(t.clientY - start.y) < dx / 2) onBack();
      start = null;
    };
    window.addEventListener('touchstart', down, { passive: true });
    window.addEventListener('touchend', up, { passive: true });
    return () => {
      window.removeEventListener('touchstart', down);
      window.removeEventListener('touchend', up);
    };
  }, [onBack, enabled]);
}
