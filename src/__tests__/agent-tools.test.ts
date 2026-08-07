import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  backUpSchema,
  driveOnHeadingSchema,
  spinSchema,
} from '@/server/beast/schemas';
import { gateMotionIntent } from '@/server/beast/motion-gate';
import {
  createAgentTools,
  MOTION_TOOL_NAMES,
  NO_APPROVAL_TOOL_NAMES,
  toolNeedsApproval,
} from '@/server/beast/tools';
import type { BeastRobotBridge, BeastRobotStatus, MotionToolResult } from '@/server/beast/types';

function status(partial: Partial<BeastRobotStatus> = {}): BeastRobotStatus {
  return {
    connection: 'connected',
    bridgeUrl: 'wss://beast-test:9090',
    allowMotion: false,
    voltage: 11.2,
    scanAlive: true,
    lockReason: null,
    updatedAt: Date.now(),
    ...partial,
  };
}

function mockBridge(overrides: Partial<BeastRobotBridge> = {}): BeastRobotBridge & {
  driveOnHeading: ReturnType<typeof vi.fn>;
  spin: ReturnType<typeof vi.fn>;
  backUp: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  getStatus: ReturnType<typeof vi.fn>;
} {
  const dispatched: MotionToolResult = {
    ok: true,
    status: 'dispatched',
    message: 'sent',
  };
  return {
    getConnectionState: () => 'connected',
    getStatus: vi.fn(async () => status()),
    driveOnHeading: vi.fn(async () => dispatched),
    spin: vi.fn(async () => dispatched),
    backUp: vi.fn(async () => dispatched),
    stop: vi.fn(async () => ({
      ok: true,
      status: 'canceled' as const,
      message: 'canceled',
    })),
    ...overrides,
  } as ReturnType<typeof mockBridge>;
}

async function execTool(
  tools: ReturnType<typeof createAgentTools>,
  name: string,
  input: unknown,
) {
  const t = tools[name];
  expect(t).toBeDefined();
  expect(t && 'execute' in t && typeof t.execute === 'function').toBe(true);
  // AI SDK tool execute signature: (input, options) => ...
  return (t as { execute: (input: unknown, opts: unknown) => Promise<unknown> }).execute(
    input,
    {
      toolCallId: 'test-call',
      messages: [],
    },
  );
}

describe('agent tool schemas', () => {
  it('accepts valid drive_on_heading / spin / back_up payloads', () => {
    expect(driveOnHeadingSchema.parse({ meters: 1.5, speed: 0.1 })).toEqual({
      meters: 1.5,
      speed: 0.1,
    });
    expect(spinSchema.parse({ degrees: -90 })).toEqual({ degrees: -90 });
    expect(backUpSchema.parse({ meters: 0.5 })).toEqual({ meters: 0.5 });
  });

  it('rejects out-of-bounds and zero-spin inputs', () => {
    expect(() => driveOnHeadingSchema.parse({ meters: 0 })).toThrow();
    expect(() => driveOnHeadingSchema.parse({ meters: 1, speed: 0.5 })).toThrow();
    expect(() => driveOnHeadingSchema.parse({ meters: 99 })).toThrow();
    expect(() => spinSchema.parse({ degrees: 0 })).toThrow();
    expect(() => spinSchema.parse({ degrees: 720 })).toThrow();
    expect(() => backUpSchema.parse({ meters: 5 })).toThrow();
  });
});

describe('approval gating metadata', () => {
  it('marks motion tools as needingApproval and leaves get_status/stop open', () => {
    const tools = createAgentTools(mockBridge());
    for (const name of MOTION_TOOL_NAMES) {
      expect(toolNeedsApproval(name, tools), name).toBe(true);
    }
    for (const name of NO_APPROVAL_TOOL_NAMES) {
      expect(toolNeedsApproval(name, tools), name).toBe(false);
    }
  });
});

describe('disarmed honesty (allow_motion gate)', () => {
  let bridge: ReturnType<typeof mockBridge>;

  beforeEach(() => {
    bridge = mockBridge();
  });

  it('gateMotionIntent refuses when allow_motion is false', () => {
    const gated = gateMotionIntent(status({ allowMotion: false }));
    expect(gated?.ok).toBe(false);
    expect(gated?.status).toBe('refused');
    expect(gated?.message).toMatch(/allow_motion is false/i);
  });

  it('gateMotionIntent refuses when allow_motion is unknown', () => {
    const gated = gateMotionIntent(status({ allowMotion: null }));
    expect(gated?.status).toBe('refused');
    expect(gated?.message).toMatch(/unknown/i);
  });

  it('gateMotionIntent refuses when bridge is unconfigured', () => {
    const gated = gateMotionIntent(
      status({ connection: 'unconfigured', allowMotion: true, bridgeUrl: null }),
    );
    expect(gated?.status).toBe('bridge_unavailable');
  });

  it('motion tool execute refuses when disarmed and never calls the bridge action', async () => {
    bridge.getStatus.mockResolvedValue(status({ allowMotion: false }));
    const tools = createAgentTools(bridge);

    const drive = await execTool(tools, 'drive_on_heading', { meters: 1 });
    const spin = await execTool(tools, 'spin', { degrees: 45 });
    const backup = await execTool(tools, 'back_up', { meters: 0.3 });

    expect(drive).toMatchObject({ ok: false, status: 'refused' });
    expect(spin).toMatchObject({ ok: false, status: 'refused' });
    expect(backup).toMatchObject({ ok: false, status: 'refused' });
    expect(bridge.driveOnHeading).not.toHaveBeenCalled();
    expect(bridge.spin).not.toHaveBeenCalled();
    expect(bridge.backUp).not.toHaveBeenCalled();
  });

  it('motion tool execute dispatches only when allow_motion is true', async () => {
    bridge.getStatus.mockResolvedValue(status({ allowMotion: true, lockReason: null }));
    const tools = createAgentTools(bridge);

    const drive = await execTool(tools, 'drive_on_heading', { meters: 0.5, speed: 0.1 });
    expect(drive).toMatchObject({ ok: true, status: 'dispatched' });
    expect(bridge.driveOnHeading).toHaveBeenCalledWith({ meters: 0.5, speed: 0.1 });
  });

  it('get_status and stop run without approval and without requiring allow_motion', async () => {
    bridge.getStatus.mockResolvedValue(status({ allowMotion: false }));
    const tools = createAgentTools(bridge);

    const snap = await execTool(tools, 'get_status', {});
    expect(snap).toMatchObject({
      allowMotion: false,
      motionGated: true,
    });

    const stop = await execTool(tools, 'stop', {});
    expect(stop).toMatchObject({ ok: true, status: 'canceled' });
    expect(bridge.stop).toHaveBeenCalledOnce();
  });
});
