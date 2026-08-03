import type { BeastRobotStatus, MotionToolResult } from './types';

/**
 * UX-level honesty gate. Physical enforcement stays on the robot
 * (`ugv_bringup` drops cmd_vel when disarmed). We still refuse to dispatch
 * motion intents when allow_motion is not explicitly true.
 */
export function gateMotionIntent(status: BeastRobotStatus): MotionToolResult | null {
  if (status.connection === 'unconfigured') {
    return {
      ok: false,
      status: 'bridge_unavailable',
      message:
        'BEAST_COCKPIT_WS_URL is not configured — server rosbridge client is idle. Motion refused.',
    };
  }

  if (status.connection !== 'connected') {
    return {
      ok: false,
      status: 'bridge_unavailable',
      message: `Robot bridge is ${status.connection} — cannot verify allow_motion. Motion refused.`,
    };
  }

  if (status.allowMotion === true) {
    return null;
  }

  const reason =
    status.lockReason ??
    (status.allowMotion === false
      ? 'allow_motion is false (software motion lock)'
      : 'allow_motion is unknown (status topics not deployed or not yet received)');

  return {
    ok: false,
    status: 'refused',
    message: `Motion gated — ${reason}. Call get_status, do not invent arming.`,
  };
}

export function statusLockReason(status: Pick<BeastRobotStatus, 'allowMotion' | 'lockReason'>): string | null {
  if (status.lockReason) return status.lockReason;
  if (status.allowMotion === false) return 'allow_motion is false';
  if (status.allowMotion === null) return 'allow_motion unknown';
  return null;
}
