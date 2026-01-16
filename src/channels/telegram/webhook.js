/**
 * Telegram Webhook Handler
 * Handles incoming Telegram messages and commands
 */

const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const path = require('path');
const Logger = require('../../core/logger');
const ControllerInjector = require('../../utils/controller-injector');
const { createRunner } = require('../../runners');
const { formatTelegramResponse } = require('../../utils/formatting');
const sessionStore = require('../../utils/session-store');
const currentTokenStore = require('../../utils/current-token-store');
const { redactText } = require('../../utils/redact-secrets');
const { isCommandSafe } = require('../../utils/command-safety');
const RateLimiter = require('../../utils/rate-limiter');
const { enforceAllowedUrl } = require('../../utils/outbound-allowlist');
const { formatSessionsList } = require('../../utils/sessions-list-format');
const { extractSlashCommand } = require('../../utils/slash-command');

class TelegramWebhookHandler {
    constructor(config = {}) {
        this.config = config;
        this.logger = new Logger('TelegramWebhook');
        this.sessionsDir = sessionStore.ROOT_DIR;
        this.injector = new ControllerInjector();
        this.runner = createRunner();
        this.app = express();
        this.apiBaseUrl = 'https://api.telegram.org';
        this.botUsername = null; // Cache for bot username
        this.rateLimiter = new RateLimiter();
        
        this._setupMiddleware();
        this._setupRoutes();
    }

    _setupMiddleware() {
        // Parse JSON for all requests
        this.app.use(express.json());
    }

    _setupRoutes() {
        // Telegram webhook endpoint
        this.app.post('/webhook/telegram', this._handleWebhook.bind(this));
        this.app.post('/webhook/telegram/:secret', this._handleWebhook.bind(this));

        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({ status: 'ok', service: 'telegram-webhook' });
        });
    }

    /**
     * Generate network options for axios requests
     * @returns {Object} Network options object
     */
    _getNetworkOptions() {
        const options = {};
        if (this.config.forceIPv4) {
            options.family = 4;
        }
        const timeoutMs = parseInt(process.env.TELEGRAM_TIMEOUT_MS, 10);
        if (!Number.isNaN(timeoutMs) && timeoutMs > 0) {
            options.timeout = timeoutMs;
        }
        return options;
    }

    async _handleWebhook(req, res) {
        try {
            if (!this._isWebhookAuthorized(req)) {
                return res.status(401).send('Unauthorized');
            }
            const update = req.body;
            
            // Handle different update types
            if (update.message) {
                await this._handleMessage(update.message);
            } else if (update.callback_query) {
                await this._handleCallbackQuery(update.callback_query);
            }
            
            res.status(200).send('OK');
        } catch (error) {
            this.logger.error('Webhook handling error:', error.message);
            res.status(500).send('Internal Server Error');
        }
    }

    async _handleMessage(message) {
        const chatId = message.chat.id;
        const userId = message.from.id;
        let messageText = message.text?.trim();
        
        if (!messageText) return;
        const slash = extractSlashCommand(messageText);
        if (slash.command) {
            if (slash.ignored) {
                await this._sendMessage(chatId, 'ℹ️ Found a slash command and ignored other text in your message.');
            }
            messageText = slash.command;
        }

        if (!this._checkRateLimit(chatId, userId)) {
            await this._sendMessage(chatId, '⏳ Rate limit exceeded. Please try again later.');
            return;
        }

        // Check if user is authorized
        if (!this._isAuthorized(userId, chatId)) {
            this.logger.warn(`Unauthorized user/chat: ${userId}/${chatId}`);
            await this._sendMessage(chatId, '⚠️ You are not authorized to use this bot.');
            return;
        }

        // Handle /start command
        if (messageText === '/start') {
            await this._sendWelcomeMessage(chatId);
            return;
        }

        // Handle /help command
        if (messageText === '/help') {
            await this._sendHelpMessage(chatId);
            return;
        }

        if (messageText.startsWith('/work-on')) {
            const match = messageText.match(/^\/work-on\s+([A-Z0-9]{8})$/i);
            const token = match ? match[1].toUpperCase() : null;
            await this._setWorkOn(chatId, token);
            return;
        }

        if (messageText === '/repo list') {
            await this._sendRepoList(chatId);
            return;
        }

        if (messageText.startsWith('/repo work-on')) {
            const match = messageText.match(/^\/repo work-on\s+--repo\s+([^\s]+)$/i);
            const repoName = match ? match[1] : null;
            await this._repoWorkOn(chatId, repoName);
            return;
        }

        if (messageText.startsWith('/sessions list')) {
            const tokens = messageText.trim().split(/\s+/).slice(2);
            let repoName = null;
            let filter = null;
            for (let i = 0; i < tokens.length; i++) {
                if (tokens[i] === '--repo' && tokens[i + 1]) {
                    repoName = tokens[i + 1];
                    i += 1;
                    continue;
                }
                if (tokens[i] === '--filter' && tokens[i + 1]) {
                    filter = tokens.slice(i + 1).join(' ');
                    break;
                }
            }
            await this._sendSessionsList(chatId, repoName, filter);
            return;
        }

        if (messageText.startsWith('/sessions new')) {
            const match = messageText.match(/^\/sessions new\s+--repo\s+([^\s]+)$/i);
            const repoName = match ? match[1] : null;
            await this._sendSessionNew(chatId, repoName);
            return;
        }

        // Parse command
        const commandMatch = messageText.match(/^\/cmd\s+([A-Z0-9]{8})\s+(.+)$/i);
        if (!commandMatch) {
            // Check if it's a direct command without /cmd prefix
            const directMatch = messageText.match(/^([A-Z0-9]{8})\s+(.+)$/);
            if (directMatch) {
                await this._processCommand(chatId, directMatch[1], directMatch[2]);
            } else {
                const workingToken = currentTokenStore.getToken(this._getChatKey(chatId));
                if (workingToken) {
                    await this._processCommand(chatId, workingToken, messageText);
                    return;
                }
                await this._sendMessage(chatId, 
                    '❌ Invalid format. Use:\n`/cmd <TOKEN> <command>`\n\nExample:\n`/cmd ABC12345 analyze this code`',
                    { parse_mode: 'Markdown' });
            }
            return;
        }

        const token = commandMatch[1].toUpperCase();
        const command = commandMatch[2];

        await this._processCommand(chatId, token, command);
    }

    async _processCommand(chatId, token, command) {
        if (!this._isCommandAllowed(command)) {
            await this._sendMessage(chatId, '⚠️ Command rejected by safety checks.');
            return;
        }

        // Find session by token
        const session = await this._findSessionByToken(token);
        if (!session) {
            await this._sendMessage(chatId, 
                '❌ Invalid token. Please wait for a new task notification.',
                { parse_mode: 'Markdown' });
            return;
        }

        // Tokens never expire.

        try {
            const tmuxSession = session.tmuxSession || 'default';
            const sessionKey = token;
            const runnerContext = {
                sessionKey,
                sessionName: tmuxSession,
                injector: this.injector,
                workdir: session.workdir
            };

            let result;
            if (this.runner.supportsResume && await this.runner.hasSession(sessionKey)) {
                result = await this.runner.resume(command, runnerContext);
            } else {
                result = await this.runner.run(command, runnerContext);
            }

            if (result && result.finalText) {
                const formatted = formatTelegramResponse(this.runner.name, command, result.finalText, 3500);
                const workingToken = currentTokenStore.getToken(this._getChatKey(chatId));
                const parseMode = formatted.parseMode || 'Markdown';
                const header = workingToken && workingToken === token
                    ? ''
                    : `📝 Reply on [${token}] ${formatted.commandText}:\n`;
                const maxLength = 3500;
                const firstChunkMax = header ? Math.max(0, maxLength - header.length) : maxLength;
                const chunks = formatted.responseChunks || [''];
                let firstChunk = chunks.length ? chunks[0] : '';
                let remaining = chunks.length > 1 ? chunks.slice(1) : [];
                if (firstChunk.length > firstChunkMax) {
                    const overflow = firstChunk.slice(firstChunkMax);
                    firstChunk = firstChunk.slice(0, firstChunkMax);
                    remaining = [overflow, ...remaining];
                }
                const firstMessage = `${header}${firstChunk}`;
                const text = parseMode === 'HTML'
                    ? firstMessage.replace(/\*/g, '')
                    : firstMessage;
                await this._sendMessage(chatId, text, { parse_mode: parseMode });
                for (const chunk of remaining) {
                    const body = parseMode === 'HTML' ? chunk.replace(/\*/g, '') : chunk;
                    await this._sendMessage(chatId, body, { parse_mode: parseMode });
                }
            } else {
                await this._sendMessage(chatId, 
                    `✅ *Command sent successfully*\n\n📝 *Command:* ${command}\n🖥️ *Session:* ${tmuxSession}\n\nAI is now processing your request...`,
                    { parse_mode: 'Markdown' });
            }

            this.logger.info(`Command handled - User: ${chatId}, Token: ${token}, Runner: ${this.runner.name}`);
            
        } catch (error) {
            this.logger.error('Command injection failed:', error.message);
            await this._sendMessage(chatId, 
                `❌ *Command execution failed:* ${error.message}`,
                { parse_mode: 'Markdown' });
        }
    }

    async _handleCallbackQuery(callbackQuery) {
        const chatId = callbackQuery.message.chat.id;
        const data = callbackQuery.data;
        
        // Answer callback query to remove loading state
        await this._answerCallbackQuery(callbackQuery.id);
        
        if (data.startsWith('personal:')) {
            const token = data.split(':')[1];
            // Send personal chat command format
            await this._sendMessage(chatId,
                `📝 *Personal Chat Command Format:*\n\n\`/cmd ${token} <your command>\`\n\n*Example:*\n\`/cmd ${token} please analyze this code\`\n\n💡 *Copy and paste the format above, then add your command!*`,
                { parse_mode: 'Markdown' });
        } else if (data.startsWith('group:')) {
            const token = data.split(':')[1];
            // Send group chat command format with @bot_name
            const botUsername = await this._getBotUsername();
            await this._sendMessage(chatId,
                `👥 *Group Chat Command Format:*\n\n\`@${botUsername} /cmd ${token} <your command>\`\n\n*Example:*\n\`@${botUsername} /cmd ${token} please analyze this code\`\n\n💡 *Copy and paste the format above, then add your command!*`,
                { parse_mode: 'Markdown' });
        } else if (data.startsWith('session:')) {
            const token = data.split(':')[1];
            // For backward compatibility - send help message for old callback buttons
            await this._sendMessage(chatId,
                `📝 *How to send a command:*\n\nType:\n\`/cmd ${token} <your command>\`\n\nExample:\n\`/cmd ${token} please analyze this code\`\n\n💡 *Tip:* New notifications have a button that auto-fills the command for you!`,
                { parse_mode: 'Markdown' });
        }
    }

    async _sendWelcomeMessage(chatId) {
        const message = `🤖 *Welcome to Claude Code Remote Bot!*\n\n` +
            `I'll notify you when the AI completes tasks or needs input.\n\n` +
            `When you receive a notification with a token, you can send commands back using:\n` +
            `\`/cmd <TOKEN> <your command>\`\n\n` +
            `Type /help for more information.`;
        
        await this._sendMessage(chatId, message, { parse_mode: 'Markdown' });
    }

    async _sendHelpMessage(chatId) {
        const message = `📚 *AI Code Remote Bot Help*\n\n` +
            `*Commands:*\n` +
            `• \`/start\` - Welcome message\n` +
            `• \`/help\` - Show this help\n` +
            `• \`/cmd <TOKEN> <command>\` - Send command to the AI\n\n` +
            `• \`/work-on <TOKEN>\` - Set default token for this chat\n` +
            `• \`/repo list\` - List registered repos\n` +
            `• \`/repo work-on --repo <name>\` - Create token and set it\n` +
            `• \`/sessions list [--repo <name>] [--filter <filter>]\` - List top 10 sessions\n\n` +
            `• \`/sessions new --repo <name>\` - Create a new token\n\n` +
            `*Example:*\n` +
            `\`/cmd ABC12345 analyze the performance of this function\``;
        
        await this._sendMessage(chatId, message, { parse_mode: 'Markdown' });
    }

    _getChatKey(chatId) {
        return `telegram:${chatId}`;
    }

    async _sendRepoList(chatId) {
        try {
            const repos = sessionStore.getRepos();
            if (!repos.length) {
                await this._sendMessage(chatId, 'No repos registered.');
                return;
            }
            const lines = repos.map(repo => `• ${repo.name} -> ${repo.path}`);
            await this._sendMessage(chatId, `📁 Repos:\n${lines.join('\n')}`);
        } catch (error) {
            await this._sendMessage(chatId, `❌ Failed to list repos: ${error.message}`);
        }
    }

    async _sendSessionsList(chatId, repoName = null, filter = null) {
        try {
            const entries = sessionStore.listSessions({ repoName, filter, limit: 10 });
            if (!entries.length) {
                await this._sendMessage(chatId, 'No active sessions.');
                return;
            }
            const output = formatSessionsList(entries, {
                updatedLabel: 'Updated',
                tokenLabel: 'Token',
                conversationLabel: 'Conversation'
            });
            await this._sendMessage(chatId, `🧾 Sessions:\n${output}`);
        } catch (error) {
            await this._sendMessage(chatId, `❌ Failed to list sessions: ${error.message}`);
        }
    }

    async _sendSessionNew(chatId, repoName) {
        try {
            if (!repoName) {
                await this._sendMessage(chatId, 'Usage: /sessions new --repo <name>');
                return;
            }
            const result = sessionStore.createManualSession(repoName);
            await this._sendMessage(chatId, `✅ Token created: ${result.token}`);
        } catch (error) {
            await this._sendMessage(chatId, `❌ Failed to create token: ${error.message}`);
        }
    }

    async _repoWorkOn(chatId, repoName) {
        try {
            if (!repoName) {
                await this._sendMessage(chatId, 'Usage: /repo work-on --repo <name>');
                return;
            }
            const result = sessionStore.createManualSession(repoName);
            currentTokenStore.setToken(this._getChatKey(chatId), result.token);
            const session = await this._findSessionByToken(result.token);
            const summary = sessionStore.getSessionSummary(session);
            await this._sendMessage(chatId, `✅ Working token set: ${result.token}\nSummary: ${summary}`);
        } catch (error) {
            await this._sendMessage(chatId, `❌ Failed to set work token: ${error.message}`);
        }
    }

    async _setWorkOn(chatId, token) {
        if (!token) {
            await this._sendMessage(chatId, 'Usage: /work-on <TOKEN>');
            return;
        }
        const session = await this._findSessionByToken(token);
        if (!session) {
            await this._sendMessage(chatId, '❌ Invalid token.');
            return;
        }
        currentTokenStore.setToken(this._getChatKey(chatId), token);
        const summary = sessionStore.getSessionSummary(session);
        await this._sendMessage(chatId, `✅ Working token set: ${token}\nSummary: ${summary}`);
    }

    _isAuthorized(userId, chatId) {
        // Check whitelist
        const whitelist = this.config.whitelist || [];
        
        if (whitelist.includes(String(chatId)) || whitelist.includes(String(userId))) {
            return true;
        }
        
        // If no whitelist configured, allow configured chat/user
        if (whitelist.length === 0) {
            const configuredChatId = this.config.chatId || this.config.groupId;
            if (configuredChatId && String(chatId) === String(configuredChatId)) {
                return true;
            }
        }
        
        return false;
    }

    _isWebhookAuthorized(req) {
        if (!this.config.appSecret) return true;

        const pathSecret = req.params?.secret || req.query?.secret;
        if (!pathSecret || pathSecret !== this.config.appSecret) {
            this.logger.warn('Telegram webhook secret mismatch');
            return false;
        }

        const headerSecret = req.headers['x-telegram-bot-api-secret-token'];
        if (!headerSecret || headerSecret !== this.config.appSecret) {
            this.logger.warn('Telegram webhook header token mismatch');
            return false;
        }

        return true;
    }

    _checkRateLimit(chatId, userId) {
        const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 300000;
        const perSender = parseInt(process.env.RATE_LIMIT_PER_SENDER) || 60;

        const senderKey = `telegram:${chatId || userId}`;
        const senderCheck = this.rateLimiter.check(senderKey, perSender, windowMs);
        return senderCheck.allowed;
    }

    _isCommandAllowed(command) {
        const maxLength = parseInt(process.env.COMMAND_MAX_LENGTH) || 1000;
        return isCommandSafe(command, maxLength);
    }

    async _getBotUsername() {
        if (this.botUsername) {
            return this.botUsername;
        }

        try {
            enforceAllowedUrl(`${this.apiBaseUrl}/bot${this.config.botToken}/getMe`);
            const response = await axios.get(
                `${this.apiBaseUrl}/bot${this.config.botToken}/getMe`,
                this._getNetworkOptions()
            );
            
            if (response.data.ok && response.data.result.username) {
                this.botUsername = response.data.result.username;
                return this.botUsername;
            }
        } catch (error) {
            this.logger.error('Failed to get bot username:', error.message);
        }
        
        // Fallback to configured username or default
        return this.config.botUsername || 'claude_remote_bot';
    }

    async _findSessionByToken(token) {
        try {
            return sessionStore.findSessionByToken(token);
        } catch (error) {
            this.logger.error('Session lookup failed:', error.message);
            return null;
        }
    }

    async _removeSession(sessionId) {
        if (sessionStore.removeSession(sessionId)) {
            this.logger.debug(`Session removed: ${sessionId}`);
        }
    }

    async _sendMessage(chatId, text, options = {}) {
        if (!text || !text.trim()) {
            this.logger.warn('Skipped empty message');
            return;
        }
        const safeText = redactText(text);
        const maxLength = parseInt(process.env.TELEGRAM_MAX_LENGTH) || 3500;
        const chunks = safeText.length > maxLength
            ? safeText.match(new RegExp(`.{1,${maxLength}}`, 'gs'))
            : [safeText];
        for (const chunk of chunks) {
            try {
                enforceAllowedUrl(`${this.apiBaseUrl}/bot${this.config.botToken}/sendMessage`);
                await axios.post(
                    `${this.apiBaseUrl}/bot${this.config.botToken}/sendMessage`,
                    {
                        chat_id: chatId,
                        text: chunk,
                        ...options
                    },
                    this._getNetworkOptions()
                );
            } catch (error) {
                const status = error.response?.status;
                const data = error.response?.data;
                const detail = {
                    status,
                    data,
                    message: error.message,
                    code: error.code
                };
                this.logger.error('Failed to send message:', detail);
                break;
            }
        }
    }

    async _answerCallbackQuery(callbackQueryId, text = '') {
        try {
            enforceAllowedUrl(`${this.apiBaseUrl}/bot${this.config.botToken}/answerCallbackQuery`);
            await axios.post(
                `${this.apiBaseUrl}/bot${this.config.botToken}/answerCallbackQuery`,
                {
                    callback_query_id: callbackQueryId,
                    text: text
                },
                this._getNetworkOptions()
            );
        } catch (error) {
            this.logger.error('Failed to answer callback query:', error.response?.data || error.message);
        }
    }

    async setWebhook(webhookUrl) {
        try {
            const payload = {
                url: webhookUrl,
                allowed_updates: ['message', 'callback_query']
            };

            if (this.config.appSecret) {
                payload.secret_token = this.config.appSecret;
            }

            enforceAllowedUrl(`${this.apiBaseUrl}/bot${this.config.botToken}/setWebhook`);
            const response = await axios.post(
                `${this.apiBaseUrl}/bot${this.config.botToken}/setWebhook`,
                payload,
                this._getNetworkOptions()
            );

            this.logger.info('Webhook set successfully:', response.data);
            return response.data;
        } catch (error) {
            this.logger.error('Failed to set webhook:', error.response?.data || error.message);
            throw error;
        }
    }

    start(port = 3000) {
        this.app.listen(port, () => {
            this.logger.info(`Telegram webhook server started on port ${port}`);
        });
    }
}

module.exports = TelegramWebhookHandler;
