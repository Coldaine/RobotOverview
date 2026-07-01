#!/usr/bin/env node

import { io as createSocketClient } from 'socket.io-client';

const DEFAULT_HOST = 'http://192.168.20.184:5000';
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_NUDGE_MS = 400;
const DEFAULT_NUDGE_SPEED = 0.2;

function usage() {
  return [
    'Usage: npm run beast:probe -- [options]',
    '',
    'Safe by default: probes BEAST-01, sends a zero-speed stop, and reads telemetry.',
    '',
    'Options:',
    '  --host <url>                 Robot web UI base URL. Default: BEAST_HOST or http://192.168.20.184:5000',
    '  --timeout-ms <ms>            Socket timeout. Default: 8000',
    '  --no-stop                    Probe without sending the zero-speed stop command',
    '  --nudge                      Send a brief low-speed movement, then stop',
    '  --speed <value>              Nudge track speed. Default: 0.2',
    '  --duration-ms <ms>           Nudge duration. Default: 400',
    '  --i-am-with-the-robot        Required with --nudge',
    '  --clear-runway-confirmed     Required with --nudge',
    '  --help                       Show this help',
  ].join('\n');
}

function parseArgs(argv) {
  const options = {
    host: process.env.BEAST_HOST || DEFAULT_HOST,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    sendStop: true,
    nudge: false,
    nudgeSpeed: DEFAULT_NUDGE_SPEED,
    nudgeDurationMs: DEFAULT_NUDGE_MS,
    withRobot: false,
    clearRunway: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      i += 1;
      if (i >= argv.length) throw new Error(`${arg} requires a value`);
      return argv[i];
    };

    switch (arg) {
      case '--host':
        options.host = normalizeHost(next());
        break;
      case '--timeout-ms':
        options.timeoutMs = positiveInteger(next(), arg);
        break;
      case '--no-stop':
        options.sendStop = false;
        break;
      case '--nudge':
        options.nudge = true;
        options.sendStop = true;
        break;
      case '--speed':
        options.nudgeSpeed = Number(next());
        if (!Number.isFinite(options.nudgeSpeed) || Math.abs(options.nudgeSpeed) > 0.3) {
          throw new Error('--speed must be a finite value with magnitude <= 0.3');
        }
        break;
      case '--duration-ms':
        options.nudgeDurationMs = positiveInteger(next(), arg);
        if (options.nudgeDurationMs > 1000) {
          throw new Error('--duration-ms must be <= 1000 for this supervised probe');
        }
        break;
      case '--i-am-with-the-robot':
        options.withRobot = true;
        break;
      case '--clear-runway-confirmed':
        options.clearRunway = true;
        break;
      case '--help':
      case '-h':
        console.log(usage());
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (options.nudge && (!options.withRobot || !options.clearRunway)) {
    throw new Error('--nudge requires --i-am-with-the-robot and --clear-runway-confirmed');
  }

  options.host = normalizeHost(options.host);
  return options;
}

function normalizeHost(host) {
  if (!/^https?:\/\//i.test(host)) {
    return `http://${host}`;
  }
  return host.replace(/\/$/, '');
}

function positiveInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function parseSimpleYaml(yamlText) {
  const root = {};
  let section = null;

  for (const rawLine of yamlText.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line.trim() || line.trimStart().startsWith('#')) continue;

    const sectionMatch = /^([A-Za-z0-9_]+):\s*$/.exec(line);
    if (sectionMatch) {
      section = sectionMatch[1];
      root[section] = {};
      continue;
    }

    const keyValueMatch = /^\s{2}([A-Za-z0-9_]+):\s*(.*)$/.exec(line);
    if (section && keyValueMatch) {
      root[section][keyValueMatch[1]] = coerceYamlScalar(keyValueMatch[2]);
    }
  }

  return root;
}

function coerceYamlScalar(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) && value !== '' ? numeric : value;
}

async function fetchText(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`${url} returned HTTP ${response.status}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function connectAndRead({ createSocket, host, config, options }) {
  const movementCommand = config.cmd_config?.cmd_movition_ctrl ?? 1;
  const fb = config.fb ?? {};
  const telemetryKeys = {
    batteryVoltage: fb.base_voltage ?? 112,
    wifiRssi: fb.wifi_rssi ?? 111,
    cpuTemp: fb.cpu_temp ?? 107,
    cpuLoad: fb.cpu_load ?? 106,
    ramUsage: fb.ram_usage ?? 108,
    videoFps: fb.video_fps ?? 113,
    feedbackFlag: fb.cv_movtion_mode ?? 114,
    trackLeft: fb.picture_size ?? 104,
    trackRight: fb.video_size ?? 105,
    baseLight: fb.base_light ?? 115,
  };

  const jsonSocket = createSocket(`${host}/json`, { transports: ['websocket', 'polling'], timeout: options.timeoutMs });
  const ctrlSocket = createSocket(`${host}/ctrl`, { transports: ['websocket', 'polling'], timeout: options.timeoutMs });

  return new Promise((resolve, reject) => {
    const result = {
      jsonConnected: false,
      ctrlConnected: false,
      stopSent: false,
      nudgeSent: false,
      nudgeStopSent: false,
      telemetry: null,
      rawKeys: [],
    };
    let settled = false;

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Timed out waiting for Socket.IO control/telemetry'));
    }, options.timeoutMs);

    const cleanup = () => {
      clearTimeout(timeout);
      jsonSocket.close();
      ctrlSocket.close();
    };

    const maybeResolve = () => {
      if (settled) return;
      const commandPathReady = result.jsonConnected && (!options.sendStop || result.stopSent);
      const nudgeComplete = !options.nudge || result.nudgeStopSent;
      if (result.telemetry && commandPathReady && nudgeComplete) {
        settled = true;
        cleanup();
        resolve(result);
      }
    };

    const fail = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    jsonSocket.on('connect', () => {
      result.jsonConnected = true;
      if (options.sendStop) {
        jsonSocket.emit('json', { T: movementCommand, L: 0, R: 0 });
        result.stopSent = true;
      }
      if (options.nudge) {
        const speed = options.nudgeSpeed;
        jsonSocket.emit('json', { T: movementCommand, L: speed, R: speed });
        result.nudgeSent = true;
        setTimeout(() => {
          jsonSocket.emit('json', { T: movementCommand, L: 0, R: 0 });
          result.stopSent = true;
          result.nudgeStopSent = true;
          maybeResolve();
        }, options.nudgeDurationMs);
      }
      maybeResolve();
    });

    ctrlSocket.on('connect', () => {
      result.ctrlConnected = true;
      ctrlSocket.emit('request_data');
    });

    ctrlSocket.on('update', (data) => {
      result.telemetry = decodeTelemetry(data, telemetryKeys);
      result.rawKeys = Object.keys(data).sort();
      maybeResolve();
    });

    jsonSocket.on('connect_error', fail);
    ctrlSocket.on('connect_error', fail);
  });
}

function decodeTelemetry(data, keys) {
  const rawBattery = data[keys.batteryVoltage];
  return {
    batteryVoltage: typeof rawBattery === 'number' && rawBattery > 100 ? rawBattery / 100 : rawBattery,
    batteryRaw: rawBattery,
    wifiRssi: data[keys.wifiRssi],
    cpuTemp: data[keys.cpuTemp],
    cpuLoad: data[keys.cpuLoad],
    ramUsage: data[keys.ramUsage],
    videoFps: data[keys.videoFps],
    feedbackFlag: data[keys.feedbackFlag],
    trackLeft: data[keys.trackLeft],
    trackRight: data[keys.trackRight],
    baseLight: data[keys.baseLight],
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const startedAt = new Date().toISOString();
  const indexResponse = await fetch(options.host, { signal: AbortSignal.timeout(options.timeoutMs) });
  const title = /<title>(.*?)<\/title>/i.exec(await indexResponse.text())?.[1] ?? null;
  const server = indexResponse.headers.get('server');
  const configText = await fetchText(`${options.host}/config`, options.timeoutMs);
  const config = parseSimpleYaml(configText);
  const socketResult = await connectAndRead({ createSocket: createSocketClient, host: options.host, config, options });

  console.log(JSON.stringify({
    host: options.host,
    checkedAt: startedAt,
    http: {
      status: indexResponse.status,
      server,
      title,
      robotName: config.base_config?.robot_name,
      sbcVersion: config.base_config?.sbc_version,
    },
    control: {
      jsonConnected: socketResult.jsonConnected,
      ctrlConnected: socketResult.ctrlConnected,
      stopSent: socketResult.stopSent,
      nudgeSent: socketResult.nudgeSent,
      nudgeStopSent: socketResult.nudgeStopSent,
      movementCommand: config.cmd_config?.cmd_movition_ctrl ?? 1,
    },
    telemetry: socketResult.telemetry,
    rawTelemetryKeys: socketResult.rawKeys,
  }, null, 2));
}

main().catch((error) => {
  console.error(`BEAST probe failed: ${error.message}`);
  process.exit(1);
});
