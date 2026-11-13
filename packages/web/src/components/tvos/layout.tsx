/* eslint-disable lingui/no-unlocalized-strings -- the tvOS style's words go through tr() (./i18n), which this rule doesn't know */
import React from 'react';
import {
  Outlet,
  useChildMatches,
  useRouter,
  useRouterState,
} from '@tanstack/react-router';
import { cn } from '@aiostreams/ui/core/styling';
import { currentHost } from '../../lib/hosts';
import { navigate, to } from '../../lib/paths';
import { toast } from 'sonner';
import { watchForNewPage } from '../../lib/web-update';
import { isTextField, runAction, useAction } from '../../lib/input';
import { useServerEvents } from '@/features/remote/server-events';
import { PageShown } from '../../lib/page-shown';
import { markTvosStyle } from '../../lib/tvos-style';
import { ConnectionNote } from '@/components/shell/unreachable';
import { PageScroll } from '@/components/shell/page-scroll';
import {
  PagesWork,
  pageName,
  usePlayerLeaving,
} from '@/components/shell/layout';
import { closePlayback, usePlayback } from '../../lib/playback/session';
import { useSession } from '@/lib/jellyfin/session';
import { PlayerPage } from '@/app/player/page';
import { ItemMenuHost } from '@/components/media/item-menu';
import { PartyHost } from '@/features/party/party-host';
import { PlaylistsHost } from '@/features/playlists/playlists';
import { RandomPick } from '@/components/media/random-pick';
import { RemoteSheet } from '@/features/remote/remote-sheet';
import { RemoteTarget } from '@/features/remote/remote-target';
import { ReminderHost } from '@/features/live-tv/live-reminders';
import { VersionPickerProvider } from '@/features/versions/version-picker';
import { WatchNextSync } from '@/components/shell/watch-next';
import { GlideLayers } from '@/components/shell/glide-layers';
import { PinnedTargets } from './parts';
import { BiChevronLeft, BiChevronRight } from 'react-icons/bi';
import { MenuOpener, Pinned, Sea } from './parts';
import { tr } from './i18n';
import { Sidebar } from './sidebar';
import { TabBar, isTabRoot, useSwipeBack } from './tabbar';
import { TvosOutlet } from './routes';

const TvosHome = React.lazy(() =>
  import('./home').then((m) => ({ default: m.TvosHome }))
);
const TvosPlayerInfo = React.lazy(() =>
  import('./player-info').then((m) => ({ default: m.PlayerInfo }))
);
const TvosScreensaver = React.lazy(() =>
  import('./screensaver').then((m) => ({ default: m.Screensaver }))
);

const FOCUSABLE =
  'button:not([disabled]), a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** Whether the page has anything focusable to the left of `el` on its line, scrolled out of a row included. */
function somethingLeftOf(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  // A row's cards scrolled out of sight are still to its left, so a row is looked at whole.
  const row = el.closest('[data-nav-row]');
  if (row) return !row.firstElementChild?.contains(el);
  // Only the page showing: the kept home under it has hundreds of cards.
  const page =
    el.closest('[data-page]') ??
    el.closest('[data-ui="shell"]') ??
    document.body;
  for (const other of page.querySelectorAll<HTMLElement>(FOCUSABLE)) {
    if (other === el || other.contains(el) || el.contains(other)) continue;
    if (other.closest('.tv-sidebar, [inert], [data-nav-out]')) continue;
    const o = other.getBoundingClientRect();
    if (!o.width || !o.height) continue;
    if (o.right <= r.left + 1 && o.bottom > r.top && o.top < r.bottom)
      return true;
  }
  return false;
}

/**
 * A slim glass capsule down the left edge, always there: the menu is that way. Under the pointer it widens and shows
 * an arrow; a click opens the menu. Not focusable, so the remote's Left keeps its own way of opening it.
 */
// A page's first line: its title, search field or tabs.
const PAGE_HEADER = '.tv-page-title, .tv-field, .tv-tab, h1';

function pageHeader(): DOMRect | undefined {
  let found: DOMRect | undefined;
  for (const el of document.querySelectorAll<HTMLElement>(PAGE_HEADER)) {
    if (el.closest('.tv-sidebar, [data-sonner-toast], [inert]')) continue;
    const r = el.getBoundingClientRect();
    if (!r.height || r.top + window.scrollY > window.innerHeight / 4) continue;
    if (!found || r.top < found.top) found = r;
  }
  return found;
}

/** Back, top left, for a pointer or a touch; a TV's remote has its own Back key, so it shows no button. */
function BackButton({
  pathname,
  onBack,
}: {
  pathname: string;
  onBack: () => void;
}) {
  const ref = React.useRef<HTMLButtonElement>(null);
  // Level with the page's first line, which sits lower on some pages than others.
  React.useLayoutEffect(() => {
    const button = ref.current;
    if (!button) return;
    let frame = 0;
    let tries = 0;
    const align = () => {
      const header = pageHeader();
      if (!header) {
        // A page fills in after it mounts; hidden meanwhile, so it never shows in one place and then moves.
        if (++tries < 60) frame = requestAnimationFrame(align);
        else button.style.visibility = '';
        return;
      }
      const top = header.top + window.scrollY + header.height / 2;
      button.style.top = `${top - button.offsetHeight / 2}px`;
      button.style.visibility = '';
    };
    button.style.top = '';
    button.style.visibility = 'hidden';
    align();
    const again = () => {
      tries = 0;
      align();
    };
    window.addEventListener('resize', again);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', again);
    };
  }, [pathname]);
  return (
    <button
      ref={ref}
      type="button"
      aria-label={tr('Back')}
      data-label={tr('Back')}
      data-tip="below"
      className="tv-glass tv-menu-button tv-back"
      data-tab-root={isTabRoot(pathname) ? '' : undefined}
      onClick={onBack}
    >
      <BiChevronLeft />
    </button>
  );
}

function EdgeCapsule({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      tabIndex={-1}
      data-nav-out=""
      aria-label={tr('Menu')}
      className="tv-glass tv-edge-capsule"
      onClick={onOpen}
    >
      <i className="tv-edge-grab" />
      <BiChevronRight />
    </button>
  );
}

/** How long the page counts as gliding after an Up or Down, past its 250 ms glide. */
const GLIDING_MS = 400;
/** How long after the last arrow the sea's currents start drifting again. */
const MOVING_MS = 1500;

// On Up and Down, for TVs: `data-row-move` lifts cards at once (an eased lift re-layers the rows),
// `data-gliding` drops the glass's blur until the page settles (a TV redoes it every frame).
function useRowMoveMark() {
  React.useEffect(() => {
    if (!currentHost().tv) return;
    const html = document.documentElement;
    let settle = 0;
    let rest = 0;
    // A key listener, as the app's own move handles the arrow actions and stops there.
    const onKey = (e: KeyboardEvent) => {
      // The sea's currents hold still while the remote moves focus, leaving the TV's GPU to the move (ambient.css).
      if (e.key.startsWith('Arrow')) {
        html.setAttribute('data-moving', '');
        window.clearTimeout(rest);
        rest = window.setTimeout(
          () => html.removeAttribute('data-moving'),
          MOVING_MS
        );
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        html.setAttribute('data-row-move', '');
        // A menu or dialog moves its own list, not the page, and keeps its glass.
        if (
          document.activeElement?.closest(
            '[role=dialog], [role=menu], [role=listbox], .tv-sidebar'
          )
        )
          return;
        html.setAttribute('data-gliding', '');
        window.clearTimeout(settle);
        settle = window.setTimeout(
          () => html.removeAttribute('data-gliding'),
          GLIDING_MS
        );
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight')
        html.removeAttribute('data-row-move');
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.clearTimeout(settle);
      window.clearTimeout(rest);
      html.removeAttribute('data-row-move');
      html.removeAttribute('data-gliding');
      html.removeAttribute('data-moving');
    };
  }, []);
}

/** On a TV, Up from the player controls' top row hides them, as Back does: nothing lies above to move to. */
function usePlayerUpHides() {
  React.useEffect(() => {
    if (!currentHost().tv) return;
    const onKey = (e: KeyboardEvent) => {
      const from = e.target;
      if (
        e.key !== 'ArrowUp' ||
        !(from instanceof HTMLElement) ||
        !from.closest("[data-ui='player-controls']")
      )
        return;
      // After the app's own move, which leaves the focus where it was when nothing is above.
      window.setTimeout(() => {
        if (document.activeElement === from) runAction('back', 'Escape');
      }, 0);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
}

/**
 * The tvOS style's frame: Apple TV's sidebar instead of the app's, its own
 * home, and every other page (settings, the player…) as the app has it.
 */
export function TvosLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onHome = pathname === '/';
  const entry = useRouterState({
    select: (s) => s.location.state.__TSR_key ?? s.location.href,
  });
  // Kept per visit: going back to its entry shows it again, any other visit starts afresh.
  const [kept, setKept] = React.useState<string>();
  if (onHome && kept !== entry) setKept(entry);
  const playing = useChildMatches({
    select: (matches) => !!matches[0]?.pathname.startsWith('/play/'),
  });
  useServerEvents(playing);
  // As upstream's layout: the player is drawn here, and plays on in the mini player where the device allows it.
  const { user } = useSession();
  const playback = usePlayback();
  usePlayerLeaving();
  React.useEffect(() => closePlayback, [user.Id]);
  // Menus and dialogs open outside the page, so the whole document says the tvOS style is on.
  // Left as the setting says when the layout goes (sign-out, who's watching), so those screens keep the look.
  React.useEffect(() => {
    document.documentElement.dataset.tvosBuild = '';
    return markTvosStyle;
  }, []);
  // The sidebar, as the Apple TV app's: Back at the home (or with nowhere to go back to) opens it, Back again closes it.
  const [sidebar, setSidebar] = React.useState(false);
  const closeSidebar = React.useCallback(() => setSidebar(false), []);
  const openSidebar = React.useCallback(() => setSidebar(true), []);
  const toggleSidebar = React.useCallback(() => setSidebar((o) => !o), []);
  React.useEffect(() => setSidebar(false), [pathname, playing]);
  // Marks the page while the sidebar is open: the glass behind it goes flat on TVs (ambient.css), redone each frame otherwise.
  React.useEffect(() => {
    if (!sidebar) return;
    document.documentElement.setAttribute('data-sidebar', '');
    return () => document.documentElement.removeAttribute('data-sidebar');
  }, [sidebar]);
  const router = useRouter();
  const [under, setUnder] = React.useState<HTMLDivElement | null>(null);
  const [over, setOver] = React.useState<HTMLDivElement | null>(null);
  const pinned = React.useMemo(() => ({ under, over }), [under, over]);
  useAction(
    'back',
    () => {
      // As the app's Back: out of a field first, so typing (settings, search) isn't left by it.
      const field = document.activeElement;
      if (isTextField(field)) {
        field.blur();
        return true;
      }
      if (sidebar) {
        // At the top of the app, Back from the sidebar leaves it, as Apple TV goes to its home screen.
        const exit = onHome ? currentHost().exit : undefined;
        if (exit) exit();
        else setSidebar(false);
        return true;
      }
      if (!onHome && router.history.canGoBack()) {
        router.history.back();
        return true;
      }
      setSidebar(true);
      return true;
    },
    !playing
  );
  // Left from the leftmost thing on a page, or the pointer at the screen's left edge, opens it too.
  // Run as the app's Left action, before its own move, so focus is still where the press found it.
  // A held Left running along a row stops at the first card; only a fresh press goes on.
  const leftHeld = React.useRef(false);
  React.useEffect(() => {
    const up = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') leftHeld.current = false;
    };
    window.addEventListener('keyup', up, true);
    return () => window.removeEventListener('keyup', up, true);
  }, []);
  useAction(
    'nav.left',
    (input) => {
      const held = leftHeld.current;
      if (input === 'ArrowLeft') leftHeld.current = true;
      if (sidebar || held) return false;
      const el = document.activeElement;
      if (
        !(el instanceof HTMLElement) ||
        el.closest('.tv-sidebar, [role=menu], [role=dialog]') ||
        isTextField(el) ||
        somethingLeftOf(el)
      )
        return false;
      setSidebar(true);
      return true;
    },
    !playing
  );
  React.useEffect(() => {
    if (playing) return;
    let dwell = 0;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      if (e.clientX > 4) {
        window.clearTimeout(dwell);
        dwell = 0;
        return;
      }
      // As the Left key: only off the first cover. A row scrolled along first scrolls back to its start.
      // Whatever is stacked there counts, the edge capsule included, which sits above the rows along the edge.
      const row = document
        .elementsFromPoint(e.clientX, e.clientY)
        .map((el) => el.closest('.tv-scroller'))
        .find(Boolean);
      if (row && row.scrollLeft > 2) return;
      // Over a row, the mouse that has just scrolled it back to its start must rest a moment (a quarter of a second), or the menu would open as it arrives.
      if (!row) return setSidebar(true);
      if (dwell) return;
      dwell = window.setTimeout(() => {
        dwell = 0;
        if (row.scrollLeft <= 2) setSidebar(true);
      }, 250);
    };
    window.addEventListener('pointermove', onMove);
    return () => {
      window.clearTimeout(dwell);
      window.removeEventListener('pointermove', onMove);
    };
  }, [playing, sidebar]);
  // A server that hosts the app offers its new release to the tab left open on the old one.
  React.useEffect(
    () =>
      watchForNewPage(() =>
        toast(tr('A new version is available'), {
          id: 'new-page',
          duration: Infinity,
          action: { label: tr('Reload'), onClick: () => location.reload() },
        })
      ),
    []
  );
  // The sidebar closes when the mouse leaves it; on Right it closes itself.
  React.useEffect(() => {
    if (!sidebar) return;
    const bar = document.querySelector('.tv-sidebar');
    if (!bar) return;
    // Opened from the screen's left edge or by a button far away, the mouse is not in it yet: it counts once it is.
    let entered = false;
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const box = bar.getBoundingClientRect();
      if (e.clientX <= box.right) entered = true;
      else if (entered && e.clientX > box.right + 12) setSidebar(false);
    };
    // A click anywhere else closes it too, which covers a menu opened by its button, where the mouse never was.
    const away = (e: PointerEvent) => {
      if (
        !(e.target as Element | null)?.closest(
          '.tv-sidebar, .tv-menu-button, .tv-edge-capsule, .tv-tabbar-more'
        )
      )
        setSidebar(false);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerdown', away, true);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerdown', away, true);
    };
  }, [sidebar]);
  useRowMoveMark();
  usePlayerUpHides();
  const swipeBack = React.useCallback(() => {
    if (router.history.canGoBack()) router.history.back();
  }, [router]);
  useSwipeBack(swipeBack, !onHome && !playing && !sidebar);
  // The other pages' code fetched while idle, so a slow TV doesn't fetch it as one opens or playback starts.
  React.useEffect(() => {
    const warm = () => {
      void import('./item');
      void import('./player-info');
      void import('./screensaver');
      void import('./search');
      void import('./person');
      void import('./catalog');
      void import('./library');
      void import('./history');
      void import('./calendar');
    };
    const idle = window.requestIdleCallback
      ? window.requestIdleCallback(warm, { timeout: 5000 })
      : window.setTimeout(warm, 3000);
    return () => {
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
    };
  }, []);
  // The desktop app's Back leaves full screen before anything else, the player's too; a TV interface stays full screen.
  React.useEffect(() => {
    const host = currentHost();
    const saved = host.back;
    host.back = undefined;
    return () => {
      host.back = saved;
    };
  }, []);
  // Backspace (when not typing) and Cmd+[ go back too, as a Mac's usual keys for it.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const back =
        (e.key === 'Backspace' &&
          !e.metaKey &&
          !e.ctrlKey &&
          !isTextField(document.activeElement)) ||
        (e.key === '[' && e.metaKey);
      if (back && runAction('back', 'Escape')) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <>
      {!playing && <PagesWork pathname={pathname} playing={!!playback} />}
      <div
        data-ui="shell"
        data-tvos=""
        inert={playing}
        className={cn(playing && 'invisible [content-visibility:hidden]')}
      >
        <VersionPickerProvider>
          <RemoteTarget />
          <ReminderHost />
          <RandomPick />
          <PlaylistsHost />
          {currentHost().watchNext && <WatchNextSync />}
          <ItemMenuHost>
            {!playing && !currentHost().tv && (
              <TabBar
                pathname={pathname}
                moreOpen={sidebar}
                onMore={toggleSidebar}
              />
            )}
            {!playing && (
              <Sidebar
                open={sidebar}
                pathname={pathname}
                onClose={closeSidebar}
              />
            )}
            {/* While the sidebar is open the page underneath can't take the focus, as on Apple TV. */}
            <div inert={sidebar} className="contents">
              {/* As the app's layout: on TVs the page moves in glide layers, fixed things beside them. */}
              <MenuOpener.Provider value={openSidebar}>
                <PinnedTargets.Provider value={pinned}>
                  {!playing && <Sea />}
                  <div ref={setUnder} className="contents" />
                  {/* Drawn once the places for fixed things exist, so none starts a frame inside the moving page. */}
                  {under && over && (
                    <GlideLayers name="page">
                      {/* As the app's: home stays, hidden, under other pages, so going back shows it as it was. */}
                      {/* Each in its own boundary: a page loading must not hide and redraw the kept home. */}
                      {kept && (
                        <div
                          key={kept}
                          data-page="home"
                          inert={!onHome}
                          className={cn(
                            !onHome &&
                              'invisible absolute inset-x-0 top-0 [content-visibility:hidden]'
                          )}
                        >
                          <React.Suspense fallback={null}>
                            <PageShown.Provider value={onHome}>
                              <TvosHome />
                            </PageShown.Provider>
                          </React.Suspense>
                          {onHome && <PageScroll />}
                        </div>
                      )}
                      {!onHome && !playing && (
                        <div key={pathname} data-page={pageName(pathname)}>
                          <React.Suspense fallback={null}>
                            <TvosOutlet />
                          </React.Suspense>
                          <PageScroll />
                        </div>
                      )}
                    </GlideLayers>
                  )}
                  {over && !playing && !sidebar && (
                    <Pinned>
                      <EdgeCapsule onOpen={openSidebar} />
                      {!onHome && !currentHost().tv && (
                        <BackButton
                          pathname={pathname}
                          onBack={() =>
                            router.history.canGoBack()
                              ? router.history.back()
                              : navigate(to.home, { replace: true })
                          }
                        />
                      )}
                    </Pinned>
                  )}
                  <div ref={setOver} className="contents" />
                </PinnedTargets.Provider>
              </MenuOpener.Provider>
            </div>
          </ItemMenuHost>
        </VersionPickerProvider>
        <ConnectionNote />
      </div>
      {playing && <Outlet />}
      {playback && (
        <PlayerPage
          key={`${playback.itemId}|${playback.sourceId}|${playback.playlist ?? ''}`}
          itemId={playback.itemId}
          sourceId={playback.sourceId}
          startMs={playback.startMs}
          playlist={playback.playlist}
          mini={playback.mini}
        />
      )}
      <React.Suspense fallback={null}>
        {playing && <TvosPlayerInfo />}
        <TvosScreensaver playing={playing} />
      </React.Suspense>
      <PartyHost />
      <RemoteSheet />
    </>
  );
}
