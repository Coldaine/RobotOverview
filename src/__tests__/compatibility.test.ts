import { describe, it, expect } from 'vitest';
import { checkCompatibility } from '@/lib/compatibility';
import type { Unit, LoadoutSlot } from '@/data/types';

function makeUnit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: 'test-unit',
    name: 'Test Unit',
    bay: 'compute',
    class: 'SBC · Onboard I/O',
    status: 'operational',
    summary: '',
    specs: [],
    tags: [],
    ...overrides,
  };
}

function makeSlot(slot: string): LoadoutSlot {
  return { slot, filledBy: null };
}

describe('checkCompatibility() — Host Controller / Compute slots', () => {
  it('compute-bay unit matches "Host Controller Mount"', () => {
    expect(checkCompatibility(makeUnit({ bay: 'compute' }), makeSlot('Host Controller Mount'))).toBe(true);
  });

  it('robotics-bay unit with no compute class/tags does not match "Host Controller Mount"', () => {
    expect(
      checkCompatibility(makeUnit({ bay: 'robotics', class: 'Tracked Rover', tags: [] }), makeSlot('Host Controller Mount'))
    ).toBe(false);
  });

  it('unit with class containing "sbc" matches a compute-style slot', () => {
    expect(checkCompatibility(makeUnit({ bay: 'robotics', class: 'SBC · Onboard I/O', tags: [] }), makeSlot('Host Controller Mount'))).toBe(true);
  });

  it('unit with tag "compute" matches a compute-style slot', () => {
    expect(checkCompatibility(makeUnit({ bay: 'robotics', class: 'Tracked Rover', tags: ['compute'] }), makeSlot('Host Controller Mount'))).toBe(true);
  });
});

describe('checkCompatibility() — Power / Battery / UPS slots', () => {
  it('unit with class "Power Module" matches "Power Output Pins"', () => {
    expect(checkCompatibility(makeUnit({ class: 'Power Module', tags: [] }), makeSlot('Power Output Pins'))).toBe(true);
  });

  it('unit with class "Tracked Rover" does not match "Power Output Pins"', () => {
    expect(checkCompatibility(makeUnit({ bay: 'robotics', class: 'Tracked Rover', tags: [] }), makeSlot('Power Output Pins'))).toBe(false);
  });

  it('unit with tag "ups" matches "Undercarriage Bay"', () => {
    expect(checkCompatibility(makeUnit({ class: 'Unknown', tags: ['ups'] }), makeSlot('Undercarriage Bay'))).toBe(true);
  });

  it('unit with class "Power Module" matches "XH2.54 Battery Input"', () => {
    expect(checkCompatibility(makeUnit({ class: 'Power Module' }), makeSlot('XH2.54 Battery Input'))).toBe(true);
  });
});

describe('checkCompatibility() — Servo / Arm / Bus slots', () => {
  it('unit with tag "roarm" matches "Serial Bus Servo"', () => {
    expect(checkCompatibility(makeUnit({ class: 'Manipulator Arm', tags: ['roarm'] }), makeSlot('Serial Bus Servo'))).toBe(true);
  });

  it('unit with only "compute" tag does not match "Serial Bus Servo"', () => {
    expect(checkCompatibility(makeUnit({ class: 'SBC', tags: ['compute'] }), makeSlot('Serial Bus Servo'))).toBe(false);
  });

  it('unit with class "Manipulator Arm" matches "Serial Bus Servo"', () => {
    expect(checkCompatibility(makeUnit({ class: 'Manipulator Arm', tags: [] }), makeSlot('Serial Bus Servo'))).toBe(true);
  });
});

describe('checkCompatibility() — Rail / Sensor / Camera / LiDAR / Lighting slots', () => {
  it('unit with class "LiDAR Sensor" matches "21mm Picatinny Rail"', () => {
    expect(checkCompatibility(makeUnit({ class: 'LiDAR Sensor', tags: [] }), makeSlot('21mm Picatinny Rail'))).toBe(true);
  });

  it('unit with tag "camera" matches "21mm Picatinny Rail"', () => {
    expect(checkCompatibility(makeUnit({ class: 'Unknown', tags: ['camera'] }), makeSlot('21mm Picatinny Rail'))).toBe(true);
  });

  it('unit with class "Tracked Rover" and no sensor tags does not match a rail slot', () => {
    expect(checkCompatibility(makeUnit({ class: 'Tracked Rover', tags: [] }), makeSlot('21mm Picatinny Rail'))).toBe(false);
  });

  it('unit with class "Lighting Rig" matches a sensor-class slot', () => {
    expect(checkCompatibility(makeUnit({ class: 'Lighting Rig', tags: [] }), makeSlot('21mm Picatinny Rail'))).toBe(true);
  });
});

describe('checkCompatibility() — edge cases', () => {
  it('returns true for an unknown slot name (default fallthrough)', () => {
    expect(checkCompatibility(makeUnit({ bay: 'robotics', class: 'Tracked Rover', tags: [] }), makeSlot('Totally Unknown Slot XYZ'))).toBe(true);
  });

  it('returns true when targetSlot is null', () => {
    expect(checkCompatibility(makeUnit(), null)).toBe(true);
  });
});
