const { SerialPort } = require('serialport');
const {
    getPluginsWss,
    emitPluginEvent,
    onPluginEvent,
    getServerConfig
} = require('../server/plugins_api');

let port = null;
let currentAzimuth = 0;
let targetAzimuth = null;
let pollingInterval = null;
let reconnectInterval = null;
let lastRotorSerialResponseTime = 0;

/* ---------------- CONFIG ---------------- */

const pluginConfig = {
    name: 'Rotor control',
    version: '1.0',
    author: 'Noobish',
    frontEndPath: 'rotor/frontend.js'
};

let serialPortPath = "/dev/ttyUSB0";

const SERIAL_TIMEOUT = 5000;
const RECONNECT_INTERVAL = 5000;
const TARGET_REACHED_TOLERANCE = 3;

/* ---------------- SERIAL ---------------- */

function initSerial(path, baudRate = 9600) {
    if (port) {
        try { port.close(); } catch {}
    }

    port = new SerialPort({ path, baudRate });

    port.on('open', () => {
        console.log('[Rotor] Serial connected');

        lastRotorSerialResponseTime = Date.now();

        startPolling();
        startReconnectWatchdog();
    });

    let serialBuffer = '';

    port.on('data', (data) => {

        // Any received data means the serial connection is alive
        lastRotorSerialResponseTime = Date.now();

        // Append incoming chunk
        serialBuffer += data.toString();

        // Process all complete messages
        while (serialBuffer.includes('\r')) {

            const endIndex = serialBuffer.indexOf('\r');

            const line = serialBuffer
                .slice(0, endIndex)
                .trim();

            // Remove processed line from buffer
            serialBuffer = serialBuffer.slice(endIndex + 1);

            if (!line) continue;

            console.log('[Rotor RX]', line);

            if (line.startsWith('AZ=')) {
                const azimuth = Number(line.substring(3));

            if (!Number.isNaN(azimuth)) {
                currentAzimuth = ((azimuth % 360) + 360) % 360;

                // If we have a requested target and the rotor has actually reached it, remove the target indication (that's the dashed line).
                if (
                    targetAzimuth !== null &&
                    angularDifference(currentAzimuth, targetAzimuth) <= TARGET_REACHED_TOLERANCE
                ) {
                    console.log(
                        `[Rotor] Target reached: ${targetAzimuth}° (actual: ${currentAzimuth}°)`
                    );

                    targetAzimuth = null;
                }

                broadcastState();

                console.log('[Rotor] Confirmed azimuth:', currentAzimuth);
            }
            }
            else {
                console.warn('[Rotor] Unexpected response:', line);
            }
        }
    });

    port.on('error', (err) => {
        console.error('[Rotor] Serial error:', err.message);
    });

    port.on('close', () => {
        console.warn('[Rotor] Serial port closed');

        stopPolling();
    });
}

/* ---------------- POLLING ---------------- */

function startPolling() {
    if (pollingInterval) clearInterval(pollingInterval);

    pollingInterval = setInterval(() => {
        if (!port?.isOpen) return;

        port.write('C\r');
    }, 1000);
}

function stopPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
}

/* ---------------- RECONNECT ---------------- */

function startReconnectWatchdog() {
    if (reconnectInterval) clearInterval(reconnectInterval);

    reconnectInterval = setInterval(() => {

        if (!port?.isOpen) {
            reconnectSerial();
            return;
        }

        if (Date.now() - lastRotorSerialResponseTime > SERIAL_TIMEOUT) {
            console.warn('[Rotor] No serial data for 5 seconds');
            reconnectSerial();
        }

    }, RECONNECT_INTERVAL);
}

function reconnectSerial() {
    console.log('[Rotor] Reconnecting serial...');

    try {
        if (port) {
            port.close();
        }
    } catch {}

    port = null;

    setTimeout(() => {
        initSerial(serialPortPath, 9600);
    }, 100);
}

/* ---------------- COMMANDS ---------------- */

function setAzimuth(value) {
    if (!port?.isOpen) return;

    const az = ((value % 360) + 360) % 360;
    targetAzimuth = az;

    const cmd = `M${az.toString().padStart(3, '0')}\r`;

    port.write(cmd);

    broadcastState();

    //console.log(`[Rotor] Target set: ${targetAzimuth}°, confirmed: ${currentAzimuth}°`);
}

function stopRotor() {
    if (!port?.isOpen) return;
    port.write('S\r');
}

/* ---------------- BROADCAST (API VERSION) ---------------- */

function broadcastState() {
    emitPluginEvent('rotor:update', {
        azimuth: currentAzimuth,
        targetAzimuth: targetAzimuth
    });
}

/* ---------------- PLUGIN ENTRY ---------------- */

function initRotor() {
    const pluginsWss = getPluginsWss();

    if (!pluginsWss) {
        console.warn('[Rotor] pluginsWss not available yet');
        return;
    }

    // AUTO START HERE
    initSerial(serialPortPath, 9600);

    pluginsWss.on('connection', (ws, req) => {

        ws.on('message', (message) => {
            let msg;
            try {
                msg = JSON.parse(message);
            } catch {
                return;
            }

            const isAdminClient = req.session?.isAdminAuthenticated;
            if (!isAdminClient) return;

            if (msg.type === 'rotor:set') {
                setAzimuth(msg.azimuth);
            }

            if (msg.type === 'rotor:stop') {
                stopRotor();
            }
        });

        ws.send(JSON.stringify({
            type: 'rotor:init',
            value: {
                azimuth: currentAzimuth,
                targetAzimuth: targetAzimuth
            }
        }));
    });
}

/* --------------  Angular difference calc --------------*/
function angularDifference(a, b) {
    return Math.abs(((a - b + 540) % 360) - 180);
}

setTimeout(initRotor, 5000);


module.exports = {
    pluginConfig
};