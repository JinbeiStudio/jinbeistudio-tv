/* eslint-disable lingui/no-unlocalized-strings -- the tvOS style's words go through tr() (./i18n), which this rule doesn't know */
import React from 'react';
import { BiMenu, BiSearch } from 'react-icons/bi';
import { createPortal, flushSync } from 'react-dom';
import { currentHost } from '../../lib/hosts';
import { easeLayers, GLIDE_LAYERS } from '../../lib/input/glide';
import { formatLocale } from '../../lib/i18n';
import { useSession } from '@/lib/jellyfin/session';
import { useOwnAvatar } from '@/lib/jellyfin/history';
import { useTvosStyle } from '../../lib/tvos-style';
import {
  backdropUrl,
  landscapeUrls,
  logoUrl,
  personImageUrl,
  posterUrl,
} from '@/lib/artwork/urls';
import { itemSubtitle, itemTitle, progressOf } from '../../lib/format';
import { itemPath, navigate, to } from '../../lib/paths';
import type { BaseItemDto, BaseItemPerson } from '@/lib/jellyfin/types';
import { RowScroller, useNear, watch } from '@/hooks/use-in-view';
import { Artwork } from '@/components/media/cards';
import { CachedImage } from '../cached-image';
import { Scores, scoresOf } from '@/components/media/scores';
import { ItemMenu } from '@/components/media/item-menu';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from '@aiostreams/ui/context-menu';
import './tvos.css';
import { tr } from './i18n';

/** How long after the page opens its later parts draw anyway, once it is idle. */
const LATER_IDLE_MS = 1500;

/**
 * Draws its children once they near the screen or the page is idle, keeping their room until then.
 * Drawn as a transition, which yields to keys: drawn on a TV's first Down it held the page ~110 ms.
 */
export function Later({
  room,
  children,
}: {
  room: string;
  children: React.ReactNode;
}) {
  const [ref, near] = useNear<HTMLDivElement>('400px');
  const [shown, setShown] = React.useState(false);
  React.useEffect(() => {
    if (shown) return;
    const show = () => React.startTransition(() => setShown(true));
    if (near) return show();
    const idle = window.requestIdleCallback
      ? window.requestIdleCallback(show, { timeout: LATER_IDLE_MS * 2 })
      : window.setTimeout(show, LATER_IDLE_MS);
    return () => {
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
    };
  }, [near, shown]);
  return (
    <div ref={ref} style={shown ? undefined : { minHeight: room }}>
      {shown && children}
    </div>
  );
}

/** The time and who is signed in, at the top right, as Apple's; the sections are in the sidebar. */
/** What opens the sidebar, for the button beside the pill; the layout provides it. */
export const MenuOpener = React.createContext<(() => void) | null>(null);

// Memoised, so a page re-rendering as it scrolls doesn't redraw it.
export const TopBar = React.memo(function TopBar({
  hidden,
}: {
  hidden?: boolean;
}) {
  const openMenu = React.useContext(MenuOpener);
  const { user } = useSession();
  const avatar = useOwnAvatar();
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 20_000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <Pinned>
      <div className="tv-top" data-hidden={hidden ? '' : undefined}>
        {openMenu && (
          <button
            type="button"
            aria-label={tr('Menu')}
            data-label={tr('Menu')}
            data-tip="below"
            className="tv-glass tv-menu-button"
            onClick={openMenu}
          >
            <BiMenu />
          </button>
        )}
        <button
          type="button"
          aria-label={tr('Search')}
          data-label={tr('Search')}
          data-tip="below"
          className="tv-glass tv-menu-button"
          onClick={() => navigate(to.search())}
        >
          <BiSearch />
        </button>
        <div className="tv-glass tv-pill">
          {now.toLocaleTimeString(formatLocale(), {
            hour: '2-digit',
            minute: '2-digit',
          })}
          <span className="tv-avatar">
            {avatar ? (
              <img src={avatar} alt="" />
            ) : (
              (user.Name ?? '?').slice(0, 1)
            )}
          </span>
        </div>
      </div>
    </Pinned>
  );
});

/**
 * Where fixed things go: on TVs the page moves in transformed glide layers,
 * which would carry anything fixed inside them along with the page.
 */
export const PinnedTargets = React.createContext<{
  under: HTMLElement | null;
  over: HTMLElement | null;
}>({ under: null, over: null });

/** Renders outside the page's glide layers, below the page or above it. */
export function Pinned({
  under,
  children,
}: {
  under?: boolean;
  children: React.ReactNode;
}) {
  const targets = React.useContext(PinnedTargets);
  const target = under ? targets.under : targets.over;
  return target ? createPortal(children, target) : <>{children}</>;
}

/** Past this many cards, a row draws only those near the focus, as the app's rows do. */
const WINDOWED = 40;
/** Cards drawn past each side of the focus. */
const MARGIN = 12;
/** How near the drawn edge the focus comes before the window moves. */
const EDGE = 6;

/** Every row a mouse can scroll at its edge, with one listener for them all, so a move is measured once. */
const edgeRows = new Set<HTMLElement>();
const edge = { row: null as HTMLElement | null, speed: 0, frame: 0 };

/** Scrolls the row the mouse is at the edge of; it rests once the row can go no further. */
function edgeStep() {
  const { row, speed } = edge;
  if (!row || !speed) {
    edge.frame = 0;
    return;
  }
  const before = row.scrollLeft;
  row.scrollLeft += speed;
  edge.frame = row.scrollLeft !== before ? requestAnimationFrame(edgeStep) : 0;
}

function edgeMove(e: PointerEvent) {
  if (e.pointerType !== 'mouse') return;
  // The row under the pointer by its place on screen, as the edge capsule and other layers can sit above it.
  let row: HTMLElement | null = null;
  let box: DOMRect | null = null;
  for (const el of edgeRows) {
    // Home stays laid out, hidden and inert, under other pages: its rows would take the pointer first.
    if (el.closest('[inert]')) continue;
    const r = el.getBoundingClientRect();
    if (e.clientY >= r.top && e.clientY <= r.bottom && r.width) {
      row = el;
      box = r;
      break;
    }
  }
  if (!row || !box) {
    edge.speed = 0;
    return;
  }
  const zone = Math.max(60, box.width * 0.06);
  // Full speed over the outer 40% of the zone, so a mouse thrown at the edge runs as fast as one eased in.
  const full = zone * 0.4;
  const pace = (distance: number) =>
    distance <= full
      ? 18
      : Math.max(3, Math.ceil(((zone - distance) / (zone - full)) * 18));
  const left = e.clientX - box.left;
  const right = box.right - e.clientX;
  edge.row = row;
  edge.speed = left < zone ? -pace(left) : right < zone ? pace(right) : 0;
  if (edge.speed && !edge.frame) edge.frame = requestAnimationFrame(edgeStep);
}

const edgeStop = () => {
  edge.speed = 0;
};

// Out through the top or bottom stops it. Out through a side is the mouse reaching the screen's edge or the
// page's scrollbar, still meaning "scroll this way": it goes on, resting at the row's end.
const edgeLeave = (e: MouseEvent) => {
  if (e.clientY <= 0 || e.clientY >= window.innerHeight - 1) edgeStop();
};

function scrollAtEdge(el: HTMLElement): () => void {
  if (!edgeRows.size) {
    window.addEventListener('pointermove', edgeMove);
    document.documentElement.addEventListener('mouseleave', edgeLeave);
    window.addEventListener('blur', edgeStop);
  }
  edgeRows.add(el);
  return () => {
    edgeRows.delete(el);
    if (edge.row === el) {
      edgeStop();
      edge.row = null;
    }
    if (edgeRows.size) return;
    cancelAnimationFrame(edge.frame);
    edge.frame = 0;
    window.removeEventListener('pointermove', edgeMove);
    document.documentElement.removeEventListener('mouseleave', edgeLeave);
    window.removeEventListener('blur', edgeStop);
  };
}

/**
 * A sideways row of cards. On TVs it jumps to the focused card and eases its
 * layers there on the compositor, as the app's rows do, rather than scrolling frame by frame.
 */
export function Scroller({
  scrollRef,
  rowRef,
  start = 0,
  shape = 'poster',
  children,
}: {
  scrollRef?: React.Ref<HTMLDivElement>;
  /** The element holding the cards themselves. */
  rowRef?: React.Ref<HTMLDivElement>;
  /** The card a long row opens on, which its first drawn cards surround. */
  start?: number;
  /** The cards' shape, sizing the empty places of those not drawn before one is measured. */
  shape?: 'poster' | 'wide';
  children: React.ReactNode;
}) {
  const glide = !!currentHost().tv;
  const outer = React.useRef<HTMLDivElement>(null);
  const layer = React.useRef<HTMLDivElement>(null);
  const row = React.useRef<HTMLDivElement>(null);
  React.useImperativeHandle(scrollRef, () => outer.current!, []);
  React.useImperativeHandle(rowRef, () => (glide ? row : outer).current!, [
    glide,
  ]);
  const items = React.Children.toArray(children);
  const count = items.length;
  // As the app's long rows: only the cards around the focus are drawn, the rest hold their places empty.
  // Only on a TV, where drawing every card of a long row costs too much; a computer draws them all, so there are no empty places to jump over.
  const windowed = glide && count > WINDOWED;
  // As the app's window: around the opening card, then only growing, so cards drawn stay drawn.
  const [range, setRange] = React.useState<[number, number]>(() => [
    Math.max(0, start - MARGIN),
    start + 2 * MARGIN,
  ]);
  const [size, setSize] = React.useState<{ width: number; height: number }>();
  React.useEffect(() => {
    const first = (glide ? row : outer).current?.firstElementChild;
    if (size || !(first instanceof HTMLElement)) return;
    setSize({ width: first.offsetWidth, height: first.offsetHeight });
  }, [glide, size, count]);
  React.useEffect(() => {
    const el = outer.current;
    const cards = (glide ? row : outer).current;
    if (!windowed || !el || !cards) return;
    const near = (e: FocusEvent) => {
      const at = [...cards.children].findIndex((c) =>
        c.contains(e.target as Node)
      );
      if (at < 0) return;
      // Drawn before the next key, or a fast run of Rights reaches the empty places and the focus jumps to another row.
      flushSync(() =>
        setRange((r) =>
          (at - EDGE < r[0] && r[0] > 0) || at + EDGE > r[1]
            ? [
                Math.max(0, Math.min(r[0], at - MARGIN)),
                Math.max(r[1], at + 2 * MARGIN),
              ]
            : r
        )
      );
    };
    el.addEventListener('focusin', near);
    return () => el.removeEventListener('focusin', near);
  }, [glide, windowed]);
  const drawn = windowed
    ? items.map((child, i) =>
        i >= range[0] && i < range[1] ? (
          child
        ) : (
          <div
            key={`hold-${React.isValidElement(child) ? child.key : i}`}
            className="tv-card-hold"
            data-shape={shape}
            style={size}
            aria-hidden
          />
        )
      )
    : children;
  // As the app's rows: cards out of sight are marked so arrow moves needn't measure them.
  React.useEffect(() => {
    const el = outer.current;
    const cards = (glide ? row : outer).current?.children;
    if (!el || !cards) return;
    const stops = [...cards].map((card) =>
      watch(card, el, '0px', (entry) =>
        card.toggleAttribute('data-nav-out', !entry.isIntersecting)
      )
    );
    return () => stops.forEach((stop) => stop());
  }, [glide, count, range]);
  // The row follows the focus along its cards, on a TV by easing its layers and elsewhere by plain scrolling.
  React.useEffect(() => {
    const el = outer.current;
    const cards = (glide ? row : outer).current;
    if (!el || !cards) return;
    const pad = parseFloat(getComputedStyle(el).paddingLeft) || 0;
    const follow = (e: FocusEvent) => {
      let card = e.target as HTMLElement | null;
      while (card && card.parentElement !== cards) card = card.parentElement;
      if (!card) return;
      // On a TV the cards' offsets are the layer's; elsewhere they are measured in the scrolled content, padding included.
      const at = glide
        ? pad + card.offsetLeft
        : card.getBoundingClientRect().left -
          el.getBoundingClientRect().left +
          el.scrollLeft;
      const left = at;
      const right = left + card.offsetWidth;
      const from = el.scrollLeft;
      const max = el.scrollWidth - el.clientWidth;
      const to =
        left - pad < from
          ? left - pad
          : right + pad > from + el.clientWidth
            ? right + pad - el.clientWidth
            : from;
      const was = el.scrollLeft;
      el.scrollLeft = Math.max(0, Math.min(to, max));
      if (glide && layer.current && el.scrollLeft !== was)
        easeLayers(layer.current, 'X', el.scrollLeft - was);
    };
    el.addEventListener('focusin', follow);
    return () => el.removeEventListener('focusin', follow);
  }, [glide]);
  // A mouse resting at a row's edge scrolls it that way, as a pointer has no arrow keys to do it with.
  React.useEffect(() => {
    const el = outer.current;
    if (glide || !el) return;
    return scrollAtEdge(el);
  }, [glide]);
  // Cards' artwork measured against the row, as in the app, so those off to the side wait.
  const inside = (
    <RowScroller.Provider value={outer}>{drawn}</RowScroller.Provider>
  );
  if (!glide)
    return (
      <div ref={outer} className="tv-scroller" data-nav-row>
        {inside}
      </div>
    );
  return (
    <div ref={outer} className="tv-scroller tv-glide" data-nav-self-scroll>
      {Array.from({ length: GLIDE_LAYERS }).reduceRight<React.ReactNode>(
        (inside, _, i) => (
          <div ref={i === 0 ? layer : undefined} data-glide-layer>
            {inside}
          </div>
        ),
        <div ref={row} className="tv-scroller-row" data-nav-row>
          {inside}
        </div>
      )}
    </div>
  );
}

// A faint grain keeps the TV from drawing the gradient in bands.
const GRAIN =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.035 0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E";

/** The sea's still water, drawn once into a canvas: as a CSS background
 * a TV redrew it whole each time the hero lowered, freezing the move for ~200 ms. */
function SeaWater() {
  const ref = React.useRef<HTMLCanvasElement>(null);
  React.useEffect(() => {
    const ctx = ref.current?.getContext('2d', { alpha: false });
    if (!ctx) return;
    const { width: w, height: h } = ctx.canvas;
    // Teal water, lighter toward the surface, as jinbeistudio.com and the TV launcher.
    const water = ctx.createLinearGradient(0, 0, 0, h);
    water.addColorStop(0, '#2a7380');
    water.addColorStop(0.25, '#175560');
    water.addColorStop(0.6, '#10424c');
    water.addColorStop(1, '#082a32');
    ctx.fillStyle = water;
    ctx.fillRect(0, 0, w, h);
    const grain = new Image();
    grain.onload = () => {
      const pattern = ctx.createPattern(grain, 'repeat');
      if (!pattern) return;
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, w, h);
    };
    grain.src = GRAIN;
    return () => {
      grain.onload = null;
    };
  }, []);
  return <canvas ref={ref} className="tv-sea" width={1920} height={1080} />;
}

// The light from the surface, as the TV launcher draws it: a fan of rays from a point above the screen.
const APEX_X = 0.58;
const RAYS = { width: 2400, height: 1300 };
// SVG noise turned into pale ripples, tiled along the surface.
const CAUSTICS =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='300'%3E%3Cfilter id='c' x='0' y='0' width='100%25' height='100%25'%3E%3CfeTurbulence type='turbulence' baseFrequency='0.012 0.045' numOctaves='2' seed='7' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.8 0 0 0 0 0.97 0 0 0 0 1 0 0 0 -2.4 1.25'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23c)'/%3E%3C/svg%3E";

/** The sun's glow at the surface, drawn once at half size. */
function SeaSun() {
  const ref = React.useRef<HTMLCanvasElement>(null);
  React.useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    const { width: w, height: h } = ctx.canvas;
    const glow = ctx.createRadialGradient(
      APEX_X * w,
      -0.05 * h,
      0,
      APEX_X * w,
      -0.05 * h,
      0.4 * w
    );
    glow.addColorStop(0, 'rgba(230, 251, 255, 0.6)');
    glow.addColorStop(0.4, 'rgba(127, 220, 239, 0.18)');
    glow.addColorStop(0.75, 'rgba(127, 220, 239, 0)');
    ctx.fillStyle = glow;
    // Filled under a wide, soft-edged arc just below the top, as the Mac app's glow ends: the surface seen from beneath.
    ctx.filter = 'blur(4px)';
    ctx.beginPath();
    ctx.ellipse(
      APEX_X * w,
      0.035 * h + 0.9 * h,
      0.55 * w,
      0.9 * h,
      0,
      0,
      2 * Math.PI
    );
    ctx.fill();
  }, []);
  return <canvas ref={ref} className="tv-sea-sun" width={960} height={540} />;
}

/** A fan of soft rays, drawn once at half size; CSS only sways it. */
function SeaRays({
  alpha,
  step,
  width,
  blur,
  className,
}: {
  alpha: number;
  step: number;
  width: number;
  blur: number;
  className: string;
}) {
  const ref = React.useRef<HTMLCanvasElement>(null);
  React.useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    const ax = RAYS.width / 4,
      reach = RAYS.height;
    ctx.filter = `blur(${blur / 2}px)`;
    // Seeded, so each load draws the same fan. As real shafts: in loose clusters, mostly thin with a few broad faint
    // ones, each fading at its own depth.
    let seed = step * 7919;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let a = 30 + rand() * step; a < 150;) {
      const broad = rand() < 0.15,
        w = width * (broad ? 2.5 + rand() * 2 : 0.4 + rand() * 1.1),
        strength = (broad ? 0.5 : 0.7 + rand() * 0.5) * alpha,
        fade = 594 * (0.8 + rand() * 0.5);
      const fill = ctx.createRadialGradient(ax, 0, 0, ax, 0, fade);
      fill.addColorStop(0, `rgba(200, 245, 250, ${strength})`);
      fill.addColorStop(0.45, `rgba(200, 245, 250, ${strength * 0.4})`);
      fill.addColorStop(0.8, 'rgba(200, 245, 250, 0)');
      ctx.fillStyle = fill;
      const a0 = (a * Math.PI) / 180,
        a1 = ((a + w) * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(ax, 0);
      ctx.lineTo(ax + Math.cos(a0) * reach, Math.sin(a0) * reach);
      ctx.lineTo(ax + Math.cos(a1) * reach, Math.sin(a1) * reach);
      ctx.closePath();
      ctx.fill();
      // Close gaps inside a cluster, wide ones between them.
      a += step * (rand() < 0.35 ? 0.3 + rand() * 0.4 : 0.8 + rand() * 1.1);
    }
    ctx.globalAlpha = 1;
    // Clear above the sun's arc, so the rays start under it; the canvas top sits 108px above the screen.
    ctx.filter = 'none';
    ctx.globalCompositeOperation = 'destination-out';
    const top = ctx.createLinearGradient(0, 0, 0, 90);
    top.addColorStop(0.6, '#000');
    top.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, RAYS.width / 2, 90);
  }, [alpha, step, width, blur]);
  return (
    <canvas
      ref={ref}
      className={`tv-sea-rays ${className}`}
      width={RAYS.width / 2}
      height={RAYS.height / 2}
    />
  );
}

/** Ripples of light near the surface, fading halfway down; drawn after the page settles, as the noise is slow on a TV. */
function SeaCaustics() {
  const ref = React.useRef<HTMLCanvasElement>(null);
  React.useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    const tile = new Image();
    tile.onload = () => {
      const { width: w, height: h } = ctx.canvas;
      ctx.scale(0.5, 0.5);
      for (let y = 0; y < 2 * h; y += 300)
        for (let x = 0; x < 2 * w; x += 600) ctx.drawImage(tile, x, y);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'destination-in';
      const fade = ctx.createLinearGradient(0, 0, 0, h);
      // Clear above the sun's arc too (the canvas top sits 216px above the screen), as the rays are.
      fade.addColorStop(0.41, 'rgba(0, 0, 0, 0)');
      fade.addColorStop(0.5, '#000');
      fade.addColorStop(0.6, '#000');
      fade.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = fade;
      ctx.fillRect(0, 0, w, h);
      ref.current?.classList.add('is-drawn');
    };
    const later = window.setTimeout(() => (tile.src = CAUSTICS), 1500);
    return () => {
      window.clearTimeout(later);
      tile.onload = null;
    };
  }, []);
  return (
    <canvas ref={ref} className="tv-sea-caustics" width={1260} height={270} />
  );
}

// Marine snow rising, as the TV launcher's: per layer, a seed, flake count, size and opacity.
const SNOW = [
  [1, 140, 2, 0.6, 'tv-sea-snow-far'],
  [2, 70, 3.5, 0.65, 'tv-sea-snow-mid'],
  [3, 24, 5, 0.55, 'tv-sea-snow-near'],
] as const;

function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One layer of flakes two screens tall at half size, repeated a screen lower so its slide loops; one dot stamped per flake (a gradient each was slow on a TV). */
function SeaSnow({
  seed,
  count,
  size,
  alpha,
  className,
}: {
  seed: number;
  count: number;
  size: number;
  alpha: number;
  className: string;
}) {
  const ref = React.useRef<HTMLCanvasElement>(null);
  React.useEffect(() => {
    const g = ref.current?.getContext('2d');
    if (!g) return;
    const later = window.setTimeout(() => {
      const rand = seeded(seed);
      const r = size * 1.5 + 0.5;
      const dot = document.createElement('canvas');
      dot.width = dot.height = Math.ceil(r) * 2;
      const d = dot.getContext('2d');
      if (!d) return;
      const c = dot.width / 2;
      const fill = d.createRadialGradient(c, c, 0, c, c, r);
      fill.addColorStop(0, 'rgba(200, 245, 250, 1)');
      fill.addColorStop(0.45, 'rgba(200, 245, 250, 0.5)');
      fill.addColorStop(1, 'rgba(200, 245, 250, 0)');
      d.fillStyle = fill;
      d.fillRect(0, 0, dot.width, dot.height);
      g.scale(0.5, 0.5);
      for (let i = 0; i < count; i++) {
        const x = Math.round(rand() * 1920);
        const y = Math.round(rand() * 1080);
        g.globalAlpha = alpha * (0.4 + rand() * 0.6) * 0.6;
        g.drawImage(dot, x - c, y - c);
        g.drawImage(dot, x - c, y + 1080 - c);
      }
      ref.current?.classList.add('is-drawn');
    }, 1800);
    return () => window.clearTimeout(later);
  }, [seed, count, size, alpha]);
  return (
    <canvas
      ref={ref}
      className={`tv-sea-snow ${className}`}
      width={960}
      height={1080}
    />
  );
}

/** How deep the reader is, in screens: the sea darkens a step at a time, so a TV only fades one layer now and then. */
function useDepth(ref: React.RefObject<HTMLDivElement | null>) {
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      const depth = String(
        Math.min(3, Math.floor(window.scrollY / window.innerHeight))
      );
      if (el.dataset.depth !== depth) el.dataset.depth = depth;
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [ref]);
}

// Set by the layout while the player fills the screen, so the TV stops compositing a sea nobody sees.
let seaHidden = false;
const seaListeners = new Set<() => void>();
export function useHideSea(hide: boolean) {
  React.useEffect(() => {
    const set = (value: boolean) => {
      seaHidden = value;
      seaListeners.forEach((l) => l());
    };
    set(hide);
    return () => set(false);
  }, [hide]);
}

/** Jinbei's sea, mounted once at the app's root (app.tsx) under every screen of the tvOS style: sign-in, loading, who's watching and each page. */
export function Sea() {
  const tvos = useTvosStyle();
  const hidden = React.useSyncExternalStore(
    (l) => {
      seaListeners.add(l);
      return () => seaListeners.delete(l);
    },
    () => seaHidden
  );
  return tvos && !hidden ? <SeaLayer /> : null;
}

/** Drawn once, only its light sways and drifts. */
function SeaLayer() {
  const ref = React.useRef<HTMLDivElement>(null);
  useDepth(ref);
  return (
    <div ref={ref} className="tv-sea-layer" aria-hidden>
      <SeaWater />
      <SeaSun />
      <SeaRays
        alpha={0.1}
        step={2.6}
        width={1.1}
        blur={5}
        className="tv-sea-rays-a"
      />
      <SeaRays
        alpha={0.07}
        step={4}
        width={1.5}
        blur={8}
        className="tv-sea-rays-b"
      />
      <SeaCaustics />
      {SNOW.map(([seed, count, size, alpha, className]) => (
        <SeaSnow
          key={seed}
          seed={seed}
          count={count}
          size={size}
          alpha={alpha}
          className={className}
        />
      ))}
      {/* Over the light, so going deeper dims it too. */}
      <div className="tv-sea-abyss" />
    </div>
  );
}

/** The artwork behind a page; `lowered` fades it out to the plain background. */
export function Backdrop({
  item,
  lowered,
  waiting,
  onReady,
  ambient,
}: {
  item: BaseItemDto | undefined;
  lowered: boolean;
  /** Lowered, shows Jinbei's ambient background instead of the blurred artwork. */
  ambient?: boolean;
  /** Kept hidden while the page loads. */
  waiting?: boolean;
  /** Told once the artwork has loaded, failed, or there is none. */
  onReady?: () => void;
}) {
  const { client } = useSession();
  const url = item && backdropUrl(client, item, { maxWidth: 1920 });
  const none = !!item && !url;
  React.useEffect(() => {
    if (none) onReady?.();
  }, [none, onReady]);
  // Marks the page while artwork covers the sea (ambient.css): the currents rest, the glass keeps its blur.
  const art = !!ambient && !lowered && !waiting && !!url;
  React.useEffect(() => {
    if (!art) return;
    document.documentElement.setAttribute('data-art', '');
    return () => document.documentElement.removeAttribute('data-art');
  }, [art]);
  // The app's saved-image cache, so artwork seen before shows at once.
  return (
    <Pinned under>
      <div
        className="tv-backdrop"
        data-lowered={lowered ? '' : undefined}
        data-waiting={waiting ? '' : undefined}
        data-ambient={ambient ? '' : undefined}
      >
        <Layers url={url ?? undefined} onReady={onReady} />
        {item && currentHost().tv && !ambient && (
          <BlurredCopy
            src={backdropUrl(client, item, { maxWidth: 480 })}
            active={lowered}
          />
        )}
      </div>
    </Pinned>
  );
}

/**
 * As the app's hero: the next artwork loads and decodes under the one showing,
 * then fades in over it, rather than the page going blank between them.
 */
function Layers({
  url,
  onReady,
}: {
  url: string | undefined;
  onReady?: () => void;
}) {
  const [layers, setLayers] = React.useState<
    { url: string; shown: boolean; faded?: boolean }[]
  >([]);
  if (url && layers[layers.length - 1]?.url !== url)
    // The newest one fully in stays under the new one; any still loading or fading is dropped.
    setLayers((l) => [
      ...l.filter((x) => x.faded).slice(-1),
      { url, shown: false },
    ]);
  // Faded in after its 0.6s transition, by the clock rather than transitionend, which a hidden page never sends.
  const fadedIn = (done: string) =>
    setLayers((l) => {
      const at = l.findIndex((x) => x.url === done);
      if (at < 0) return l;
      return [{ ...l[at]!, faded: true }, ...l.slice(at + 1)];
    });
  const show = (shown: string) => {
    onReady?.();
    setLayers((l) =>
      l.map((x) => (x.url === shown ? { ...x, shown: true } : x))
    );
    window.setTimeout(() => fadedIn(shown), 650);
  };

  return (
    <>
      {layers.map((layer) => (
        <CachedImage
          key={layer.url}
          className="tv-backdrop-layer"
          data-shown={layer.shown ? '' : undefined}
          src={layer.url}
          alt=""
          onLoad={(e) => {
            const u = layer.url;
            void e.currentTarget
              .decode()
              .catch(() => undefined)
              .then(() => show(u));
          }}
          onError={() => {
            onReady?.();
            setLayers((l) => l.filter((x) => x.url !== layer.url));
          }}
        />
      ))}
    </>
  );
}

/**
 * The artwork blurred once into a small canvas, for TVs: lowering the page then
 * only fades it in, where a live blur over the whole screen stutters.
 */
function BlurredCopy({ src, active }: { src: string | null; active: boolean }) {
  const ref = React.useRef<HTMLCanvasElement>(null);
  // Drawn only once lowered, and once per artwork, rather than for each hero turn nobody sees blurred.
  const drawn = React.useRef<string | null>(null);
  React.useEffect(() => {
    const canvas = ref.current;
    if (!src || !canvas || !active || drawn.current === src) return;
    const image = new Image();
    image.onload = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      drawn.current = src;
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);
      ctx.filter = 'blur(12px) saturate(1.5) brightness(0.45)';
      // Drawn past the edges, so the blur doesn't fade them to black.
      const over = 0.12;
      const scale =
        Math.max(width / image.width, height / image.height) * (1 + over);
      const w = image.width * scale;
      const h = image.height * scale;
      ctx.drawImage(image, (width - w) / 2, (height - h) / 2, w, h);
      // The backdrop's shade (.tv-backdrop::after), drawn in so the copy alone covers the screen.
      ctx.filter = 'none';
      const across = ctx.createLinearGradient(0, 0, width, 0);
      across.addColorStop(0, 'rgba(0, 0, 0, 0.6)');
      across.addColorStop(0.45, 'rgba(0, 0, 0, 0.15)');
      across.addColorStop(0.7, 'rgba(0, 0, 0, 0)');
      const down = ctx.createLinearGradient(0, 0, 0, height);
      down.addColorStop(0, 'rgba(0, 0, 0, 0.3)');
      down.addColorStop(0.25, 'rgba(0, 0, 0, 0)');
      down.addColorStop(0.55, 'rgba(0, 0, 0, 0)');
      down.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
      for (const shade of [across, down]) {
        ctx.fillStyle = shade;
        ctx.fillRect(0, 0, width, height);
      }
    };
    image.src = src;
    return () => {
      image.onload = null;
    };
  }, [src, active]);
  return (
    <canvas ref={ref} className="tv-backdrop-blur" width={480} height={270} />
  );
}

export function Logo({ item }: { item: BaseItemDto }) {
  const { client } = useSession();
  const url = logoUrl(client, item, { maxWidth: 480 });
  // Tied to the URL, so a logo that failed doesn't hide the next title's.
  const [failed, setFailed] = React.useState<string | null>(null);
  return url && failed !== url ? (
    <CachedImage
      key={url}
      className="tv-logo"
      src={url}
      alt={itemTitle(item)}
      onError={() => setFailed(url)}
    />
  ) : (
    <div className="tv-title">{itemTitle(item)}</div>
  );
}

/** The details line as Apple's: kind, genres and year, each source's score, then the rating in a frame. */
export function Meta({ item, max }: { item: BaseItemDto; max?: number }) {
  const parts: string[] = [];
  if (item.Type === 'Series') parts.push(tr('TV Show'));
  else if (item.Type === 'Movie') parts.push(tr('Movie'));
  parts.push(...(item.Genres ?? []).slice(0, 2));
  if (item.ProductionYear) parts.push(String(item.ProductionYear));
  if (item.Type === 'Movie' && item.RunTimeTicks) {
    const minutes = Math.round(item.RunTimeTicks / 600_000_000);
    parts.push(
      minutes >= 60
        ? `${Math.floor(minutes / 60)}h ${minutes % 60}m`
        : `${minutes}m`
    );
  }
  const scored = scoresOf(item).length > 0;
  return (
    <div className="tv-meta">
      {parts.join(' · ')}
      {scored && (
        <>
          {parts.length > 0 && ' · '}
          <Scores item={item} max={max} />
        </>
      )}
      {item.OfficialRating && (
        <span className="tv-rating">{item.OfficialRating}</span>
      )}
    </div>
  );
}

/** Genre, year, length, rating and score, as one line. */
export function metaLine(item: BaseItemDto): string {
  const parts: string[] = [];
  if (item.Genres?.[0]) parts.push(item.Genres[0]);
  if (item.ProductionYear) parts.push(String(item.ProductionYear));
  if (item.Type === 'Movie' && item.RunTimeTicks) {
    const minutes = Math.round(item.RunTimeTicks / 600_000_000);
    parts.push(
      minutes >= 60
        ? `${Math.floor(minutes / 60)}h ${minutes % 60}m`
        : `${minutes}m`
    );
  }
  if (item.OfficialRating) parts.push(item.OfficialRating);
  if (item.CommunityRating) parts.push(`★ ${item.CommunityRating.toFixed(1)}`);
  return parts.join(' · ');
}

/** Tells whether focus sits inside an element, for pages that change as focus moves down. */
export function useFocusWithin<T extends HTMLElement>(): [
  React.RefObject<T | null>,
  boolean,
] {
  const ref = React.useRef<T>(null);
  return [ref, useFocusInside(ref)];
}

/** Whether focus sits inside the element another component holds the ref of. */
export function useFocusInside(
  ref: React.RefObject<HTMLElement | null>
): boolean {
  const [inside, setInside] = React.useState(false);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setInside(el.contains(document.activeElement));
    const later = () => window.setTimeout(update, 0);
    el.addEventListener('focusin', update);
    el.addEventListener('focusout', later);
    return () => {
      el.removeEventListener('focusin', update);
      el.removeEventListener('focusout', later);
    };
  }, [ref]);
  return inside;
}

/** Whether the page has been scrolled down past its top, by any means (wheel, trackpad, keys). */
export function useScrolledDown(enabled = true): boolean {
  const [down, setDown] = React.useState(false);
  React.useEffect(() => {
    if (!enabled) return;
    const update = () => setDown(window.scrollY > window.innerHeight * 0.2);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, [enabled]);
  return down;
}

// Whether the screensaver shows, so what animates under it (the hero) can hold still.
const saver = { on: false, subs: new Set<() => void>() };
export function setSaverOn(on: boolean): void {
  if (saver.on === on) return;
  saver.on = on;
  saver.subs.forEach((notify) => notify());
}
export function useSaverOn(): boolean {
  return React.useSyncExternalStore(
    (notify) => {
      saver.subs.add(notify);
      return () => saver.subs.delete(notify);
    },
    () => saver.on
  );
}

export function Row({
  title,
  tag,
  shape,
  children,
}: {
  title: string;
  /** A small label after the title, such as what kind of catalog it is. */
  tag?: string;
  shape?: 'poster' | 'wide';
  children: React.ReactNode;
}) {
  return (
    <section className="tv-row" data-nav-group data-nav-box data-nav-resume>
      <h2>
        {title}
        {tag && (
          <span className="tv-tag" data-tag={tag.toLowerCase()}>
            {tr(tag)}
          </span>
        )}
      </h2>
      <Scroller shape={shape}>{children}</Scroller>
    </section>
  );
}

/** How long a card breathes at most while its picture loads: one with none to load stops. */
const ART_WAIT_MS = 8000;

/** A card's artwork tile: a slow breath of light (styles: .tv-art[data-loading]) until its picture has loaded. */
export function ArtTile({ children }: { children?: React.ReactNode }) {
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    if (!loading) return;
    const stop = window.setTimeout(() => setLoading(false), ART_WAIT_MS);
    return () => window.clearTimeout(stop);
  }, [loading]);
  const done = () => setLoading(false);
  return (
    <div
      className="tv-art"
      data-loading={loading ? '' : undefined}
      onLoadCapture={done}
      onErrorCapture={done}
    >
      {children}
    </div>
  );
}

/** Told which title a card's focus rests on, for a page whose artwork follows it (the hero setting's "follows"). */
export const FollowCard = React.createContext<
  ((item: BaseItemDto) => void) | null
>(null);

/** Opens the title's page unless told otherwise; kept from redrawing as its row grows. */
export const PosterCard = React.memo(function PosterCard({
  item,
  onClick,
}: {
  item: BaseItemDto;
  onClick?: () => void;
}) {
  const follow = React.useContext(FollowCard);
  const { client } = useSession();
  return (
    <ItemMenu item={item}>
      <button
        type="button"
        className="tv-card tv-poster"
        onFocus={follow ? () => follow(item) : undefined}
        data-focus="own"
        onClick={onClick ?? (() => navigate(itemPath(item)))}
      >
        <ArtTile>
          {/* The app's own artwork: sized to the card, decoded off the main thread, loaded near the screen. */}
          <Artwork
            src={(width) => posterUrl(client, item, { maxWidth: width })}
            alt=""
          />
          {item.UserData?.Played && (
            <span className="tv-watched" aria-label={tr('Watched')}>
              ✓
            </span>
          )}
        </ArtTile>
        <span className="tv-caption">{itemTitle(item)}</span>
      </button>
    </ItemMenu>
  );
});

/** A wide card with its title, subtitle and progress on the artwork. */
export function WideCard({
  item,
  subtitle,
  description,
  menu,
  onClick,
}: {
  item: BaseItemDto;
  subtitle?: string;
  /** A line of summary on the artwork, as tvOS 26's Continue Watching cards have. */
  description?: string | null;
  /** Its own menu (held Select), in place of the title's usual one. */
  menu?: React.ReactNode;
  onClick: () => void;
}) {
  const follow = React.useContext(FollowCard);
  const { client } = useSession();
  const progress = progressOf(item);
  const below = subtitle ?? itemSubtitle(item);
  const card = (
    <button
      type="button"
      className="tv-card tv-wide"
      onFocus={follow ? () => follow(item) : undefined}
      data-focus="own"
      onClick={onClick}
    >
      <ArtTile>
        <Artwork
          src={(width) => landscapeUrls(client, item, { maxWidth: width })}
          alt=""
        />
        <div className="tv-overlay">
          <strong>{itemTitle(item)}</strong>
          {below && <span>{below}</span>}
          {description && <em className="tv-card-text">{description}</em>}
          {progress != null && progress > 0 && (
            <div className="tv-progress">
              <i style={{ width: `${Math.min(progress, 1) * 100}%` }} />
            </div>
          )}
        </div>
      </ArtTile>
    </button>
  );
  return menu ? (
    <ContextMenu>
      <ContextMenuTrigger asChild>{card}</ContextMenuTrigger>
      <ContextMenuContent>{menu}</ContextMenuContent>
    </ContextMenu>
  ) : (
    <ItemMenu item={item}>{card}</ItemMenu>
  );
}

export function PersonCard({ person }: { person: BaseItemPerson }) {
  const { client } = useSession();
  const url = personImageUrl(client, person);
  const initials = (person.Name ?? '')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('');
  return (
    <button
      type="button"
      className="tv-card tv-person"
      data-focus="own"
      onClick={() => person.Id && navigate(to.person(person.Id))}
    >
      <div className="tv-art">
        {initials}
        {url && <img src={url} alt="" loading="lazy" />}
      </div>
      <strong>{person.Name}</strong>
      <span>{person.Role || person.Type}</span>
    </button>
  );
}

/** A request that failed, in place of what it would have shown, with a way to ask again. */
export function Failed({ what, retry }: { what: string; retry?: () => void }) {
  return (
    <div className="tv-failed" role="alert">
      <strong>{what}</strong>
      <span>{tr('Check the connection to your server, then try again.')}</span>
      {retry && (
        <button
          type="button"
          className="tv-glass tv-button"
          autoFocus
          onClick={retry}
        >
          {tr('Try again')}
        </button>
      )}
    </div>
  );
}

/** tvOS's activity indicator: spokes fading round a circle. */
export function Spinner({
  size = '3vw',
  className,
}: {
  size?: string;
  className?: string;
}) {
  // The same drawing and pace as every other loader in this style (--tv-activity).
  return (
    <div
      className={className ? `tv-spinner ${className}` : 'tv-spinner'}
      style={{ width: size, height: size }}
      role="status"
      aria-label={tr('Loading')}
    />
  );
}

/** The last card of a row, opening the whole catalog in the app's own page for it. */
export function SeeAll({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="tv-card tv-poster tv-see-all"
      data-focus="own"
      onClick={onClick}
    >
      <div className="tv-art">
        <span>{tr('See all')}</span>
      </div>
    </button>
  );
}
