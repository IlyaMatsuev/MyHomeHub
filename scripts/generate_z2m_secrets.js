#!/usr/bin/env node

/**
 * Prepares Zigbee2MQTT to run against the local MQTT broker:
 *   - validates required Z2M_* / MQTT_* variables in .env
 *   - generates network_key, pan_id, and ext_pan_id when their value is `GENERATE`, then writing the generated values back to .env;
 *   - renders configs/zigbee2mqtt/configuration.example.yaml into configs/zigbee2mqtt/configuration.yaml with the resolved values;
 *   - ensures Z2M_MQTT_USERNAME has an entry in configs/mqtt/pwfile by invoking `npm run mqtt:user:new` when it does not.
 *
 * Invoked by the `zigbee:start` / `zigbee:restart` npm scripts.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const child_process = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const ENV_FILE = path.join(ROOT, '.env');
const ENV_RELATIVE_FILE = path.relative(ROOT, ENV_FILE);
const Z2M_TEMPLATE_FILE = path.join(ROOT, 'configs/zigbee2mqtt/configuration.example.yaml');
const Z2M_CONFIG_FILE = path.join(ROOT, 'configs/zigbee2mqtt/configuration.yaml');
const MQTT_PWFILE = path.join(ROOT, 'configs/mqtt/pwfile');
const CREATE_MQTT_USER_NPM_SCRIPT = 'mqtt:user:new';

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
const STRING_VARS = new Set(['Z2M_MQTT_BASE_TOPIC', 'Z2M_MQTT_USERNAME', 'Z2M_MQTT_PASSWORD']);
const RESERVED_PAN_IDS = [0, 0xffff];

main();

function main() {
    if (!fs.existsSync(ENV_FILE)) {
        fail(`.env file does not exist at ${ENV_RELATIVE_FILE}`);
    }
    if (!fs.existsSync(Z2M_TEMPLATE_FILE)) {
        fail(`template file does not exist at ${path.relative(ROOT, Z2M_TEMPLATE_FILE)}`);
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

    const substitutions = {
        MQTT_SERVER_URL: yamlString(`mqtt://${resolved.MQTT_DOMAIN}:${resolved.MQTT_PORT}`),
    };
    for (const name of REQUIRED_VARS) {
        substitutions[name] = STRING_VARS.has(name) ? yamlString(resolved[name]) : resolved[name];
    }

    const rendered = renderTemplate(fs.readFileSync(Z2M_TEMPLATE_FILE, 'utf8'), substitutions);

    fs.mkdirSync(path.dirname(Z2M_CONFIG_FILE), { recursive: true });
    fs.writeFileSync(Z2M_CONFIG_FILE, rendered);

    console.log(`Rendered ${path.relative(ROOT, Z2M_CONFIG_FILE)} from ${path.relative(ROOT, Z2M_TEMPLATE_FILE)}`);
    if (Object.keys(envUpdates).length) {
        console.log(`Z2M variables (${Object.keys(envUpdates).join(', ')}) have been generated and written back to ${ENV_RELATIVE_FILE}`);
    }

    ensureMqttUser(resolved.Z2M_MQTT_USERNAME, resolved.Z2M_MQTT_PASSWORD);
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

function renderTemplate(template, substitutions) {
    return template.replace(/__([A-Z0-9_]+?)__/g, (_, name) => {
        if (!(name in substitutions)) {
            fail(`template references unknown placeholder '${name}'`);
        }
        return substitutions[name];
    });
}

function ensureMqttUser(username, password) {
    if (mqttPwfileHasUser(username)) {
        return;
    }

    const pwfileRelative = path.relative(ROOT, MQTT_PWFILE);
    console.log(`MQTT user '${username}' not found in ${pwfileRelative}, creating via 'npm run ${CREATE_MQTT_USER_NPM_SCRIPT}'...`);

    const result = child_process.spawnSync('npm', ['run', CREATE_MQTT_USER_NPM_SCRIPT, '--', username, password], { stdio: 'inherit' });
    if (result.error) {
        fail(`failed to run 'npm run ${CREATE_MQTT_USER_NPM_SCRIPT}': ${result.error.message}`);
    }
    if (result.status !== 0) {
        fail(`failed to create MQTT user '${username}' (exit code ${result.status})`);
    }
}

function mqttPwfileHasUser(username) {
    if (!fs.existsSync(MQTT_PWFILE)) {
        return false;
    }
    const content = fs.readFileSync(MQTT_PWFILE, 'utf8');
    return content.split('\n').some(line => {
        const colonIndex = line.indexOf(':');
        if (colonIndex < 0) {
            return false;
        }
        return line.slice(0, colonIndex) === username;
    });
}
