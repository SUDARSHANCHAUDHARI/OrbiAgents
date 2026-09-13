import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createOfficeRoom } from '../theme/room.mjs';

const source = readFileSync(new URL('../src/renderer/src/scene/office/OfficeFloor.tsx', import.meta.url), 'utf8');
const { entries } = JSON.parse(readFileSync(new URL('../art/manifest.json', import.meta.url), 'utf8'));

test('briefing beacon follows its semantic anchor and animates all original frames', () => {
  assert.match(source, /gidAt\('furniture-above', theme\.anchors\.briefing\.x/);
  assert.match(source, /Array\.from\(\{ length: 3 \}/);
  assert.match(source, /new AnimatedSprite\(briefingFrames\)/);
  assert.match(source, /ambientTextures\.push\(\.\.\.briefingFrames\)/);
  assert.doesNotMatch(source, /briefingBeacon\.position\.set\(40|briefingBeacon\.position\.set\([^\n]*6/);

  const { map, briefingBeacon } = createOfficeRoom(entries);
  const above = map.layers.find(layer => layer.name === 'furniture-above').data;
  const gid = above[briefingBeacon.y * map.width + briefingBeacon.x];
  assert.equal(gid, 70);
  const sheet = map.tilesets.find(candidate => gid >= candidate.firstgid
    && gid < candidate.firstgid + candidate.tilecount);
  assert.equal(sheet.image, 'orbi-original-room');
  assert.ok(gid + briefingBeacon.frames - 1 < sheet.firstgid + sheet.tilecount);
});
