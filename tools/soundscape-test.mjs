import assert from 'node:assert/strict';
import { createSoundscape, placeAt } from '../src/core/soundscape.js';

const views = [
  ['bazaar', 1.6, 34],
  ['chowk', 9.5, -9],
  ['station', 20, -37.6],
  ['crossing', -12.8, -31.5],
  ['promenade', -20, -92.8],
];
const handles = new Map();
const audio = {
  loop(name, { volume }) {
    assert.equal(volume, 0);
    const handle = { name, volume, stopped: false, setVolume(v) { this.volume = v; }, stop() { this.stopped = true; } };
    handles.set(name, handle);
    return handle;
  },
};
const soundscape = createSoundscape(audio);
for (const [place, x, z] of views) {
  assert.equal(placeAt(x, z), place);
  soundscape.update({ x, z }, 5);
  assert.equal(soundscape.place, place);
  assert.ok(handles.get(`${place}Bed`).volume > 0.99, `${place} bed should be active`);
  for (const [other] of views) if (other !== place) {
    assert.ok(handles.get(`${other}Bed`).volume < 0.01, `${other} bed should fade out in ${place}`);
  }
}
const prev = soundscape.levels.promenadeBed;
soundscape.update({ x: 1.6, z: 34 }, 0.1);
assert.ok(soundscape.levels.promenadeBed < prev && soundscape.levels.promenadeBed > 0, 'a move should crossfade');
soundscape.stop();
assert.ok([...handles.values()].every((handle) => handle.stopped));
console.log('Five locations route to distinct soundscapes and crossfade correctly.');
