import test from 'node:test';
import assert from 'node:assert/strict';

import { PRESETS, findPresetById } from '../src/simulation/presets.js';

test('presets are unique and usable', () => {
  const ids = PRESETS.map((preset) => preset.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(PRESETS.every((preset) => preset.reynolds > 0));
  assert.equal(findPresetById('unknown-id').id, PRESETS[1].id);
});
