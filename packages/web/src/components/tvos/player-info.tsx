/* eslint-disable lingui/no-unlocalized-strings -- the tvOS style's words go through tr() (./i18n), which this rule doesn't know */
import React from 'react';
import { createPortal } from 'react-dom';
import { BiInfoCircle, BiRevision } from 'react-icons/bi';
import { useRouterState } from '@tanstack/react-router';
import { Modal } from '@aiostreams/ui/modal';
import { runAction } from '../../lib/input';
import { useItem } from '@/lib/jellyfin/queries';
import { itemTitle } from '../../lib/format';
import { navigate, to } from '../../lib/paths';
import { ControlButton } from '@/features/player/buttons';
import { metaLine } from './parts';
import { tr } from './i18n';

/**
 * The Info tab Apple's player shows under its bar: the title's summary and a
 * way to start again. Opened with its button (shown with the controls), the
 * remote's Down from the progress bar, or the I key.
 */
/**
 * The remote's OK plays or pauses when no control has the focus, showing the
 * controls too, as Apple TV's click does. On release, since holding it speeds up instead.
 */
function useClickPauses() {
  React.useEffect(() => {
    let down: { at: number; hidden: boolean } | null = null;
    const onDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.repeat) return;
      const focused = document.activeElement;
      down = {
        at: e.timeStamp,
        // With no control focused (the bar's Play is hidden on TVs), OK is for the video itself;
        // not when it is for something showing over it, as Skip intro.
        hidden:
          !focused?.closest('[data-ui="player-controls"]') &&
          !focused?.closest(
            '[data-ui="skip-segment"], [data-ui="next-episode-card"], [role="dialog"]'
          ) &&
          !document.querySelector(
            '[data-ui="skip-segment"][data-visible] button'
          ),
      };
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || !down) return;
      const press = down;
      down = null;
      if (press.hidden && e.timeStamp - press.at < 500)
        runAction('player.playPause', 'Enter');
    };
    window.addEventListener('keydown', onDown, true);
    window.addEventListener('keyup', onUp, true);
    return () => {
      window.removeEventListener('keydown', onDown, true);
      window.removeEventListener('keyup', onUp, true);
    };
  }, []);
}

/**
 * Up from the bar to its buttons and Down back, on TVs, where the arrows are the
 * player's "show the controls" keys and the app goes to its Play button, hidden in this style.
 */
function useBarArrows() {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      const bar = document.querySelector<HTMLElement>('[data-ui="seek-bar"]');
      const row = document.querySelector(
        '[data-ui="player-bottom-bar"] > div:last-child'
      );
      if (!bar || !row || !bar.closest('[data-visible]')) return;
      const focused = document.activeElement;
      // Nothing focused is the bar too: the arrows then skip, as the bar does.
      const onBar =
        focused === bar ||
        !focused ||
        focused === document.body ||
        !focused.closest('[data-ui="player-controls"], [role="dialog"]');
      if (e.key === 'ArrowUp' && onBar) {
        const first = [
          ...row.querySelectorAll<HTMLElement>('[data-ui="player-button"]'),
        ].find((b) => b.getClientRects().length);
        first?.focus({ focusVisible: true } as FocusOptions);
      } else if (e.key === 'ArrowDown' && focused && row.contains(focused)) {
        bar.focus({ focusVisible: true } as FocusOptions);
        // This Down only reaches the bar; Info opens on the next one.
        e.stopImmediatePropagation();
      }
    };
    // After the app's own handling of the key, which finds nothing to focus.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
}

export function PlayerInfo() {
  useClickPauses();
  useBarArrows();
  const location = useRouterState({ select: (s) => s.location });
  const match = /^\/play\/([^/]+)$/.exec(location.pathname);
  const itemId = match?.[1] === 'trailer' ? undefined : match?.[1];
  const source = (location.search as { source?: string }).source;
  return itemId ? <Info key={itemId} itemId={itemId} source={source} /> : null;
}

/** The player's row of buttons, which the controls mount and unmount as they please. */
function useButtonRow(): Element | null {
  const [row, setRow] = React.useState<Element | null>(null);
  React.useEffect(() => {
    const find = () =>
      setRow(
        document.querySelector('[data-ui="player-bottom-bar"] > div:last-child')
      );
    find();
    // Looked up as the controls can show (a key, the pointer), not on a timer through playback.
    const soon = () => window.requestAnimationFrame(find);
    window.addEventListener('keydown', soon, true);
    window.addEventListener('pointermove', soon, { passive: true });
    return () => {
      window.removeEventListener('keydown', soon, true);
      window.removeEventListener('pointermove', soon);
    };
  }, []);
  return row;
}

function Info({ itemId, source }: { itemId: string; source?: string }) {
  const item = useItem(itemId);
  const [open, setOpen] = React.useState(false);
  const row = useButtonRow();

  React.useEffect(() => {
    // Where the focus was before this key, as the app's own move has already run when it arrives here.
    let before: Element | null = document.activeElement;
    const settle = () => {
      before = document.activeElement;
    };
    const onKey = (e: KeyboardEvent) => {
      // The bar, or nothing focused with the controls up, where the arrows work the bar.
      const onBar =
        !!before?.closest('[data-ui="seek-bar"]') ||
        ((!before || before === document.body) &&
          !!document.querySelector(
            '[data-ui="player-controls"][data-visible]'
          ));
      if (e.key === 'i' || (e.key === 'ArrowDown' && onBar)) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', settle, true);
    window.addEventListener('pointerup', settle, true);
    return () => {
      window.removeEventListener('pointerup', settle, true);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keyup', settle, true);
    };
  }, [itemId]);

  if (!item.data) return null;
  const data = item.data;
  return (
    <>
      {/* The last of the player's own buttons, on the right. */}
      {row &&
        createPortal(
          <ControlButton
            name="info"
            label={tr('Info')}
            onClick={() => setOpen(true)}
          >
            <BiInfoCircle />
          </ControlButton>,
          row
        )}
      <Modal
        data-ui="dialog"
        data-name="player-info"
        open={open}
        onOpenChange={setOpen}
        title={itemTitle(data)}
        description={metaLine(data)}
      >
        <div className="tv-player-info">
          {data.Overview && <p>{data.Overview}</p>}
          {source && (
            <button
              type="button"
              className="tv-glass tv-button"
              autoFocus
              onClick={() => {
                setOpen(false);
                navigate(to.play(itemId, source, 0), { replace: true });
              }}
            >
              <BiRevision /> {tr('Play from beginning')}
            </button>
          )}
        </div>
      </Modal>
    </>
  );
}
