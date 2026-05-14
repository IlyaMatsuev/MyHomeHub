#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const ENV_FILE = path.join(ROOT, '.env');
const ENV_RELATIVE_FILE = path.relative(ROOT, ENV_FILE);
const Z2M_SECRET_FILE = path.join(ROOT, 'configs/zigbee2mqtt/secret.yaml');

const REQUIRED_VARS = [
    'MQTT_DOMAIN',
    'MQTT_PORT',
    'Z2M_MQTT_BASE_TOPIC',
    'Z2M_MQTT_USERNAME',
    'Z2M_MQTT_PASSWORD',
    'Z2M_NETWORK_KEY',
    'Z2M_PAN_ID',
    'Z2M_EXT_PAN_ID',
];
const RESERVED_PAN_IDS = [0, 0xffff];

main();

function main() {
    if (!fs.existsSync(ENV_FILE)) {
        fail(`.env file does not exist at ${ENV_RELATIVE_FILE}`);
    }

    const env = parseEnv(fs.readFileSync(ENV_FILE, 'utf8'));

    const missing = REQUIRED_VARS.filter(name => !env.vars[name] || env.vars[name].value === '');
    if (missing.length) {
        fail(`missing required variable(s) in .env: ${missing.join(', ')}`);
    }

    const generators = {
        Z2M_NETWORK_KEY: () => randomByteList(16),
        Z2M_PAN_ID: () => randomPanId(),
        Z2M_EXT_PAN_ID: () => randomByteList(8),
    };

    const envUpdates = {};
    const resolved = {};
    for (const name of REQUIRED_VARS) {
        let value = env.vars[name].value;
        if (value === 'GENERATE') {
            if (!generators[name]) {
                fail(`${name} is set to GENERATE but no generator is defined for it`);
            }
            value = generators[name]();
            envUpdates[name] = value;
        }
        resolved[name] = value;
    }

    if (Object.keys(envUpdates).length) {
        const newLines = [...env.lines];
        for (const [name, value] of Object.entries(envUpdates)) {
            newLines[env.vars[name].lineIndex] = `${name}=${value}`;
        }
        fs.writeFileSync(ENV_FILE, newLines.join('\n'));
    }

    const secretYaml =
        `mqtt_base_topic: ${yamlString(resolved.Z2M_MQTT_BASE_TOPIC)}\n` +
        `mqtt_server: ${yamlString(`mqtt://${resolved.MQTT_DOMAIN}:${resolved.MQTT_PORT}`)}\n` +
        `mqtt_user: ${yamlString(resolved.Z2M_MQTT_USERNAME)}\n` +
        `mqtt_password: ${yamlString(resolved.Z2M_MQTT_PASSWORD)}\n` +
        `\n` +
        `network_key: ${resolved.Z2M_NETWORK_KEY}\n` +
        `pan_id: ${resolved.Z2M_PAN_ID}\n` +
        `ext_pan_id: ${resolved.Z2M_EXT_PAN_ID}\n`;

    fs.mkdirSync(path.dirname(Z2M_SECRET_FILE), { recursive: true });
    fs.writeFileSync(Z2M_SECRET_FILE, secretYaml);

    console.log(`Updated ${path.relative(ROOT, Z2M_SECRET_FILE)} with the secrets from ${ENV_RELATIVE_FILE}`);
    if (Object.keys(envUpdates).length) {
        console.log(`Z2M variables (${Object.keys(envUpdates).join(', ')}) have been generated and written back to ${ENV_RELATIVE_FILE}`);
    }
}

function fail(message) {
    console.error(`Error: ${message}`);
    process.exit(1);
}

function parseEnv(content) {
    const lines = content.split('\n');
    const vars = lines.reduce((vars, line, i) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
            return vars;
        }

        const [key, value] = trimmed.split('=');
        if (!key) {
            return vars;
        }

        vars[key] = { value: value ?? '', lineIndex: i };
        return vars;
    }, {});
    return { vars, lines };
}

function randomByteList(count) {
    const bytes = Array.from(crypto.randomBytes(count)).map(b => `0x${b.toString(16).padStart(2, '0')}`);
    return `[${bytes.join(',')}]`;
}

function randomPanId() {
    while (true) {
        const byte = crypto.randomBytes(2).readUInt16BE(0);
        if (!RESERVED_PAN_IDS.includes(byte)) {
            return `0x${byte.toString(16).padStart(4, '0')}`;
        }
    }
}

function yamlString(value) {
    return `'${value.replace(/'/g, "''")}'`;
}
