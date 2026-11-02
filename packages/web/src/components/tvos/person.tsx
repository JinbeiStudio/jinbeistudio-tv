/* eslint-disable lingui/no-unlocalized-strings -- the tvOS style's words go through tr() (./i18n), which this rule doesn't know */
import React from 'react';
import { useItem, usePersonItems } from '../../lib/queries';
import { useSession } from '../../lib/session';
import { posterUrl } from '../../lib/images';
import { ExternalLinks } from '../external-links';
import { PosterGrid } from './grid';
import { Failed, Spinner, TopBar } from './parts';
import { tr } from './i18n';

const KINDS = [
  { label: 'All', types: 'Movie,Series' },
  { label: 'Movies', types: 'Movie' },
  { label: 'Shows', types: 'Series' },
];

/** A person as tvOS shows one: their photo and story, then their work, newest first. */
export function TvosPerson({ personId }: { personId: string }) {
  const { client } = useSession();
  const personQuery = useItem(personId);
  const person = personQuery.data;
  const [types, setTypes] = React.useState(KINDS[0]!.types);
  const pages = usePersonItems(personId, types);
  const items = pages.data?.pages.flatMap((p) => p.Items ?? []) ?? [];
  const photo = person && posterUrl(client, person, { maxWidth: 400 });
  const born = person?.PremiereDate
    ? new Date(person.PremiereDate).toLocaleDateString([], {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;
  const died = person?.EndDate
    ? new Date(person.EndDate).toLocaleDateString([], {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;
  const place = person?.ProductionLocations?.[0];
  return (
    <div className="tv-page tv-list-page">
      <TopBar />
      {personQuery.isError && !person ? (
        <Failed
          what={tr("This person didn't load")}
          retry={() => void personQuery.refetch()}
        />
      ) : !person ? (
        <div className="tv-loading">
          <Spinner />
        </div>
      ) : (
        <div className="tv-person-head">
          <div className="tv-person-photo">
            {photo && <img src={photo} alt="" />}
          </div>
          <div className="tv-person-text">
            <h1 className="tv-page-title tv-flush">{person.Name}</h1>
            {(born || place) && (
              <div className="tv-meta">
                {[
                  born && tr('Born {date}', { date: born }),
                  place,
                  died && tr('Died {date}', { date: died }),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            )}
            {person.Overview && (
              <p className="tv-person-bio">{person.Overview}</p>
            )}
            {!!person.ExternalUrls?.length && (
              <div className="tv-links tv-app-action tv-flush">
                <ExternalLinks links={person.ExternalUrls} />
              </div>
            )}
          </div>
        </div>
      )}
      <div className="tv-tabs">
        {KINDS.map((k) => (
          <button
            key={k.label}
            type="button"
            className="tv-tab"
            data-on={k.types === types ? '' : undefined}
            onClick={() => setTypes(k.types)}
          >
            {tr(k.label)}
          </button>
        ))}
      </div>
      <PosterGrid
        items={items}
        loading={pages.isLoading || pages.isFetchingNextPage}
        more={() =>
          pages.hasNextPage &&
          !pages.isFetchingNextPage &&
          void pages.fetchNextPage()
        }
      />
    </div>
  );
}
