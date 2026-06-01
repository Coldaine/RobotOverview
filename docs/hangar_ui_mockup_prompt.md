# Prompt: Mock Up the "Hangar" UI

## Your goal
Produce a high-fidelity, navigable mockup of a personal application called the Hangar: a fleet-and-base-management hub, styled like the hangar or loadout screen of a base-builder game, for managing someone's collection of physical tech and hobby gear. This is a design exploration. I want to see and feel the interface. A working backend and real data are out of scope; mock everything.

## Your freedom (read this first)
Choose whatever tools, framework, and approach you are most fluent in. The tech stack is entirely your call; do not ask me to pick one, and do not optimize for production-readiness. Optimize for visual fidelity and for demonstrating the core interactions, even where some are faked with placeholder state. If showing more than one art direction would help me choose, do that; otherwise commit to one strong direction and execute it well.

## The concept
The core loop is the one players know from base-builder and fleet games: acquire parts, upgrade or unlock units, and deploy units on missions. The user returns to the Hangar, their collection sits in themed bays, buying parts levels units up or unlocks new capabilities, and missions pull units off the rack for a job. It is part inventory, part wiki, part wishlist, and part toy. It should feel like something you want to open, not a chore tracker.

## Art direction
Aim for a dark engineering HUD meets game hangar: a command-center mood, beveled or paneled surfaces, monospace for specs and numbers, one restrained instrument accent color (something like amber or cyan), subtle ambient rim lighting, a faint blueprint grid or scanline texture. The explicit anti-goal is the generic SaaS dashboard or Notion-style database look. Commit to a distinctive, opinionated visual identity. Units should read like collectible unit cards, missions like contracts, the store like a quartermaster's bay.

## Screens and states to mock
1. Hangar hub (landing): the themed bays, each holding its unit cards; overall status at a glance; an activity ticker.
2. Unit detail: open a unit into a detail view built around a schematic or portrait of the device, with its specs, status, loadout slots, upgrade path, and links to related missions and insights. For the flagship unit (a tracked rover) lean into an exploded schematic with clickable subsystem hotspots if you can.
3. Mission view and "mission lens": a mission has an objective, a requisitioned set of units, a required loadout, a parts wishlist, a status, and an after-action log. Selecting a mission should visibly spotlight the units it pulls in and surface live constraint gauges for that loadout (see interactions).
4. Quartermaster / wishlist: the want-list store, parts shown with a price and a source toggle (domestic distributor versus overseas import), and a status of owned, on-order, or watching; a running total.
5. Tech tree / capability map: a node graph showing which purchases unlock which capabilities.
6. Codex / wiki: searchable, taggable insight cards (notes and lessons learned), filterable by bay, unit, or mission.

## Interactions to demonstrate (the parts that make it cool)
- Mission lens: choosing a mission dims the hangar and highlights the involved units, drawing the loadout.
- Live constraint gauges: as a loadout is assembled, show gauges for total power draw against a budget, total mass against a payload limit, and total cost; a gauge should turn red and flag when a budget is exceeded.
- Incompatibility flags: the UI surfaces warnings for invalid combinations (for example, a peripheral that needs more power than the chosen host can supply).
- Unit status badges: operational, needs attention, blocked on a part, in mission, wishlist.
- Source toggle: flipping a part between domestic and import shows a price delta and a risk badge.
- Tech-tree preview: hovering or selecting a not-yet-owned part previews the capability it would unlock.
- Activity ticker: a small feed of recent events (acquired, price drop, shipped).

## Sample content to populate the mockup (so it is not lorem ipsum)
Bays and representative units:
- Robotics Bay: a Waveshare UGV Beast tracked rover with a 4-DOF arm (the flagship unit); empty slots for future rovers and drones.
- Compute Core: a Threadripper workstation with an RTX 5090, a Raspberry Pi 5, an edge-AI module on the want-list, and a high-end pro GPU that was researched but not owned.
- Network Ops: a UniFi UDM Pro Max, WiFi 7 in-wall and outdoor access points, PTZ cameras, and 10G switching.
- Home Systems: a Home Assistant hub with a Thread border router, a smart thermostat, pool automation, irrigation control, whole-home energy monitoring, and a large OLED TV.
- Audio Lab: an open-back planar headset, and a wishlist of higher-end planar headphones.

Flagship mission, "Mission: Undercroft": the objective is to haul Ethernet cable ends through a large crawlspace by remote-piloting the rover; the requisitioned unit is the rover; the required loadout adds lighting and an off-board compute link; the constraint checks are power and payload; the wishlist includes a crawler LED light bar; the status is Planning. Show one or two future missions as placeholders (for example "Perimeter mapping" and "Pool deck patrol").

A few example insight cards for the codex: "offset lights from the camera lens to avoid dust backscatter when piloting in the crawlspace"; "the rover's depth camera computes depth onboard, so the host can stream it without a GPU"; "the long-range LiDAR option is LiDAR-only and adds a real calibration burden." Tag each by bay, unit, and mission.

A few example wishlist items, each with a domestic price and an import price, plus a "coming in the next few months" flag on one or two future-release parts.

## The information model (a hint, not a prescription)
Underneath, treat everything as a "unit" record (id, name, class or bay, status, specs, a price with domestic and import fields, notes, tags, links, and a loadout of slotted parts), plus three sibling collections: missions, capabilities (the tech-tree edges), and insights. The UI is a view over that content, and it should scale by adding records, not by adding screens. Mock this as static data in whatever form suits your approach.

## Deliverable and constraints
- A high-fidelity, navigable mockup covering the screens above, with the key interactions working or convincingly faked.
- Desktop-first is fine; note briefly how it would adapt to smaller screens if relevant.
- Placeholder data only; no real backend, authentication, or live pricing.
- Multiple populated states (a few units per bay, at least one fully detailed unit, and the Undercroft mission fully wired) so I can judge the design in use rather than empty.
- Briefly note your art-direction choices and which interactions you faked versus implemented.

## What good looks like
I should open it and want to keep clicking. The acquire, upgrade, deploy loop should be legible without explanation. Navigating by bay should feel natural. The mission lens and the live constraint gauges should be the standout moments. Above all it should look distinctive and intentional, not like a default template.
