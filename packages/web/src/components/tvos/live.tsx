import { LiveTvPage } from '../../pages/live-tv';
import { TopBar } from './parts';

/**
 * The app's own Live TV (channels, the guide, the playing channel's window),
 * restyled for the tvOS style so its improvements keep coming.
 */
export function TvosLive({ group, view }: { group?: string; view?: string }) {
  return (
    <div className="tv-page tv-live">
      <TopBar />
      <LiveTvPage group={group} view={view} />
    </div>
  );
}
