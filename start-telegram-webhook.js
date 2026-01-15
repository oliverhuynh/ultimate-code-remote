#!/usr/bin/env node

/**
 * Telegram Webhook Server
 * Starts the Telegram webhook server for receiving messages
 */

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const crypto = require('crypto');
const Logger = require('./src/core/logger');
const TelegramWebhookHandler = require('./src/channels/telegram/webhook');

// Load environment variables
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
    console.log(`🔐 APP_SECRET generated for this session: ${secret}`);
    return secret;
}

const logger = new Logger('Telegram-Webhook-Server');
ensureAppSecret();

// Load configuration
const config = {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID,
    groupId: process.env.TELEGRAM_GROUP_ID,
    whitelist: process.env.TELEGRAM_WHITELIST ? process.env.TELEGRAM_WHITELIST.split(',').map(id => id.trim()) : [],
    port: process.env.TELEGRAM_WEBHOOK_PORT || 3001,
    webhookUrl: process.env.TELEGRAM_WEBHOOK_URL,
    appSecret: process.env.APP_SECRET
};

// Validate configuration
if (!config.botToken) {
    logger.error('TELEGRAM_BOT_TOKEN must be set in .env file');
    process.exit(1);
}

if (!config.chatId && !config.groupId) {
    logger.error('Either TELEGRAM_CHAT_ID or TELEGRAM_GROUP_ID must be set in .env file');
    process.exit(1);
}

// Create and start webhook handler
const webhookHandler = new TelegramWebhookHandler(config);

async function start() {
    logger.info('Starting Telegram webhook server...');
    logger.info(`Configuration:`);
    logger.info(`- Port: ${config.port}`);
    logger.info(`- Chat ID: ${config.chatId || 'Not set'}`);
    logger.info(`- Group ID: ${config.groupId || 'Not set'}`);
    logger.info(`- Whitelist: ${config.whitelist.length > 0 ? config.whitelist.join(', ') : 'None (using configured IDs)'}`);
    
    // Set webhook if URL is provided
    if (config.webhookUrl) {
        try {
            const webhookEndpoint = config.appSecret
                ? `${config.webhookUrl}/webhook/telegram/${config.appSecret}`
                : `${config.webhookUrl}/webhook/telegram`;
            logger.info(`Setting webhook to: ${webhookEndpoint}`);
            let attempts = 0;
            while (attempts < 3) {
                try {
                    await webhookHandler.setWebhook(webhookEndpoint);
                    break;
                } catch (error) {
                    attempts += 1;
                    const retryAfter = error?.response?.data?.parameters?.retry_after;
                    if (error?.response?.data?.error_code === 429 && retryAfter) {
                        logger.warn(`Telegram rate limit, retrying after ${retryAfter}s...`);
                        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
                        continue;
                    }
                    throw error;
                }
            }
        } catch (error) {
            logger.error('Failed to set webhook:', error.message);
            logger.info('You can manually set the webhook using:');
            const manualEndpoint = config.appSecret
                ? `${config.webhookUrl}/webhook/telegram/${config.appSecret}`
                : `${config.webhookUrl}/webhook/telegram`;
            logger.info(`curl -X POST https://api.telegram.org/bot${config.botToken}/setWebhook -d "url=${manualEndpoint}"`);
        }
    } else {
        logger.warn('TELEGRAM_WEBHOOK_URL not set. Please set the webhook manually.');
        logger.info('To set webhook manually, use:');
        const fallbackEndpoint = config.appSecret
            ? `https://your-domain.com/webhook/telegram/${config.appSecret}`
            : 'https://your-domain.com/webhook/telegram';
        logger.info(`curl -X POST https://api.telegram.org/bot${config.botToken}/setWebhook -d "url=${fallbackEndpoint}"`);
    }
    
    webhookHandler.start(config.port);
}

start();

// Handle graceful shutdown
process.on('SIGINT', () => {
    logger.info('Shutting down Telegram webhook server...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    logger.info('Shutting down Telegram webhook server...');
    process.exit(0);
});
