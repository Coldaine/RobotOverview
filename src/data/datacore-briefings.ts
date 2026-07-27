export type BriefingKind = 'research' | 'plan';

export type DatacoreBriefing = {
  id: string;
  title: string;
  href: string;
  /**
   * Repo-relative path to the markdown this briefing renders. The file stays
   * wherever it is authored — plans live in `docs/plans/` and are read from
   * there, never copied — so a briefing surfaces existing work rather than
   * duplicating it.
   */
  source: string;
  kind: BriefingKind;
  summary: string;
  tags: string[];
  capturedAt: string;
};

/** Long-form research / speculative docs surfaced in Datacore (beyond short insights). */
export const DATACORE_BRIEFINGS: DatacoreBriefing[] = [
  {
    id: 'compute-workload',
    title: 'Compute Workload Sizing — Orin NX vs AGX Orin',
    href: '/datacore/briefing/compute-workload',
    source: 'content/datacore/compute-workload.md',
    kind: 'research',
    summary:
      'How engineers formally represent the workload that leads to Orin NX versus AGX Orin: linked views from requirements through measured runtime — not a single TOPS diagram.',
    tags: ['compute', 'jetson', 'orin', 'sizing'],
    capturedAt: '2026-07-23',
  },
  {
    id: 'architecture-unification',
    title: 'Unite the Wiring Architecture — One Spine, Two Eyes',
    href: '/datacore/briefing/architecture-unification',
    source: 'docs/plans/2026-07-27-architecture-unification.md',
    kind: 'plan',
    summary:
      'Five wiring surfaces had drifted apart across the app, with four different join keys. Collapses them onto one shared surface while The Board and the BEAST Console stay independent views.',
    tags: ['architecture', 'wiring', 'beast', 'refactor'],
    capturedAt: '2026-07-27',
  },
  {
    id: 'ros-driver-schematic',
    title: 'Enumerate the ROS Driver Schematic PDF',
    href: '/datacore/briefing/ros-driver-schematic',
    source: 'docs/plans/2026-07-27-schematic-netlist-extraction-plan.md',
    kind: 'plan',
    summary:
      'Bounded visual extraction of every component, pin, net, connector, note, and ambiguity depicted in the ROS Driver schematic — with an explicit claim vocabulary so an unreadable region is recorded rather than guessed.',
    tags: ['schematic', 'beast', 'driver-board', 'extraction'],
    capturedAt: '2026-07-27',
  },
  {
    id: 'cad-assets',
    title: 'CAD Assets — Where They Live and What They Are For',
    href: '/datacore/briefing/cad-assets',
    source: 'docs/plans/2026-07-27-cad-assets-usage-and-discoverability.md',
    kind: 'plan',
    summary:
      'Seven Waveshare CAD archives, three filename traps that send agents to the wrong file, and the uses each archive answers. X1 gates drilling the Jetson mounting pattern.',
    tags: ['cad', 'beast', 'mounting', 'jetson'],
    capturedAt: '2026-07-27',
  },
];

export function briefingById(id: string): DatacoreBriefing | undefined {
  return DATACORE_BRIEFINGS.find((b) => b.id === id);
}
