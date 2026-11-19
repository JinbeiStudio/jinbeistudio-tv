import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { appLog } from '@/lib/hosts/shell/bridge';
import { usePlaybackInfoOptions } from '@/lib/jellyfin/playback-info';
import { playOn, usePlayback } from '@/lib/playback/session';
import { playableSources } from '@/lib/playback/sources';
import { tr } from './i18n';

/** How long a version may take to show its first frame. */
const START_MS = 15_000;
/** Versions tried in all, the first one included. */
const MOST = 3;

const onPlayerPage = () => /^#\/play\/(?!trailer\/)/.test(window.location.hash);
const video = () =>
  document.querySelector<HTMLVideoElement>('video[data-ui="video"]');
// The player fades its video in once it starts, the WebGPU engine's canvas included.
const started = () => {
  const v = video();
  return !!v && !v.classList.contains('opacity-0');
};
const failed = () => !!document.querySelector('[data-ui="player-error"]');

/**
 * A version that never starts (its debrid server unreachable, say) hands over to the
 * next one, from the same point; upstream's player only does this for live channels.
 * Players drawn by the apps (mpv) have no page video, so they're left alone.
 */
export function VersionFallback() {
  const playback = usePlayback();
  const queryClient = useQueryClient();
  const infoOptions = usePlaybackInfoOptions();
  const tried = React.useRef<{ itemId: string; ids: Set<string> } | null>(
    null
  );
  const itemId = playback?.itemId;
  const sourceId = playback?.sourceId;
  const active = !!playback && !playback.mini;

  React.useEffect(() => {
    if (!active || !itemId || !playback) return;
    if (tried.current?.itemId !== itemId)
      tried.current = { itemId, ids: new Set() };
    const ids = tried.current.ids;
    let shownAt = 0;
    let done = false;
    const moveOn = async () => {
      done = true;
      const versions = playableSources(
        await queryClient.fetchQuery(infoOptions(itemId)).catch(() => undefined)
      );
      const at = Math.max(
        0,
        versions.findIndex((v) => v.Id === sourceId)
      );
      const current = versions[at];
      if (!current || current.IsInfiniteStream || !onPlayerPage()) return;
      ids.add(current.Id!);
      if (ids.size >= MOST) return;
      const next = versions.slice(at + 1).find((v) => !ids.has(v.Id!));
      if (!next) return;
      appLog(
        'info',
        `player: version ${at + 1} of ${versions.length} never started, trying the next`
      );
      toast(tr('This version didn’t start, trying the next one'));
      const { startMs, playlist } = playback;
      playOn({ itemId, sourceId: next.Id!, startMs, playlist });
    };
    const timer = window.setInterval(() => {
      if (done || !onPlayerPage()) return;
      if (started()) {
        done = true;
        return;
      }
      if (!video()) return;
      shownAt ||= Date.now();
      if (failed() || Date.now() - shownAt > START_MS) void moveOn();
    }, 500);
    return () => {
      done = true;
      window.clearInterval(timer);
    };
    // Keyed on the version, not the object, which changes as the player docks or grows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, itemId, sourceId]);
  return null;
}
