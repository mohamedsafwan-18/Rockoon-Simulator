import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import net from 'node:net';

const SERVER_IP = '172.16.59.95';
const PORT = 65432;
const PING_INTERVAL_MS = 500; // 0.5 seconds constant ping

// Shared state for the constant 0.5s TCP socket pinger
let latestSocketPayload = {
  event: 'device_handshake',
  device_id: 'client_node_01',
  status: 'prelaunch',
  is_paused: false,
  is_resumed: false,
  simulation_state: {
    status: 'PRELAUNCH',
    is_running: false,
    is_paused: false,
    is_resumed: false,
    last_action: 'INITIALIZED',
    pause_count: 0,
    resume_count: 0,
  },
  payload: {
    temperature: 15.0,
    status: 'prelaunch',
    is_paused: false,
    is_resumed: false,
  },
};

const tcpStats = {
  serverIp: SERVER_IP,
  port: PORT,
  intervalMs: PING_INTERVAL_MS,
  pingCount: 0,
  totalPingsSent: 0,
  ackCount: 0,
  lastPingTimeIso: null,
  lastAck: null,
  status: 'PINGING_0.5S',
  lastStatus: 'CONNECTING',
  lastError: null,
};

let persistentSock = null;
let isConnectingOrSending = false;

/**
 * Send JSON over raw TCP socket to 172.16.59.95:65432 using exact 4-byte Big-Endian (!I) length header
 * Matches Python: header = struct.pack("!I", len(payload_bytes)); sock.sendall(header + payload_bytes)
 */
function sendJsonToTcpServer(payloadDict) {
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
        tcpStats.lastStatus = 'CONNECTED_ACK';
        tcpStats.lastError = null;
        cleanupListeners();
        isConnectingOrSending = false;
      }
    };

    const onError = (err) => {
      tcpStats.lastStatus = 'RETRYING_PING';
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
    tcpStats.lastStatus = 'PING_TIMEOUT_RETRYING';
    tcpStats.lastError = `Timeout pinging ${SERVER_IP}:${PORT}`;
    sock.destroy();
    if (persistentSock === sock) persistentSock = null;
    isConnectingOrSending = false;
  });

  sock.on('error', (err) => {
    tcpStats.lastStatus = 'RETRYING_PING';
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
      // Start constant 0.5-second (500ms) uninterrupted TCP pinger to 172.16.59.95:65432
      if (!pingTimer) {
        pingTimer = setInterval(() => {
          sendJsonToTcpServer(latestSocketPayload);
        }, PING_INTERVAL_MS);
      }

      server.middlewares.use('/api/tcp-ping', (req, res) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk.toString();
          });
          req.on('end', () => {
            try {
              const incoming = JSON.parse(body);
              latestSocketPayload = incoming;
              // Trigger immediate TCP send on 0.5s sync
              sendJsonToTcpServer(latestSocketPayload);
            } catch {
              // ignore malformed JSON
            }
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true, tcpStats }));
          });
          return;
        }

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, tcpStats, latestSocketPayload }));
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

