'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  rosClient,
  useCockpitStatus,
  useCockpitEstop,
  useCockpitBridge,
  useConnectionState,
  ESTOP_MUX_SOURCE,
} from '@/lib/ros/client';
import {
  Sliders,
  Lightbulb,
  RotateCcw,
  Move,
  Sparkles,
  Ban,
} from 'lucide-react';
import clsx from 'clsx';

// ── DRIVE INTENT ────────────────────────────────────────────────────────────
// Held intent, not edge-triggered pulses. A button press sets the intent and a
// 10 Hz interval republishes it until release, because twist_mux expires a
// source after 0.5 s of silence — a single Twist on mousedown makes the robot
// twitch and stop, which is exactly what the old edge-triggered drive() did.
const DRIVE_PUBLISH_HZ = 10;
const DRIVE_PUBLISH_MS = 1000 / DRIVE_PUBLISH_HZ;

const LINEAR_STEP = 0.2; // m/s — matches the cap advertised in the UI
const ANGULAR_STEP = 0.4; // rad/s

const PAN_MIN = -3.14;
const PAN_MAX = 3.14;
const TILT_MIN = -0.523;
const TILT_MAX = 1.571;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

type DriveIntent = { linearX: number; angularZ: number };

export function CommandRail() {
  const status = useCockpitStatus();
  const estop = useCockpitEstop();
  const bridge = useCockpitBridge();
  const connection = useConnectionState();

  // LED States (0 - 255)
  const [io4, setIo4] = useState(0);
  const [io5, setIo5] = useState(0);

  // Gimbal States (pan: -3.14..3.14, tilt: -0.523..1.571)
  const [pan, setPan] = useState(0.0);
  const [tilt, setTilt] = useState(0.0);
  const [steady, setSteady] = useState(false);

  // Last control that failed to reach the socket (M3 — never leave the UI
  // showing a state the robot was never told about).
  const [fault, setFault] = useState<string | null>(null);

  const [driving, setDriving] = useState(false);

  const gimbalBoxRef = useRef<HTMLDivElement | null>(null);
  const driveIntentRef = useRef<DriveIntent | null>(null);
  const driveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const connected = connection === 'connected';
  const estopHolding = estop.engaged || status.muxSource === ESTOP_MUX_SOURCE;

  // ── B11: MOTION GATE ──────────────────────────────────────────────────────
  // The cockpit ships the drive capability, but motion stays inert until the
  // ROBOT says it is armed. `allowMotion === null` means no publisher has ever
  // told us — that is UNKNOWN, and unknown is not permission.
  const driveGateReason: string | null = !connected
    ? 'robot unreachable'
    : estopHolding
      ? 'E-STOP engaged'
      : status.allowMotion === null
        ? 'no allow_motion publisher — unknown'
        : status.allowMotion === false
          ? 'robot reports motion locked'
          : bridge.deadTopics.includes('/cmd_vel_ui')
            ? 'bridge refused /cmd_vel_ui'
            : null;
  const driveEnabled = driveGateReason === null;

  const isDead = (topic: string) => bridge.deadTopics.includes(topic);

  const publishTwist = useCallback((linearX: number, angularZ: number): boolean => {
    return rosClient.publish('/cmd_vel_ui', {
      linear: { x: linearX, y: 0.0, z: 0.0 },
      angular: { x: 0.0, y: 0.0, z: angularZ },
    });
  }, []);

  /**
   * Release the drive. Publishes exactly ONE zero Twist and then goes silent.
   *
   * WHY ONE AND NOT A STREAM OF ZEROS: ugv_bringup drops zero-Twists after 5
   * consecutive zeros (documented robot-side quirk), so spamming zeros is not a
   * stop guarantee — it is a stop *request* the robot will start ignoring.
   * Silence is the real mechanism: twist_mux expires this source after 0.5 s
   * with no message, and the robot's own 0.5 s cmd_vel watchdog is the only
   * actual stop guarantee. The single zero is a courtesy for the fast path.
   */
  const clearDriveIntent = useCallback(() => {
    if (driveTimerRef.current !== null) {
      clearInterval(driveTimerRef.current);
      driveTimerRef.current = null;
    }
    const wasDriving = driveIntentRef.current !== null;
    driveIntentRef.current = null;
    if (wasDriving) {
      publishTwist(0, 0);
      setDriving(false);
    }
  }, [publishTwist]);

  const setDriveIntent = useCallback(
    (linearX: number, angularZ: number) => {
      if (!driveEnabled) return;
      driveIntentRef.current = { linearX, angularZ };
      setDriving(true);
      if (!publishTwist(linearX, angularZ)) {
        setFault('drive: /cmd_vel_ui publish failed — command did not leave the browser');
        clearDriveIntent();
        return;
      }
      setFault(null);
      if (driveTimerRef.current === null) {
        driveTimerRef.current = setInterval(() => {
          const intent = driveIntentRef.current;
          if (!intent) return;
          if (!publishTwist(intent.linearX, intent.angularZ)) {
            setFault('drive: socket closed mid-command — intent cleared');
            clearDriveIntent();
          }
        }, DRIVE_PUBLISH_MS);
      }
    },
    [driveEnabled, publishTwist, clearDriveIntent],
  );

  // The gate can close underneath a held button (e-stop pressed, link dropped,
  // robot disarms). Drop the intent the moment it does.
  useEffect(() => {
    if (!driveEnabled) clearDriveIntent();
  }, [driveEnabled, clearDriveIntent]);

  // Tear the interval down with the component so a route change cannot leave a
  // drive republishing from an unmounted tree.
  useEffect(() => clearDriveIntent, [clearDriveIntent]);

  // ── KEYBOARD ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      // Key auto-repeat would restart the intent dozens of times a second and
      // re-fire the immediate publish; the held interval already covers it.
      if (e.repeat) return;

      switch (e.key.toLowerCase()) {
        case 'w':
          setDriveIntent(LINEAR_STEP, 0);
          break;
        case 's':
          setDriveIntent(-LINEAR_STEP, 0);
          break;
        case 'a':
          setDriveIntent(0, ANGULAR_STEP);
          break;
        case 'd':
          setDriveIntent(0, -ANGULAR_STEP);
          break;
        case ' ':
        case 'escape':
          clearDriveIntent();
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (['w', 'a', 's', 'd'].includes(e.key.toLowerCase())) clearDriveIntent();
    };

    // A keyup that lands on another window never reaches us, so the intent would
    // stay held with the operator's hand off the keyboard. Blur, tab-hide and
    // cancelled pointers all mean "we are no longer in control" — release.
    const handleRelease = () => clearDriveIntent();
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') clearDriveIntent();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleRelease);
    window.addEventListener('pointercancel', handleRelease);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleRelease);
      window.removeEventListener('pointercancel', handleRelease);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [setDriveIntent, clearDriveIntent]);

  // Pointer (not mouse) events so touch works; capture keeps the release event
  // bound to this element even if the finger slides off it.
  const holdProps = (linearX: number, angularZ: number) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      setDriveIntent(linearX, angularZ);
    },
    onPointerUp: () => clearDriveIntent(),
    onPointerCancel: () => clearDriveIntent(),
    onLostPointerCapture: () => clearDriveIntent(),
    style: { touchAction: 'none' as const },
  });

  // ── LED / GIMBAL PUBLISHERS (M3: honour the return value) ──────────────────
  const updateLEDs = (nextIo4: number, nextIo5: number) => {
    const prev = { io4, io5 };
    setIo4(nextIo4);
    setIo5(nextIo5);
    if (!rosClient.publish('/ugv/led_ctrl', { data: [nextIo4, nextIo5] })) {
      setIo4(prev.io4);
      setIo5(prev.io5);
      setFault('LED: /ugv/led_ctrl publish failed — sliders reverted');
      return;
    }
    setFault(null);
  };

  const updateGimbal = (nextPan: number, nextTilt: number) => {
    const roundedPan = Math.round(clamp(nextPan, PAN_MIN, PAN_MAX) * 100) / 100;
    const roundedTilt = Math.round(clamp(nextTilt, TILT_MIN, TILT_MAX) * 100) / 100;
    const prev = { pan, tilt };
    setPan(roundedPan);
    setTilt(roundedTilt);
    if (
      !rosClient.publish('/pt_joint_position_controller/commands', {
        data: [roundedPan, roundedTilt],
      })
    ) {
      setPan(prev.pan);
      setTilt(prev.tilt);
      setFault('Gimbal: publish failed — crosshair reverted');
      return;
    }
    setFault(null);
  };

  const resetGimbal = () => updateGimbal(0.0, 0.0);

  const toggleSteady = () => {
    const nextSteady = !steady;
    setSteady(nextSteady);
    // Steady command maps: [mode, y_bias]. Float32MultiArray robot-side.
    if (!rosClient.publish('/ugv/pt_steady_ctrl', { data: [nextSteady ? 1.0 : 0.0, 0.0] })) {
      setSteady(steady);
      setFault('Steady: /ugv/pt_steady_ctrl publish failed — toggle reverted');
      return;
    }
    setFault(null);
  };

  // Drag anywhere in the gimbal box to aim. Pointer position maps linearly onto
  // the true joint ranges (see the axis labels) — no rescaling that would make
  // a commanded angle read as something it is not.
  const aimFromPointer = (clientX: number, clientY: number) => {
    const box = gimbalBoxRef.current?.getBoundingClientRect();
    if (!box || box.width === 0 || box.height === 0) return;
    const fx = clamp((clientX - box.left) / box.width, 0, 1);
    const fy = clamp((clientY - box.top) / box.height, 0, 1);
    updateGimbal(PAN_MIN + fx * (PAN_MAX - PAN_MIN), TILT_MAX - fy * (TILT_MAX - TILT_MIN));
  };

  const gimbalDraggingRef = useRef(false);
  const gimbalDead = isDead('/pt_joint_position_controller/commands');

  const rungState = (source: string) => {
    if (status.muxSource === null) return { label: 'UNKNOWN', active: false, unknown: true };
    const active = status.muxSource === source;
    return { label: active ? 'ACTIVE' : 'IDLE', active, unknown: false };
  };

  const rungs = [
    { pri: 255, name: 'E-STOP Lock', source: ESTOP_MUX_SOURCE, tone: 'red' as const },
    { pri: 150, name: 'BT Pad · Robot', source: 'BT pad · robot', tone: 'cyan' as const },
    { pri: 100, name: 'Operator Pad', source: 'Operator pad', tone: 'cyan' as const },
    { pri: 50, name: 'UI Teleop (WASD)', source: 'UI teleop', tone: 'emerald' as const },
    { pri: 10, name: 'nav2', source: 'nav2', tone: 'cyan' as const },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* ── TWIST_MUX LADDER ─────────────────────── */}
      <section className="panel border-rim bg-panel/85 flex flex-col p-4 shadow-md">
        <h2 className="font-display text-[11px] font-bold tracking-[0.16em] text-cyan uppercase flex items-center gap-1.5 leading-none mb-3">
          <Sliders className="h-3.5 w-3.5" /> twist_mux ladder{' '}
          <span className="text-ink-dim/70 font-normal font-mono text-[9.5px]">→ /cmd_vel</span>
        </h2>

        <div className="flex flex-col gap-1.5">
          {rungs.map((r) => {
            const state = rungState(r.source);
            return (
              <div
                key={r.pri}
                className={clsx(
                  'grid grid-cols-[36px_1fr_auto] gap-2 items-center border border-rim/60 rounded-md px-3 py-1.5 bg-hull/40 font-mono text-xs',
                  state.active &&
                    r.tone === 'red' &&
                    'border-red-500/50 bg-red-950/20 text-glow-red text-red-400',
                  state.active &&
                    r.tone === 'cyan' &&
                    'border-cyan-500/50 bg-cyan-950/20 text-glow-cyan text-cyan-400 font-bold',
                  state.active &&
                    r.tone === 'emerald' &&
                    'border-emerald-500/50 bg-emerald-950/20 text-glow-emerald text-emerald-400 font-bold',
                )}
              >
                <span className="font-extrabold text-ink-dim/70">{r.pri}</span>
                <span className="tracking-wide">{r.name}</span>
                <span
                  className={clsx(
                    'font-bold text-[9px] uppercase tracking-widest',
                    state.unknown
                      ? 'text-ink-dim/50'
                      : state.active
                        ? r.tone === 'red'
                          ? 'text-red-500 animate-pulse'
                          : r.tone === 'emerald'
                            ? 'text-emerald-400'
                            : 'text-cyan'
                        : 'text-zinc-600',
                  )}
                  title={state.unknown ? '/cockpit/status has no publisher yet' : undefined}
                >
                  {state.label}
                </span>
              </div>
            );
          })}
        </div>

        {status.muxSource === null && (
          <p className="font-mono text-[9px] text-ink-dim/70 mt-2 leading-snug">
            Ladder state is UNKNOWN — /cockpit/status is not published by the robot yet.
          </p>
        )}
      </section>

      {/* ── TELEOP AND GIMBAL CONTROLS ───────────── */}
      <section className="panel border-rim bg-panel/85 flex flex-col p-4 shadow-md">
        <h2 className="font-display text-[11px] font-bold tracking-[0.16em] text-cyan uppercase flex items-center gap-1.5 leading-none mb-3">
          <Move className="h-3.5 w-3.5" /> Teleop · gimbal
        </h2>

        {!driveEnabled && (
          <div
            className="mb-3 flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-950/20 px-2.5 py-1.5 font-mono text-[9.5px] leading-tight text-amber-400"
            role="status"
          >
            <Ban className="h-3.5 w-3.5 shrink-0" />
            <span>
              <b className="uppercase tracking-wider">Drive disabled</b> — {driveGateReason}
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3.5">
          {/* DIRECTIONAL DRIVING PAD */}
          <div className="flex flex-col justify-between">
            <div className="grid grid-cols-3 grid-rows-3 gap-1.5 justify-center max-w-[120px] mx-auto">
              <span className="blank bg-transparent" />
              <button
                {...holdProps(LINEAR_STEP, 0)}
                disabled={!driveEnabled}
                className={clsx(
                  'btn border rounded-lg aspect-square text-md flex items-center justify-center select-none',
                  driveEnabled
                    ? 'border-rim hover:border-cyan/50 hover:text-cyan bg-panel-2'
                    : 'border-rim/40 bg-panel-2/30 text-zinc-600 cursor-not-allowed',
                )}
                title={driveEnabled ? 'Forward (W)' : `Disabled — ${driveGateReason}`}
              >
                ▲
              </button>
              <span className="blank bg-transparent" />

              <button
                {...holdProps(0, ANGULAR_STEP)}
                disabled={!driveEnabled}
                className={clsx(
                  'btn border rounded-lg aspect-square text-md flex items-center justify-center select-none',
                  driveEnabled
                    ? 'border-rim hover:border-cyan/50 hover:text-cyan bg-panel-2'
                    : 'border-rim/40 bg-panel-2/30 text-zinc-600 cursor-not-allowed',
                )}
                title={driveEnabled ? 'Left (A)' : `Disabled — ${driveGateReason}`}
              >
                ◀
              </button>
              <button
                onClick={() => clearDriveIntent()}
                className="btn border border-red-500/50 text-red-500 hover:bg-red-500/10 rounded-lg aspect-square text-sm flex items-center justify-center font-bold select-none"
                title="Stop (Space) — releases intent; the robot's 0.5 s watchdog is the guarantee"
              >
                ■
              </button>
              <button
                {...holdProps(0, -ANGULAR_STEP)}
                disabled={!driveEnabled}
                className={clsx(
                  'btn border rounded-lg aspect-square text-md flex items-center justify-center select-none',
                  driveEnabled
                    ? 'border-rim hover:border-cyan/50 hover:text-cyan bg-panel-2'
                    : 'border-rim/40 bg-panel-2/30 text-zinc-600 cursor-not-allowed',
                )}
                title={driveEnabled ? 'Right (D)' : `Disabled — ${driveGateReason}`}
              >
                ▶
              </button>

              <span className="blank bg-transparent" />
              <button
                {...holdProps(-LINEAR_STEP, 0)}
                disabled={!driveEnabled}
                className={clsx(
                  'btn border rounded-lg aspect-square text-md flex items-center justify-center select-none',
                  driveEnabled
                    ? 'border-rim hover:border-cyan/50 hover:text-cyan bg-panel-2'
                    : 'border-rim/40 bg-panel-2/30 text-zinc-600 cursor-not-allowed',
                )}
                title={driveEnabled ? 'Reverse (S)' : `Disabled — ${driveGateReason}`}
              >
                ▼
              </button>
              <span className="blank bg-transparent" />
            </div>

            <div className="text-center font-mono text-[8.5px] uppercase tracking-widest font-bold mt-3 leading-none">
              <span className={driveEnabled ? 'text-amber-500/80' : 'text-zinc-600'}>
                Keyboard: WASD · Spc
              </span>
              <div className="text-zinc-500 font-normal scale-90 mt-1">
                Cap: {LINEAR_STEP.toFixed(2)} m/s · {DRIVE_PUBLISH_HZ} Hz held
              </div>
              {driving && (
                <div className="text-emerald-400 font-bold scale-90 mt-1 animate-pulse">
                  COMMANDING
                </div>
              )}
            </div>
          </div>

          {/* GIMBAL SCANNING DISPLAY */}
          <div className="flex flex-col gap-2 relative">
            <div
              ref={gimbalBoxRef}
              onPointerDown={(e) => {
                if (gimbalDead) return;
                e.preventDefault();
                e.currentTarget.setPointerCapture(e.pointerId);
                gimbalDraggingRef.current = true;
                aimFromPointer(e.clientX, e.clientY);
              }}
              onPointerMove={(e) => {
                if (!gimbalDraggingRef.current) return;
                aimFromPointer(e.clientX, e.clientY);
              }}
              onPointerUp={() => {
                gimbalDraggingRef.current = false;
              }}
              onPointerCancel={() => {
                gimbalDraggingRef.current = false;
              }}
              onLostPointerCapture={() => {
                gimbalDraggingRef.current = false;
              }}
              style={{ touchAction: 'none' }}
              className={clsx(
                'gimbal aspect-video border border-rim/60 rounded-lg relative bg-[linear-gradient(rgba(54,224,224,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(54,224,224,0.06)_1px,transparent_1px)] bg-[size:16px_16px] bg-hull/75 flex items-center justify-center',
                gimbalDead ? 'opacity-40 cursor-not-allowed' : 'cursor-crosshair',
              )}
              title={gimbalDead ? 'Bridge refused the gimbal topic' : 'Drag to aim the pan-tilt head'}
            >
              {/* The tilt range is ASYMMETRIC (-0.523 … +1.571 rad), so neutral
                  does NOT sit at the vertical midpoint — it sits where 0 rad
                  actually falls on that range. The labelled axis and the neutral
                  guide below make that legible instead of centring the crosshair
                  and lying about where the head is pointing. */}
              <div
                className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-ink-dim/25"
                style={{ top: `${((TILT_MAX - 0) / (TILT_MAX - TILT_MIN)) * 100}%` }}
              />
              <div
                className="pointer-events-none absolute top-0 bottom-0 border-l border-dashed border-ink-dim/25"
                style={{ left: '50%' }}
              />

              <div
                className="pointer-events-none absolute w-4.5 h-4.5 translate-x-[-50%] translate-y-[-50%] transition-all duration-150"
                style={{
                  left: `${((pan - PAN_MIN) / (PAN_MAX - PAN_MIN)) * 100}%`,
                  top: `${((TILT_MAX - tilt) / (TILT_MAX - TILT_MIN)) * 100}%`,
                }}
              >
                <div className="absolute top-1/2 left-0 right-0 h-[1.5px] bg-amber shadow-[0_0_8px_#ffb020]" />
                <div className="absolute left-1/2 top-0 bottom-0 w-[1.5px] bg-amber shadow-[0_0_8px_#ffb020]" />
              </div>

              {/* Axis extents, so the crosshair position is readable as a real
                  joint angle rather than an arbitrary spot in a box. */}
              <span className="pointer-events-none absolute top-0.5 right-1 font-mono text-[6.5px] text-ink-dim/60 leading-none">
                tilt +{TILT_MAX.toFixed(2)}
              </span>
              <span className="pointer-events-none absolute bottom-0.5 right-1 font-mono text-[6.5px] text-ink-dim/60 leading-none">
                tilt {TILT_MIN.toFixed(2)}
              </span>
              <span className="pointer-events-none absolute bottom-1.5 left-2 font-mono text-[7px] text-ink-dim/70 leading-none">
                P: {pan.toFixed(2)} · T: {tilt.toFixed(2)} rad
              </span>
            </div>

            {/* Gimbal Controls */}
            <div className="flex items-center justify-between gap-1 mt-1">
              <button
                onClick={resetGimbal}
                className="border border-rim bg-panel-2/40 hover:border-cyan/40 hover:text-cyan rounded px-2 py-0.5 font-mono text-[9px] select-none flex items-center gap-1 text-ink-dim uppercase"
                title="Center Gimbal"
              >
                <RotateCcw className="h-3 w-3" /> Center
              </button>
              <button
                onClick={toggleSteady}
                disabled={isDead('/ugv/pt_steady_ctrl')}
                className={clsx(
                  'border rounded px-1.5 py-0.5 font-mono text-[9px] select-none flex items-center gap-1 uppercase',
                  isDead('/ugv/pt_steady_ctrl')
                    ? 'border-rim/40 text-zinc-600 cursor-not-allowed'
                    : steady
                      ? 'border-emerald-500/50 bg-emerald-900/10 text-emerald-400'
                      : 'bg-panel-2/40 border-rim hover:border-cyan/40 hover:text-cyan text-ink-dim',
                )}
                title="Toggle steady mode"
              >
                <Sparkles className="h-3 w-3" /> {steady ? 'Steady On' : 'Steady Off'}
              </button>
            </div>
          </div>
        </div>

        {fault && (
          <p className="mt-3 rounded border border-red-500/40 bg-red-950/25 px-2.5 py-1.5 font-mono text-[9.5px] leading-tight text-red-400">
            {fault}
          </p>
        )}
      </section>

      {/* ── LED LIGHT RAIL CONTROLLERS ───────────── */}
      <section className="panel border-rim bg-panel/85 flex flex-col p-4 shadow-md gap-3.5">
        <h2 className="font-display text-[11px] font-bold tracking-[0.16em] text-cyan uppercase flex items-center gap-1.5 leading-none">
          <Lightbulb className="h-3.5 w-3.5" /> LED rail{' '}
          <span className="text-ink-dim/70 font-normal font-mono text-[9.5px]">/ugv/led_ctrl</span>
        </h2>

        {isDead('/ugv/led_ctrl') && (
          <p className="rounded border border-red-500/40 bg-red-950/25 px-2.5 py-1.5 font-mono text-[9.5px] text-red-400">
            Bridge refused /ugv/led_ctrl — headlights are dead.
          </p>
        )}

        <div className="flex flex-col gap-2.5 font-mono text-[10.5px]">
          {/* IO4 LED Chassis Headlight */}
          <div className="grid grid-cols-[40px_1fr_40px] gap-2 items-center">
            <span className="hud-label text-[9px] uppercase leading-none text-ink-dim/80">IO4</span>
            <input
              type="range"
              min="0"
              max="255"
              value={io4}
              disabled={isDead('/ugv/led_ctrl')}
              onChange={(e) => updateLEDs(Number(e.target.value), io5)}
              className="accent-amber bg-transparent w-full cursor-pointer h-1 rounded-full select-none disabled:cursor-not-allowed"
              title="Chassis headlights PWM duty"
            />
            <span className="text-right text-glow-amber text-amber font-bold leading-none select-none">
              {io4.toString().padStart(3, '0')}
            </span>
          </div>

          {/* IO5 LED Spotlight PT */}
          <div className="grid grid-cols-[40px_1fr_40px] gap-2 items-center">
            <span className="hud-label text-[9px] uppercase leading-none text-ink-dim/80">IO5</span>
            <input
              type="range"
              min="0"
              max="255"
              value={io5}
              disabled={isDead('/ugv/led_ctrl')}
              onChange={(e) => updateLEDs(io4, Number(e.target.value))}
              className="accent-amber bg-transparent w-full cursor-pointer h-1 rounded-full select-none disabled:cursor-not-allowed"
              title="Pan-tilt spotlight PWM duty"
            />
            <span className="text-right text-glow-amber text-amber font-bold leading-none select-none">
              {io5.toString().padStart(3, '0')}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
