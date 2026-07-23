export type DatacoreBriefing = {
  id: string;
  title: string;
  href: string;
  summary: string;
  tags: string[];
  capturedAt: string;
};

/** Long-form research / speculative docs surfaced in Datacore (beyond short insights). */
export const DATACORE_BRIEFINGS: DatacoreBriefing[] = [
  {
    id: 'compute-workload',
    title: 'Compute Workload Sizing — Orin NX vs AGX Orin',
    href: '/datacore/compute-workload',
    summary:
      'How engineers formally represent the workload that leads to Orin NX versus AGX Orin: linked views from requirements through measured runtime — not a single TOPS diagram.',
    tags: ['compute', 'jetson', 'orin', 'sizing'],
    capturedAt: '2026-07-23',
  },
];
