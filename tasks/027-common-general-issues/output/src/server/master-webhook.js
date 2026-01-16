const express = require('express');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const Logger = require('../core/logger');
const TelegramWebhookHandler = require('../channels/telegram/webhook');
const LINEWebhookHandler = require('../channels/line/webhook');
const { attachLiveStreamRoutes } = require('../live-stream/server');

const logger = new Logger('Webhook-Master');
const envPath = path.join(__dirname, '../..', '.env');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
}

function createMasterServer() {
    const app = express();
    app.use(express.json());
    let telegram = null;
    let line = null;

    if (process.env.TELEGRAM_ENABLED === 'true' && process.env.TELEGRAM_BOT_TOKEN) {
        telegram = new TelegramWebhookHandler({
            botToken: process.env.TELEGRAM_BOT_TOKEN,
            chatId: process.env.TELEGRAM_CHAT_ID,
            groupId: process.env.TELEGRAM_GROUP_ID,
            whitelist: process.env.TELEGRAM_WHITELIST ? process.env.TELEGRAM_WHITELIST.split(',').map(id => id.trim()) : [],
            port: process.env.TELEGRAM_WEBHOOK_PORT || 3001,
            webhookUrl: process.env.WEBHOOK_BASE_URL,
            appSecret: process.env.APP_SECRET,
            forceIPv4: process.env.TELEGRAM_FORCE_IPV4 === 'true'
        });
        app.use(telegram.app);
        logger.info('Mounted Telegram webhook routes');
    }

    if (process.env.LINE_ENABLED === 'true' && process.env.LINE_CHANNEL_ACCESS_TOKEN) {
        line = new LINEWebhookHandler({
            channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
            channelSecret: process.env.LINE_CHANNEL_SECRET,
            userId: process.env.LINE_USER_ID,
            groupId: process.env.LINE_GROUP_ID,
            whitelist: process.env.LINE_WHITELIST ? process.env.LINE_WHITELIST.split(',').map(id => id.trim()) : [],
            port: process.env.LINE_WEBHOOK_PORT || 3000,
            appSecret: process.env.APP_SECRET
        });
        app.use(line.app);
        logger.info('Mounted LINE webhook routes');
    }

    attachLiveStreamRoutes(app);

    app.get('/health', (req, res) => {
        res.json({ status: 'ok', service: 'webhook-master' });
    });

    return { app, telegram, line };
}

module.exports = {
    createMasterServer
};
