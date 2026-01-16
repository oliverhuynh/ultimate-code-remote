#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');
const dotenv = require('dotenv');
const Logger = require('../src/core/logger');
const { enforceAllowedUrl } = require('../src/utils/outbound-allowlist');
const crypto = require('crypto');

const logger = new Logger('NgrokLauncher');
const envPath = path.join(__dirname, '..', '.env');

if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
}

function generateAppSecret() {
    const raw = crypto.randomBytes(24);
    return raw.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function ensureAppSecret() {
    if (process.env.APP_SECRET && process.env.APP_SECRET.trim()) {
        return process.env.APP_SECRET.trim();
    }

    const secret = generateAppSecret();
    process.env.APP_SECRET = secret;
    logger.info(`APP_SECRET generated for this session: ${secret}`);
    return secret;
}

ensureAppSecret();

const PORT = parseInt(process.env.WEBHOOK_PORT || process.env.TELEGRAM_WEBHOOK_PORT || '3001', 10);
const NGROK_BIN = process.env.NGROK_BIN || 'ngrok';

function updateEnvWebhook(url) {
    const lines = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8').split(/\r?\n/) : [];
    let found = false;
    const next = lines.map((line) => {
        if (line.startsWith('WEBHOOK_BASE_URL=') || line.startsWith('# WEBHOOK_BASE_URL=')) {
            found = true;
            return `WEBHOOK_BASE_URL=${url}`;
        }
        return line;
    });
    if (!found) {
        next.push(`WEBHOOK_BASE_URL=${url}`);
    }
    fs.writeFileSync(envPath, next.join('\n'));
}

function getNgrokUrl() {
    return new Promise((resolve, reject) => {
        enforceAllowedUrl('http://127.0.0.1:4040/api/tunnels');
        const req = http.get('http://127.0.0.1:4040/api/tunnels', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk.toString());
            res.on('end', () => {
                try {
                    const payload = JSON.parse(data);
                    const tunnel = payload.tunnels.find(t => t.proto === 'https');
                    if (!tunnel) {
                        reject(new Error('No https ngrok tunnel found'));
                        return;
                    }
                    resolve(tunnel.public_url);
                } catch (error) {
                    reject(error);
                }
            });
        });
        req.on('error', reject);
    });
}

async function waitForNgrokUrl(retries = 30, delayMs = 500) {
    for (let i = 0; i < retries; i++) {
        try {
            const url = await getNgrokUrl();
            return url;
        } catch (error) {
            await new Promise(r => setTimeout(r, delayMs));
        }
    }
    throw new Error('Timed out waiting for ngrok URL');
}

function startNgrok() {
    logger.info(`Starting ngrok on port ${PORT}...`);
    const child = spawn(NGROK_BIN, ['http', String(PORT)], {
        stdio: 'ignore'
    });
    child.on('error', (error) => {
        logger.error(`Failed to start ngrok: ${error.message}`);
    });
    return child;
}

function startUltimate() {
    const scriptPath = path.join(__dirname, 'ultimate-code-remote.js');
    logger.info('Starting ultimate-code-remote...');
    const child = spawn(process.execPath, [scriptPath, 'webhooks'], {
        stdio: 'inherit',
        env: process.env
    });
    child.on('error', (error) => {
        logger.error(`Failed to start ultimate-code-remote: ${error.message}`);
    });
    return child;
}

function setTelegramWebhook(url) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return Promise.resolve();

    const https = require('https');
    const secret = process.env.APP_SECRET;
    const endpoint = secret ? `${url}/webhook/telegram/${secret}` : `${url}/webhook/telegram`;
    const payload = JSON.stringify({
        url: endpoint,
        secret_token: secret || undefined
    });
    const options = {
        method: 'POST',
        hostname: 'api.telegram.org',
        path: `/bot${token}/setWebhook`,
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
        }
    };

    return new Promise((resolve, reject) => {
        enforceAllowedUrl('https://api.telegram.org/bot/setWebhook');
        const req = https.request(options, (res) => {
            res.on('data', () => {});
            res.on('end', resolve);
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

async function run() {
    const ngrokProc = startNgrok();
    const url = await waitForNgrokUrl();

    logger.info(`Ngrok URL: ${url}`);
    updateEnvWebhook(url);
    logger.info('Updated WEBHOOK_BASE_URL in .env');
    process.env.WEBHOOK_BASE_URL = url;

    await setTelegramWebhook(url);
    logger.info('Telegram webhook updated');

    const ucrProc = startUltimate();

    const shutdown = () => {
        logger.info('Shutting down...');
        ngrokProc.kill('SIGINT');
        ucrProc.kill('SIGINT');
        process.stdout.write('\x1bc');
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

run().catch((error) => {
    logger.error(error.message);
    process.exit(1);
});
