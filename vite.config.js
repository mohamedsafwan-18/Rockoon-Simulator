import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';

const SERVER_IP = '10.110.76.5';
const PORT = 65431;
const PING_INTERVAL_MS = 500; // 0.5 seconds constant ping

let latestPingPausedJson = {
  ping_paused: 0,
  'ping paused': 0,
};

function syncPingPausedJsonFile(val) {
  const numVal = val ? 1 : 0;
  if (latestPingPausedJson.ping_paused !== numVal) {
    latestPingPausedJson = {
      ping_paused: numVal,
      'ping paused': numVal,
    };
    try {
      fs.writeFileSync(
        path.resolve(process.cwd(), 'ping_paused.json'),
        JSON.stringify(latestPingPausedJson, null, 2),
        'utf-8'
      );
    } catch {
      // ignore fs write errors
    }
  }
}

// Initialize ping_paused.json with 0 on startup
try {
  fs.writeFileSync(
    path.resolve(process.cwd(), 'ping_paused.json'),
    JSON.stringify(latestPingPausedJson, null, 2),
    'utf-8'
  );
} catch {
  // ignore
}

// Shared state for the constant 0.5s TCP socket pinger
let latestSocketPayload = {
  event: 'device_handshake',
  device_id: 'client_node_01',
  ping_paused: 0,
  'ping paused': 0,
  status: 'prelaunch',
  is_paused: false,
  is_resumed: false,
  simulation_state: {
    status: 'PRELAUNCH',
    is_running: false,
    is_paused: false,
    is_resumed: false,
    ping_paused: 0,
    'ping paused': 0,
    last_action: 'INITIALIZED',
    pause_count: 0,
    resume_count: 0,
  },
  payload: {
    temperature: 15.0,
    status: 'prelaunch',
    ping_paused: 0,
    'ping paused': 0,
    is_paused: false,
    is_resumed: false,
  },
};

const tcpStats = {
  serverIp: SERVER_IP,
  port: PORT,
  intervalMs: PING_INTERVAL_MS,
  isPinging: true,
  pingPaused: 0,
  pingCount: 0,
  totalPingsSent: 0,
  ackCount: 0,
  lastPingTimeIso: null,
  lastAck: null,
  status: 'PINGING_0.5S',
  lastStatus: 'CONNECTING',
  lastError: null,
};

let isPingingEnabled = true;
let persistentSock = null;
let isConnectingOrSending = false;

function stopTcpPinger() {
  isPingingEnabled = false;
  tcpStats.isPinging = false;
  tcpStats.status = 'PING_STOPPED';
  tcpStats.lastStatus = 'STOPPED';
  isConnectingOrSending = false;
  if (persistentSock) {
    try {
      persistentSock.destroy();
    } catch {
      // ignore
    }
    persistentSock = null;
  }
}

function startTcpPinger(payloadDict) {
  isPingingEnabled = true;
  tcpStats.isPinging = true;
  tcpStats.status = 'PINGING_0.5S';
  tcpStats.lastStatus = 'CONNECTING';
  if (payloadDict) {
    latestSocketPayload = payloadDict;
  }
  sendJsonToTcpServer(latestSocketPayload);
}

/**
 * Send JSON over raw TCP socket to 172.16.59.95:65432 using exact 4-byte Big-Endian (!I) length header
 * Matches Python: header = struct.pack("!I", len(payload_bytes)); sock.sendall(header + payload_bytes)
 */
function sendJsonToTcpServer(payloadDict) {
  if (!isPingingEnabled) return;
  tcpStats.pingCount += 1;
  tcpStats.totalPingsSent = tcpStats.pingCount;
  tcpStats.lastPingTimeIso = new Date().toISOString();
  if (isConnectingOrSending) return;
  isConnectingOrSending = true;

  const payloadBytes = Buffer.from(JSON.stringify(payloadDict), 'utf-8');
  const header = Buffer.alloc(4);
  header.writeUInt32BE(payloadBytes.length, 0); // "!I" Big-Endian unsigned 32-bit int
  const packetBuffer = Buffer.concat([header, payloadBytes]);

  const transmitOnSocket = (sock) => {
    let rxBuffer = Buffer.alloc(0);
    let expectedAckLen = null;

    const cleanupListeners = () => {
      sock.removeListener('data', onData);
      sock.removeListener('error', onError);
    };

    const onData = (chunk) => {
      rxBuffer = Buffer.concat([rxBuffer, chunk]);
      if (expectedAckLen === null && rxBuffer.length >= 4) {
        expectedAckLen = rxBuffer.readUInt32BE(0);
        rxBuffer = rxBuffer.subarray(4);
      }
      if (expectedAckLen !== null && rxBuffer.length >= expectedAckLen) {
        const respBytes = rxBuffer.subarray(0, expectedAckLen);
        try {
          tcpStats.lastAck = JSON.parse(respBytes.toString('utf-8'));
        } catch {
          tcpStats.lastAck = respBytes.toString('utf-8');
        }
        tcpStats.ackCount += 1;
        tcpStats.status = 'CONNECTED_ACK';
        tcpStats.lastStatus = 'CONNECTED_ACK';
        tcpStats.lastError = null;
        cleanupListeners();
        isConnectingOrSending = false;
      }
    };

    const onError = (err) => {
      if (isPingingEnabled) {
        tcpStats.status = 'PINGING_0.5S';
        tcpStats.lastStatus = 'RETRYING_PING';
      }
      tcpStats.lastError = err.message || 'TCP socket unreachable';
      cleanupListeners();
      if (persistentSock === sock) {
        persistentSock.destroy();
        persistentSock = null;
      }
      isConnectingOrSending = false;
    };

    sock.on('data', onData);
    sock.once('error', onError);

    try {
      sock.write(packetBuffer, (writeErr) => {
        if (writeErr) {
          onError(writeErr);
        } else {
          if (tcpStats.lastStatus !== 'CONNECTED_ACK') {
            tcpStats.lastStatus = 'SENT_AWAITING_ACK';
          }
          // Release lock after 420ms if server doesn't send ACK so next 0.5s ping is never blocked
          setTimeout(() => {
            if (isConnectingOrSending) {
              cleanupListeners();
              isConnectingOrSending = false;
            }
          }, 420);
        }
      });
    } catch (e) {
      onError(e);
    }
  };

  if (persistentSock && !persistentSock.destroyed && persistentSock.writable) {
    transmitOnSocket(persistentSock);
    return;
  }

  const sock = new net.Socket();
  sock.setTimeout(450);

  sock.connect(PORT, SERVER_IP, () => {
    persistentSock = sock;
    tcpStats.lastStatus = 'CONNECTED';
    tcpStats.lastError = null;
    transmitOnSocket(sock);
  });

  sock.on('timeout', () => {
    if (isPingingEnabled) {
      tcpStats.lastStatus = 'PING_TIMEOUT_RETRYING';
    }
    tcpStats.lastError = `Timeout pinging ${SERVER_IP}:${PORT}`;
    sock.destroy();
    if (persistentSock === sock) persistentSock = null;
    isConnectingOrSending = false;
  });

  sock.on('error', (err) => {
    if (isPingingEnabled) {
      tcpStats.lastStatus = 'RETRYING_PING';
    }
    tcpStats.lastError = err.message;
    sock.destroy();
    if (persistentSock === sock) persistentSock = null;
    isConnectingOrSending = false;
  });

  sock.on('close', () => {
    if (persistentSock === sock) persistentSock = null;
    isConnectingOrSending = false;
  });
}

function sbrlTcpSocketRelayPlugin() {
  let pingTimer = null;

  return {
    name: 'sbrl-tcp-socket-relay',
    configureServer(server) {
      // Start 0.5-second (500ms) TCP pinger to 172.16.59.95:65432 when isPingingEnabled is true
      if (!pingTimer) {
        pingTimer = setInterval(() => {
          if (isPingingEnabled) {
            sendJsonToTcpServer(latestSocketPayload);
          }
        }, PING_INTERVAL_MS);
      }

      server.middlewares.use('/api/ping-paused', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(latestPingPausedJson, null, 2));
      });

      server.middlewares.use('/api/tcp-ping', (req, res) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk.toString();
          });
          req.on('end', () => {
            try {
              const incoming = JSON.parse(body);
              if (incoming?.action === 'stop' || incoming?.simulation_state?.is_pinging === false) {
                syncPingPausedJsonFile(0);
                tcpStats.pingPaused = 0;
                stopTcpPinger();
              } else if (incoming?.action === 'start') {
                const payload = incoming.payload || latestSocketPayload;
                const pVal = payload?.ping_paused ? 1 : 0;
                syncPingPausedJsonFile(pVal);
                tcpStats.pingPaused = pVal;
                startTcpPinger(payload);
              } else if (incoming?.action === 'stop_ping_10s') {
                const payload = incoming.payload || latestSocketPayload;
                syncPingPausedJsonFile(1);
                tcpStats.pingPaused = 1;
                startTcpPinger(payload);
              } else {
                const pVal = incoming?.ping_paused ? 1 : 0;
                syncPingPausedJsonFile(pVal);
                tcpStats.pingPaused = pVal;
                latestSocketPayload = incoming;
                if (isPingingEnabled) {
                  sendJsonToTcpServer(latestSocketPayload);
                }
              }
            } catch {
              // ignore malformed JSON
            }
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true, tcpStats, pingPausedJson: latestPingPausedJson }));
          });
          return;
        }

        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            ok: true,
            tcpStats,
            pingPausedJson: latestPingPausedJson,
            latestSocketPayload,
          })
        );
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    sbrlTcpSocketRelayPlugin(),
  ],
});

