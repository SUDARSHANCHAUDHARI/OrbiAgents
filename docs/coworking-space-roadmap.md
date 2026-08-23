# OrbiAgents Coworking Space Roadmap

## Implemented foundation

The core visual transformation is implemented with original OrbiAgents code and assets:

- shared planning, focus, collaboration, and lounge zone definitions
- runtime-state-driven agent placement and walking between zones
- distinct thinking/reading, coding/testing/debugging, approval-waiting, and completion feedback
- active pair-work links and mailbox delivery animation
- live and replay-aware zone occupancy in the web dashboard
- shared zone placement and occupancy language in the VS Code webview
- responsive labels and reduced-motion behavior

The analytics and customization ideas below remain optional product extensions, not prerequisites for the coworking environment to reflect real workflow activity.

## Goal

Shift OrbiAgents from a pixel "office dashboard" into a more casual, modern coworking space where agents feel like workers sharing a creative environment instead of sitting in a rigid corporate grid.

The direction should preserve:

- real-time agent observability
- clear state readability
- replay/session/workflow product features
- the pixel aesthetic

The direction should improve:

- warmth
- casual atmosphere
- variety in the environment
- social/interactive feeling
- visual identity that is distinct from a plain office sim

## Product Direction

### What the space should feel like

- coffee-shop + studio + cowork hybrid
- more relaxed than a cubicle office
- creative and collaborative
- still readable as a serious developer tool

### Core visual themes

- shared tables instead of only isolated desks
- lounge corners
- whiteboards / planning walls
- plants, shelves, books, side tables
- small cafe-style zones
- warm ambient lighting mixed with clean dark product chrome

## Phase 1: Space Re-theme

Focus: replace the "plain office" feel with a coworking identity.

### Layout changes

- convert the current right-side auxiliary zones into clearer coworking areas:
  - collaboration zone
  - lounge zone
  - focus zone
- reduce empty floor area
- create more room types with visible purpose

### Furniture additions

- shared long tables
- round cafe tables
- stools / lounge chairs
- bookshelves
- whiteboards
- side tables
- more plant variety
- divider shelves / partial partitions

### Immediate success criteria

- every visible zone has a clear purpose
- the map no longer feels like "agents on empty floor"
- the space feels casual, not corporate

## Phase 2: Agent Life Systems

Focus: make agents feel like occupants of a coworking space.

### Behavior upgrades

- pair-working states
- coffee-break / idle wandering behavior
- temporary gathering around shared tables
- move to whiteboard/planning zone when thinking
- return to focus desks when coding

### Visual signals

- speech bubbles for waiting / approval needed
- subtle "pairing" links between collaborating agents
- task-type specific micro-animation:
  - thinking -> whiteboard/planning effect
  - coding -> screen activity
  - done -> relaxed glow or completion marker

### Immediate success criteria

- agents use the space, not just occupy it
- at least 3 different space zones influence where an agent appears

## Phase 3: Coworking Product Features

Focus: turn the environment into a product surface, not just scenery.

### UX additions

- zone labels and contextual overlays
- seating / zone assignment controls
- "team mode" or "project room" presets
- workflow-aware placement:
  - planners near whiteboards
  - coders at focus desks
  - reviewers in collaboration areas

### Session / analytics tie-ins

- per-zone activity heatmap
- per-agent occupancy timeline
- visual cluster of agents used during a workflow

### Immediate success criteria

- the space communicates workflow structure
- session replay shows where collaboration happened

## Phase 4: Extension / Platform Alignment

Focus: keep the coworking-space concept aligned across the web app and extension.

### Integration ideas

- extension webview shares the same coworking visual language
- reusable space/layout data model across `web` and `extension`
- same agent-state visuals across both surfaces

### Immediate success criteria

- no major style mismatch between dashboard and extension
- shared rendering/layout concepts live in one reusable layer

## Implemented Build Order

1. ✅ Re-theme map into coworking zones
2. ✅ Expand furniture catalog for casual/shared spaces
3. ✅ Add zone-aware agent placement
4. ✅ Add state-driven zone movement
5. ✅ Add waiting / approval / pair-work indicators
6. ✅ Add live and replay-aware zone occupancy

## Repo / Architecture Fit

The current repo is a good base for this direction.

### What already fits well

- `web/`:
  Next.js app is a strong place for the main control dashboard and coworking-space UI.

- `server/`:
  Express + WebSocket is enough for live agent/runtime orchestration and replay/session APIs.

- `shared/`:
  this is the right place for map, sprite, tile, and renderer concepts that should be reused.

- `extension/`:
  good long-term place to mirror the coworking-space experience inside VS Code.

### What should evolve next

- move more space logic into a dedicated shared domain
  - suggested future area: `shared/office/` or `shared/world/`

- split current mixed layout logic into clearer units
  - placement
  - camera/framing
  - decor generation
  - zone definitions

- keep product UI concerns inside `web/components/`
- keep simulation/world concerns in `shared/`

## Suggested Future Folder Direction

This is a future cleanup direction, not a required refactor right now.

```text
shared/
  world/
    zones.ts
    layout.ts
    camera.ts
    furniture.ts
    sprites/
    renderer.ts
```

That would make the coworking-space layer easier to grow without mixing it too tightly with page-level UI code.

## Definition of "Matched Vision"

OrbiAgents will feel like a real coworking-space product when:

- the map has purposeful casual zones
- agents visibly use those zones
- collaboration is legible in-world
- the space feels alive even when no panel is open
- the dashboard and the world feel like one product, not two disconnected surfaces
