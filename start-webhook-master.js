#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const Logger = require('./src/core/logger');
const { createMasterServer } = require('./src/server/master-webhook');
const crypto = require('crypto');

const logger = new Logger('Webhook-Master-Server');
const envPath = path.join(__dirname, '.env');
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

const port = parseInt(process.env.WEBHOOK_PORT, 10) || 3001;
const { app, telegram } = createMasterServer();

async function setTelegramWebhook() {
    if (!telegram) return;
    const baseUrl = process.env.WEBHOOK_BASE_URL;
    if (!baseUrl) {
        logger.warn('WEBHOOK_BASE_URL not set. Please set the webhook manually.');
        return;
    }

    const webhookEndpoint = process.env.APP_SECRET
        ? `${baseUrl}/webhook/telegram/${process.env.APP_SECRET}`
        : `${baseUrl}/webhook/telegram`;

    logger.info(`Setting Telegram webhook to: ${webhookEndpoint}`);
    let attempts = 0;
    while (attempts < 3) {
        try {
            await telegram.setWebhook(webhookEndpoint);
            return;
        } catch (error) {
            attempts += 1;
            const retryAfter = error?.response?.data?.parameters?.retry_after;
            if (error?.response?.data?.error_code === 429 && retryAfter) {
                logger.warn(`Telegram rate limit, retrying after ${retryAfter}s...`);
                await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
                continue;
            }
            const detail = {
                status: error.response?.status,
                data: error.response?.data,
                message: error.message,
                code: error.code
            };
            logger.error('Failed to set Telegram webhook:', detail);
            return;
        }
    }
}

app.listen(port, () => {
    logger.info(`Webhook master server started on port ${port}`);
    setTelegramWebhook();
});
