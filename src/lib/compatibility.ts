import type { Unit, LoadoutSlot } from '@/data/types';

export function checkCompatibility(u: Unit, targetSlot: LoadoutSlot | null): boolean {
  if (!targetSlot) return true;
  const nameLower = targetSlot.slot.toLowerCase();
  const classLower = (u.class || '').toLowerCase();
  const tagsLower = (u.tags || []).map((t) => t.toLowerCase());
  const bay = u.bay;

  if (nameLower.includes('host') || nameLower.includes('controller') || nameLower.includes('compute')) {
    return bay === 'compute' || classLower.includes('sbc') || classLower.includes('controller') || tagsLower.includes('compute');
  }
  if (
    nameLower.includes('power') ||
    nameLower.includes('battery') ||
    nameLower.includes('ups') ||
    nameLower.includes('undercarriage') ||
    nameLower.includes('input')
  ) {
    return (
      classLower.includes('power') ||
      classLower.includes('ups') ||
      classLower.includes('battery') ||
      tagsLower.includes('power') ||
      tagsLower.includes('ups')
    );
  }
  if (nameLower.includes('servo') || nameLower.includes('arm') || nameLower.includes('manipulator') || nameLower.includes('bus')) {
    return classLower.includes('arm') || classLower.includes('servo') || tagsLower.includes('arm') || tagsLower.includes('roarm');
  }
  if (
    nameLower.includes('rail') ||
    nameLower.includes('sensor') ||
    nameLower.includes('camera') ||
    nameLower.includes('lidar') ||
    nameLower.includes('lighting')
  ) {
    return (
      classLower.includes('sensor') ||
      classLower.includes('camera') ||
      classLower.includes('lidar') ||
      classLower.includes('lighting') ||
      tagsLower.includes('sensor') ||
      tagsLower.includes('camera') ||
      tagsLower.includes('lidar')
    );
  }
  return true;
}
