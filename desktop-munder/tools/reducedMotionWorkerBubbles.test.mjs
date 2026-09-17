import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const character = readFileSync(new URL('../src/renderer/src/scene/office/Character.ts', import.meta.url), 'utf8');
const thought = readFileSync(new URL('../src/renderer/src/scene/office/ThoughtBubble.ts', import.meta.url), 'utf8');
const tool = readFileSync(new URL('../src/renderer/src/scene/office/ToolBubble.ts', import.meta.url), 'utf8');

for (const [name, source, redraw] of [
  ['thought', thought, 'this.redraw();'],
  ['tool', tool, 'this.redrawBg();'],
]) {
  test(`${name} bubbles receive the live reduced-motion reader`, () => {
    assert.match(source, /constructor\(prefersReducedMotion: \(\) => boolean = \(\) => false\)/);
    assert.match(source, /this\.prefersReducedMotion = prefersReducedMotion/);
  });

  test(`${name} bubbles skip fades and freeze thinking dots under reduced motion`, () => {
    assert.match(source, /this\.label\.text = this\.prefersReducedMotion\(\) \? '\.\.\.' : '\.'/);
    assert.match(source, /if \(this\.prefersReducedMotion\(\)\) \{\s*this\.state = 'visible';[\s\S]*?this\.container\.alpha = 1;/);
    assert.match(source, /if \(reducedMotion && this\.isThinking && this\.label\.text !== '\.\.\.'\)/);
    assert.ok(source.includes(redraw));
    assert.match(source, /case 'fading-out': \{\s*if \(reducedMotion\) \{\s*this\.hide\(\)/);
  });
}

test('existing characters pass the scene-owned motion preference into thought bubbles', () => {
  assert.match(character, /this\.thoughtBubble = new ThoughtBubble\(this\.prefersReducedMotion\)/);
});
