/* eslint-disable lingui/no-unlocalized-strings -- the tvOS style's words go through tr() (./i18n), which this rule doesn't know */
import { CalendarPage } from '@/app/calendar/page';
import { TopBar } from './parts';

/**
 * The app's own calendar (a month of day squares, the episodes inside them),
 * restyled for the tvOS style so its improvements keep coming.
 */
export function TvosCalendar({ month }: { month?: string }) {
  return (
    <div className="tv-page tv-calendar">
      <TopBar />
      <CalendarPage month={month} />
    </div>
  );
}
