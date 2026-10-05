// Area-aware ambient mix. All handles are created before the audio context starts;
// the browser's first user gesture still controls when sound can begin.
export const PLACES = ['bazaar', 'chowk', 'station', 'crossing', 'promenade'];

export function placeAt(x, z) {
  if (z <= -74) return 'promenade';
  if (z <= -26) return x < -6.5 && z > -55 ? 'crossing' : 'station';
  if (z <= 1.5) return 'chowk';
  return 'bazaar';
}

const MIX = {
  bazaar:    { wind: 0.18, birds: 0.10, town: 0.38, bazaarBed: 1 },
  chowk:     { wind: 0.28, birds: 0.30, town: 0.14, chowkBed: 1 },
  station:   { wind: 0.12, birds: 0.04, town: 0.07, stationBed: 1 },
  crossing:  { wind: 0.24, birds: 0.06, town: 0.25, crossingBed: 1 },
  promenade: { wind: 0.54, birds: 0.72, town: 0.03, promenadeBed: 1 },
};

export function createSoundscape(audio) {
  const names = ['wind', 'birds', 'town', ...PLACES.map((p) => `${p}Bed`)];
  const handles = Object.fromEntries(names.map((name) => [name, audio.loop(name, { volume: 0 })]));
  const levels = Object.fromEntries(names.map((name) => [name, 0]));
  let place = null;
  return {
    get place() { return place; },
    get levels() { return { ...levels }; },
    update(position, dt = 0) {
      if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.z)) return;
      const next = placeAt(position.x, position.z);
      if (next !== place) place = next;
      // About 1.5 s to settle; a teleport also fades rather than cutting in mid-note.
      const alpha = Math.min(1, Math.max(0, 1 - Math.exp(-Math.max(0, dt) / 0.48)));
      for (const name of names) {
        const target = MIX[place][name] || 0;
        const value = levels[name] + (target - levels[name]) * alpha;
        if (Math.abs(value - levels[name]) < 0.002 && Math.abs(target - levels[name]) < 0.002) continue;
        levels[name] = Math.abs(target - value) < 0.003 ? target : value;
        handles[name].setVolume(levels[name], 0.12);
      }
    },
    stop() { for (const handle of Object.values(handles)) handle.stop(); },
  };
}
