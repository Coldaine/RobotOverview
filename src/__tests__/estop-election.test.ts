import { describe, it, expect } from 'vitest';
import { rosClient } from '@/lib/ros/client';
import { getEstopState } from '@/lib/ros/estop-store';

describe('e-stop direct session capability', () => {
  it('latches E-STOP state directly', () => {
    rosClient.setEstopLock(true);
    expect(getEstopState().engaged).toBe(true);
    rosClient.setEstopLock(false);
    expect(getEstopState().engaged).toBe(false);
  });
});

