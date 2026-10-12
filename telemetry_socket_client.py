import socket
import json
import struct
import time
import urllib.request

SERVER_IP = "172.16.59.95"  # Set to the actual LAN IP of the server machine
PORT = 65432
PING_INTERVAL_SECONDS = 0.5  # Ping every 0.5 seconds without interruption
SIMULATOR_API_URL = "http://localhost:5173/api/tcp-ping"


def send_json(sock, payload_dict):
    payload_bytes = json.dumps(payload_dict).encode("utf-8")

    # Pack payload length into 4 bytes (Big-Endian unsigned int)
    header = struct.pack("!I", len(payload_bytes))

    # Send both header and payload together
    sock.sendall(header + payload_bytes)


def receive_exact(sock, num_bytes):
    buffer = bytearray()
    while len(buffer) < num_bytes:
        packet = sock.recv(num_bytes - len(buffer))
        if not packet:
            return None
        buffer.extend(packet)
    return bytes(buffer)


def get_live_simulation_payload(seq_num):
    """Fetch latest live telemetry & pause/resume JSON from the running SBRL simulator, or fallback."""
    try:
        req = urllib.request.Request(SIMULATOR_API_URL, method="GET")
        with urllib.request.urlopen(req, timeout=0.25) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if "latestPayload" in data and data["latestPayload"]:
                return data["latestPayload"]
    except Exception:
        pass

    return {
        "event": "device_handshake",
        "device_id": "client_node_01",
        "ping_sequence": seq_num,
        "ping_interval_seconds": PING_INTERVAL_SECONDS,
        "payload": {
            "temperature": 27.4,
            "status": "active",
            "simulation_state": {
                "status": "RUNNING",
                "is_running": True,
                "is_paused": False,
                "is_resumed": False,
                "pause_count": 0,
                "resume_count": 0,
                "last_action": "STREAMING_0.5S",
            },
        },
    }


def start_client():
    seq = 0
    print(f"Starting uninterrupted 0.5s JSON telemetry pinger to {SERVER_IP}:{PORT}...")
    while True:
        cycle_start = time.time()
        seq += 1
        message = get_live_simulation_payload(seq)

        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
                sock.settimeout(0.45)
                print(f"[{seq}] Connecting to {SERVER_IP}:{PORT}...")
                sock.connect((SERVER_IP, PORT))

                print(f"[{seq}] Sending JSON (sim_state={message.get('payload', {}).get('simulation_state', {}).get('status', 'active')})...")
                send_json(sock, message)

                # Receive ACK response
                raw_len = receive_exact(sock, 4)
                if raw_len:
                    resp_len = struct.unpack("!I", raw_len)[0]
                    resp_bytes = receive_exact(sock, resp_len)
                    if resp_bytes:
                        response = json.loads(resp_bytes.decode("utf-8"))
                        print(f"[{seq}] Server ACK: {response}")
        except Exception as err:
            print(f"[{seq}] Ping attempt to {SERVER_IP}:{PORT} ({err}) — continuing uninterrupted in 0.5s...")

        elapsed = time.time() - cycle_start
        sleep_time = max(0.0, PING_INTERVAL_SECONDS - elapsed)
        time.sleep(sleep_time)


if __name__ == "__main__":
    start_client()
