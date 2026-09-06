// Short, original break-room dialogue for the OrbiAgents floor.
import type { OfficeCharacterName } from './cast';

export type BreakSpot = 'coffee' | 'vending' | 'snack' | 'table';
type Exchange = readonly string[];

const pick = <T,>(items: readonly T[], seed: number): T =>
  items[((seed % items.length) + items.length) % items.length];

const SPOT_LINES: Record<BreakSpot, readonly string[]> = {
  coffee: ['recharging before the next task', 'coffee acquired. focus restored.', 'one more sip, then ship it', 'checking the queue over coffee'],
  vending: ['deploying snack protocol', 'the machine accepted my request', 'quick fuel stop', 'optimizing for crunch'],
  snack: ['small break, clear head', 'saving some for the next shift', 'task paused. snack resumed.', 'a tiny reward for a green build'],
  table: ['reviewing the handoff notes', 'quiet minute before standup', 'the command deck is calm today', 'mapping the next orbit']
};

const WORKER_LINES: Partial<Record<OfficeCharacterName, readonly string[]>> = {
  michael: ['crew status: caffeinated', 'keeping the orbit stable'],
  jim: ['review queue is looking good', 'one clean diff at a time'],
  pam: ['updating the command board', 'the floor map needs one more detail'],
  dwight: ['systems nominal', 'protocol check complete'],
  kevin: ['fewer words. clearer tasks.', 'snack first. merge second.'],
  angela: ['the task board is finally tidy', 'labels exist for a reason'],
  oscar: ['the estimate now includes reality', 'numbers checked twice'],
  stanley: ['focus mode means focus mode', 'calendar says break'],
  phyllis: ['handoff notes are ready', 'made room for the next worker'],
  andy: ['release notes drafted', 'warming up for the demo'],
  kelly: ['message queue has news', 'I read every update'],
  ryan: ['testing a faster workflow', 'the prototype has potential'],
  toby: ['approval policy looks clear', 'documenting the edge case'],
  creed: ['found an unclaimed task', 'the cache knows things'],
  meredith: ['end-of-day checklist started', 'shipping before the window closes']
};

const EXCHANGES: readonly Exchange[] = [
  ['is the build green?', 'green and packaged.', 'beautiful.'],
  ['need a review?', 'already reading it.', 'perfect timing.'],
  ['what is next?', 'the smallest useful task.', 'good answer.'],
  ['did the tests pass?', 'all focused checks.', 'then let’s ship.'],
  ['any blockers?', 'none that survived the logs.', 'excellent.'],
  ['who owns the handoff?', 'I do.', 'I’ll update the board.'],
  ['coffee or context?', 'both.', 'correct.'],
  ['the diff is smaller.', 'and easier to trust.', 'exactly.'],
  ['ready for another orbit?', 'after this break.', 'deal.'],
  ['did you save the notes?', 'source of truth updated.', 'nice.'],
  ['one task at a time?', 'one verified outcome at a time.', 'even better.'],
  ['quiet floor today.', 'everyone is focused.', 'let them cook.']
];

export function pickSoloLine(character: OfficeCharacterName, spot: BreakSpot, seed: number): string {
  const workerLines = WORKER_LINES[character];
  if (workerLines && seed % 5 < 3) return pick(workerLines, Math.floor(seed / 5));
  return pick(SPOT_LINES[spot], seed);
}

export function pickExchange(_speaker: OfficeCharacterName, seed: number): Exchange {
  return pick(EXCHANGES, seed);
}
