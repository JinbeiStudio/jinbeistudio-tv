/* eslint-disable lingui/no-unlocalized-strings -- the tvOS style's words go through tr() (./i18n), which this rule doesn't know */
import { i18n } from '@lingui/core';

/*
 * The tvOS style's own words, in the language chosen in the app's settings.
 * Kept here rather than in the app's catalogs, which every update regenerates.
 * A missing translation shows the English.
 */
const FR: Record<string, string> = {
  // Add a profile
  'Add your profile': 'Ajouter votre profil',
  'Type the address you were given to open your profile.':
    'Saisissez l’adresse reçue pour ouvrir votre profil.',
  'Profile address': 'Adresse du profil',
  // Sidebar and pages
  Home: 'Accueil',
  Menu: 'Menu',
  More: 'Plus',
  Back: 'Retour',
  'A new version is available': 'Une nouvelle version est disponible',
  Reload: 'Recharger',
  Discover: 'Découvrir',
  Search: 'Rechercher',
  Library: 'Bibliothèque',
  'Live TV': 'TV en direct',
  Channels: 'Chaînes',
  Calendar: 'Calendrier',
  History: 'Historique',
  Settings: 'Réglages',
  Playlists: 'Playlists',
  'Watch party': 'Séance partagée',
  'Watch together': 'Regarder ensemble',
  Downloads: 'Téléchargements',
  // Home
  'Continue watching': 'Continuer',
  'Next up': 'Épisode suivant',
  Upcoming: 'Bientôt disponible',
  'See all': 'Tout voir',
  'No catalogs: add some in your AIOStreams configuration.':
    'Aucun catalogue : ajoutez-en dans votre configuration AIOStreams.',
  '{time} left': 'Reste {time}',
  // Kinds and tags
  All: 'Tout',
  Movies: 'Films',
  Shows: 'Séries',
  Series: 'Séries',
  Anime: 'Anime',
  Movie: 'Film',
  'TV Show': 'Série',
  Unwatched: 'Non vus',
  '{n} title': '{n} titre',
  '{n} titles': '{n} titres',
  // Buttons
  Play: 'Lecture',
  Resume: 'Continuer',
  Versions: 'Versions',
  Details: 'Détails',
  Next: 'Suivant',
  Trailer: 'Bande-annonce',
  'Stop trailer': 'Arrêter la bande-annonce',
  'Add to favourites': 'Ajouter aux favoris',
  'Remove from favourites': 'Retirer des favoris',
  Favourite: 'Favori',
  'Play from the start': 'Lire depuis le début',
  'Play from beginning': 'Lire depuis le début',
  'Mark watched': 'Marquer comme vu',
  'Mark unwatched': 'Marquer comme non vu',
  'Marked unwatched': 'Marqué comme non vu',
  'Random episode': 'Épisode au hasard',
  'Play on another device': 'Lire sur un autre appareil',
  'Add to playlist': 'Ajouter à une playlist',
  'Resume following': 'Suivre à nouveau',
  'Drop show': 'Abandonner la série',
  Watched: 'Vu',
  Info: 'Infos',
  'Try again': 'Réessayer',
  Remove: 'Retirer',
  'Clear all': 'Tout effacer',
  Open: 'Ouvrir',
  Loading: 'Chargement',
  // Detail page
  'In this collection': 'Dans cette collection',
  'Cast & Crew': 'Distribution et équipe',
  Related: 'Similaires',
  About: 'À propos',
  Genres: 'Genres',
  Released: 'Sortie',
  'First aired': 'Première diffusion',
  Studios: 'Studios',
  Airs: 'Diffusion',
  Country: 'Pays',
  Rated: 'Classification',
  Score: 'Note',
  'Episode {n}': 'Épisode {n}',
  'Airs {when}': 'Diffusé {when}',
  // Errors and empty pages
  'Check the connection to your server, then try again.':
    'Vérifiez la connexion à votre serveur, puis réessayez.',
  "This title didn't load": "Ce titre n'a pas pu être chargé",
  "This person didn't load": "Cette personne n'a pas pu être chargée",
  "This catalog didn't load": "Ce catalogue n'a pas pu être chargé",
  "Your favourites didn't load": "Vos favoris n'ont pas pu être chargés",
  "Your history didn't load": "Votre historique n'a pas pu être chargé",
  'Nothing in your favourites yet: add a title with ♡ on its page.':
    'Aucun favori pour le moment : ajoutez un titre avec ♡ sur sa page.',
  'Nothing watched yet': 'Rien de regardé pour le moment',
  "This server can't list what you've watched.":
    'Ce serveur ne peut pas lister ce que vous avez regardé.',
  // History
  Today: "Aujourd'hui",
  Yesterday: 'Hier',
  Earlier: 'Plus tôt',
  Everyone: 'Tout le monde',
  'Now playing': 'En cours de lecture',
  Paused: 'En pause',
  'Removed from history': "Retiré de l'historique",
  'Remove from history': "Retirer de l'historique",
  '{n} movie': '{n} film',
  '{n} movies': '{n} films',
  '{n} episode': '{n} épisode',
  '{n} episodes': '{n} épisodes',
  '{n} in progress': '{n} en cours',
  '{n} favourite': '{n} favori',
  '{n} favourites': '{n} favoris',
  // Person
  'Born {date}': 'Né(e) le {date}',
  'Died {date}': 'Décédé(e) le {date}',
  // Search
  People: 'Personnes',
  Results: 'Résultats',
  Recent: 'Récentes',
  'Listening…': 'Écoute…',
  'Movies, shows and people': 'Films, séries et personnes',
  'No results for “{term}”': 'Aucun résultat pour « {term} »',
  // Theme setting
  Interface: 'Interface',
  "Apple TV's look, or the app's own pages. Kept on this device.":
    "L'apparence de l'Apple TV, ou les pages de l'app. Gardé sur cet appareil.",
};

/*
 * Catalog names. The server sends the catalogs' own names ("Trakt Trending"); the key is that name as a slug
 * ("trakt-trending"), and the table gives the words shown in English and in French. A catalog that is not
 * listed shows the server's name. Movies, shows and anime share the same words; the tag next to the name says which is which.
 */
const CATALOGS: Record<string, [string, string]> = {
  'latest-digital-release': ['New releases', 'Nouveautés'],
  'trakt-trending': ['Trending', 'Tendances'],
  'tmdb-popular': ['Popular', 'Populaires'],
  'latest-airing': ['New releases', 'Nouveautés'],
  'crunchyroll-latest': ['New releases', 'Nouveautés'],
  'anilist-trending': ['Trending', 'Tendances'],
  seasonal: ['Seasonal', 'De saison'],
  'tmdb-by-year': ['By year', 'Par année'],
  'tmdb-by-language': ['By language', 'Par langue'],
  'tvdb-genres': ['By genre', 'Par genre'],
  'tvdb-collections': ['Collections', 'Sagas et collections'],
  'trending-kids': ['For kids', 'Pour les enfants'],
  'mal-airing-now': ['New episodes', 'Nouveaux épisodes'],
  'anidb-latest-ended': ['Recently finished', 'Récemment terminés'],
  'mal-top-series': ['Best series', 'Meilleures séries'],
  'mal-top-movies': ['Best movies', 'Meilleurs films'],
  'mal-top-all-time': ['Best of all time', 'Les meilleurs de tous les temps'],
  'mal-genres': ['By genre', 'Par genre'],
  'netflix-latest': ['New on Netflix', 'Nouveautés Netflix'],
  'amazon-prime-latest': ['New on Prime Video', 'Nouveautés Prime Video'],
  'apple-plus-latest': ['New on Apple TV+', 'Nouveautés Apple TV+'],
  'disney-plus-latest': ['New on Disney+', 'Nouveautés Disney+'],
  'paramount-plus-latest': ['New on Paramount+', 'Nouveautés Paramount+'],
  'hbo-max-latest': ['New on HBO Max', 'Nouveautés HBO Max'],
  'hulu-latest': ['New on Hulu', 'Nouveautés Hulu'],
  action: ['Action', 'Action'],
  animated: ['Animation', 'Animation'],
  comedy: ['Comedy', 'Comédie'],
  crime: ['Crime', 'Policier'],
  drama: ['Drama', 'Drame'],
  horror: ['Horror', 'Horreur'],
  'sci-fi': ['Sci-fi', 'Science-fiction'],
  thriller: ['Thriller', 'Thriller'],
  'top-documentaries': ['Documentaries', 'Documentaires'],
  'history-and-war': ['History & war', 'Histoire et guerre'],
  'must-see-modern-horror': ['Modern horror to see', 'Horreur moderne à voir'],
  'must-see-mindfuck': ['Mind-bending', 'Qui retournent le cerveau'],
  'top-nature': ['Nature', 'Nature'],
  'top-reality-tv': ['Reality TV', 'Télé-réalité'],
  'top-standup-comedy': ['Comedy stand-up', 'Comédie stand-up'],
  'for-you': ['For you', 'Pour vous'],
};

/** "Apple+  Latest" -> "apple-plus-latest". */
function catalogKey(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\+/g, ' plus ')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/*
 * The catalogs' own ids, which the server's views carry in their Path
 * (`/aiostreams/movie/4a9e3b0.mdblist.87667`): they stay the same whatever a catalog is renamed to.
 */
const IDS: Record<string, string> = {
  'mdblist.86934': 'latest-digital-release',
  'mdblist.87667': 'trakt-trending',
  'mdblist.88434': 'trakt-trending',
  'tmdb.top': 'tmdb-popular',
  'mdblist.86710': 'latest-airing',
  'streaming.cru': 'crunchyroll-latest',
  'anilist.trending': 'anilist-trending',
  'mdblist.136620': 'seasonal',
  'tmdb.year': 'tmdb-by-year',
  'tmdb.language': 'tmdb-by-language',
  'tvdb.genres': 'tvdb-genres',
  'tvdb.collections': 'tvdb-collections',
  'mdblist.88307': 'trending-kids',
  'mdblist.88309': 'trending-kids',
  'mal.airing': 'mal-airing-now',
  'custom.org_stremio_animecatalogs.anime.anidb_latest_ended':
    'anidb-latest-ended',
  'mal.top_series': 'mal-top-series',
  'mal.top_movies': 'mal-top-movies',
  'mal.top_anime': 'mal-top-all-time',
  'mal.genres': 'mal-genres',
  'mdblist.86751': 'netflix-latest',
  'mdblist.88328': 'netflix-latest',
  'mdblist.86753': 'amazon-prime-latest',
  'mdblist.86755': 'amazon-prime-latest',
  'mdblist.88319': 'apple-plus-latest',
  'mdblist.88317': 'apple-plus-latest',
  'mdblist.86758': 'disney-plus-latest',
  'mdblist.86759': 'disney-plus-latest',
  'mdblist.86761': 'paramount-plus-latest',
  'mdblist.86762': 'paramount-plus-latest',
  'mdblist.89649': 'hbo-max-latest',
  'mdblist.89647': 'hbo-max-latest',
  'mdblist.88327': 'hulu-latest',
  'mdblist.88326': 'hulu-latest',
  'mdblist.91213': 'action',
  'mdblist.91211': 'action',
  'mdblist.116038': 'animated',
  'mdblist.116037': 'animated',
  'mdblist.91224': 'comedy',
  'mdblist.91223': 'comedy',
  'mdblist.3126': 'crime',
  'mdblist.3108': 'crime',
  'mdblist.91297': 'drama',
  'mdblist.91296': 'drama',
  'mdblist.91217': 'horror',
  'mdblist.91215': 'horror',
  'mdblist.91221': 'sci-fi',
  'mdblist.91220': 'sci-fi',
  'mdblist.91894': 'thriller',
  'mdblist.91893': 'thriller',
  'mdblist.84403': 'top-documentaries',
  'mdblist.84677': 'top-documentaries',
  'mdblist.8043': 'history-and-war',
  'mdblist.102554': 'must-see-modern-horror',
  'mdblist.3892': 'must-see-mindfuck',
  'mdblist.84487': 'top-nature',
  'mdblist.84401': 'top-reality-tv',
  'mdblist.83497': 'top-standup-comedy',
  'recommendations.movies': 'for-you',
  'recommendations.series': 'for-you',
  'recommendations.anime': 'for-you',
  'custom.com_jinbeistudio_foryou.movie.movies': 'for-you',
  'custom.com_jinbeistudio_foryou.series.series': 'for-you',
  'custom.com_jinbeistudio_foryou.anime.anime': 'for-you',
};

interface CatalogView {
  Name?: string | null;
  Path?: string | null;
}

/**
 * The catalog's own id from the view's Path, as sent and without the ending the server adds (`_movie`, `_series`,
 * `_anime`): both are tried, since some real ids end the same way (`mal.top_series`).
 */
function catalogIds(view: CatalogView): string[] {
  const found = /^\/aiostreams\/(?:movie|series|anime)\/[0-9a-f]+\.(.+)$/.exec(
    view.Path ?? ''
  );
  if (!found) return [];
  return [found[1], found[1].replace(/_(?:movie|series|anime)$/, '')];
}

/** The "For you" rows: AIOMetadata's own, or ours picked by Claude (custom catalogs from the for-you addon). */
export function isForYouCatalog(view: CatalogView): boolean {
  return catalogIds(view).some(
    (id) =>
      id.startsWith('recommendations.') ||
      id.startsWith('custom.com_jinbeistudio_foryou.')
  );
}

/** Whether the server says this catalog is anime, by its path or its id, whatever it is called. */
export function isAnimeCatalog(view: CatalogView): boolean {
  if (view.Path?.startsWith('/aiostreams/anime/')) return true;
  return catalogIds(view).some((id) =>
    /^(?:anilist|mal|kitsu)\.|^streaming\.cru$|anime/.test(id)
  );
}

/**
 * What AIOStreams lists itself (the debrid services' files, Real-Debrid and TorBox), as opposed to the catalogs
 * of the metadata addon, whose paths name a kind (`/aiostreams/movie/…`). A server that is not AIOStreams, or a
 * view without a path, is always shown.
 */
export function isServiceLibrary(view: CatalogView): boolean {
  const path = view.Path ?? '';
  return (
    path.startsWith('/aiostreams/') &&
    !/^\/aiostreams\/(?:movie|series|anime)\//.test(path)
  );
}

/** The "– Films" / "– Séries" a server's names may end with, so other apps can tell two lists apart; this one has its tag. */
const KIND_SUFFIX =
  /\s+[–-]\s+(?:Films?|Séries?|Series|Movies?|Shows?|Anime)$/i;

/** The kind a server's name ends with ("– Films", "– Séries"), for a view that does not say it otherwise. */
export function nameKind(
  name: string | null | undefined
): 'Movies' | 'Series' | 'Anime' | undefined {
  const found = KIND_SUFFIX.exec(name ?? '');
  if (!found) return undefined;
  if (/anime/i.test(found[0])) return 'Anime';
  return /film|movie/i.test(found[0]) ? 'Movies' : 'Series';
}

function plainName(name: string): string {
  return name.replace(KIND_SUFFIX, '');
}

function catalogKeyOf(view: CatalogView): string {
  const byId = catalogIds(view)
    .map((id) => IDS[id])
    .find(Boolean);
  return byId || (view.Name ? catalogKey(plainName(view.Name)) : '');
}

/** Which catalog a view is, whether it lists movies or shows: the same for both, whatever the server calls them. */
export function catalogGroup(view: CatalogView): string {
  return catalogKeyOf(view);
}

/** A catalog's name in the app's language: by its id first, then its name, else the server's own without its ending. */
export function catalogName(view: CatalogView): string {
  const name = view.Name ?? '';
  const key = catalogKeyOf(view);
  const entry = key ? CATALOGS[key] : undefined;
  if (!entry) return plainName(name);
  return (i18n.locale ?? '').split('-')[0] === 'fr' ? entry[1] : entry[0];
}

/** `text` in the chosen language, with `{name}` filled from `vars`. */
export function tr(
  text: string,
  vars?: Record<string, string | number>
): string {
  const language = (i18n.locale ?? '').split('-')[0];
  let out = (language === 'fr' && FR[text]) || text;
  if (vars)
    for (const [name, value] of Object.entries(vars))
      out = out.replaceAll(`{${name}}`, String(value));
  return out;
}

/** A count's words, singular or plural: `count(3, '{n} movie', '{n} movies')`. */
export function count(n: number, one: string, other: string): string {
  return tr(n === 1 ? one : other, { n });
}
