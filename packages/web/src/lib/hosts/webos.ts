import type { Host } from '.';
import { youTubeId } from '../playback/trailers';

interface WebOSSystem {
  deviceInfo?: string;
  platformBack?(): void;
  setWindowProperty?(name: string, value: string): void;
}

declare global {
  interface Window {
    webOSSystem?: WebOSSystem;
    PalmSystem?: WebOSSystem;
  }
}

// PalmSystem is its older name, kept for compatibility without a promise.
const system = () => window.webOSSystem ?? window.PalmSystem;

function device(): { name: string } {
  try {
    const { modelName } = JSON.parse(system()?.deviceInfo ?? '{}') as {
      modelName?: string;
    };
    if (modelName) return { name: `LG ${modelName}` };
  } catch {}
  // eslint-disable-next-line lingui/no-unlocalized-strings -- how the server lists the device
  return { name: 'LG TV' };
}

/** Starts another app through the system's launcher; false when it isn't there. */
function launch(id: string, params: Record<string, unknown>): Promise<boolean> {
  return new Promise((resolve) => {
    const Bridge = window.PalmServiceBridge;
    if (!Bridge) return resolve(false);
    const bridge = new Bridge();
    bridge.onservicecallback = (message) => {
      try {
        resolve(
          (JSON.parse(message) as { returnValue?: boolean }).returnValue !==
            false
        );
      } catch {
        resolve(false);
      }
    };
    bridge.call(
      'luna://com.webos.applicationManager/launch',
      JSON.stringify({ id, params })
    );
  });
}

// The page's web view has no way back once it leaves for another site: open the TV's own apps instead.
async function openExternal(url: string): Promise<boolean> {
  const id = youTubeId(url);
  if (id && (await launch('youtube.leanback.v4', { contentTarget: `v=${id}` })))
    return true;
  return launch('com.webos.app.browser', { target: url });
}

const host: Host = {
  name: 'webos',
  openExternal,
  tv: true,
  device,
  exit: () => system()?.platformBack?.(),
  keepAwake: (on) =>
    system()?.setWindowProperty?.('blockScreenSaver', String(on)),
};

/** LG's TVs, running the packaged app. */
export function webosHost(): Host | null {
  return system() ? host : null;
}
