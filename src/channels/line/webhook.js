/**
 * LINE Webhook Handler
 * Handles incoming LINE messages and commands
 */

const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const path = require('path');
const Logger = require('../../core/logger');
const ControllerInjector = require('../../utils/controller-injector');
const { createRunner } = require('../../runners');
const { formatLineResponse } = require('../../utils/formatting');
const sessionStore = require('../../utils/session-store');
const currentTokenStore = require('../../utils/current-token-store');
const { redactText } = require('../../utils/redact-secrets');
const { isCommandSafe } = require('../../utils/command-safety');
const RateLimiter = require('../../utils/rate-limiter');
const { enforceAllowedUrl } = require('../../utils/outbound-allowlist');
const { formatSessionsList } = require('../../utils/sessions-list-format');

class LINEWebhookHandler {
    constructor(config = {}) {
        this.config = config;
        this.logger = new Logger('LINEWebhook');
        this.sessionsDir = sessionStore.ROOT_DIR;
        this.injector = new ControllerInjector();
        this.runner = createRunner();
        this.app = express();
        this.rateLimiter = new RateLimiter();
        
        this._setupMiddleware();
        this._setupRoutes();
    }

    _setupMiddleware() {
        // Parse raw body for signature verification
        this.app.use(['/webhook', '/webhook/:secret'], express.raw({ type: 'application/json' }));
        
        // Parse JSON for other routes
        this.app.use(express.json());
    }

    _setupRoutes() {
        // LINE webhook endpoint
        this.app.post('/webhook', this._handleWebhook.bind(this));
        this.app.post('/webhook/:secret', this._handleWebhook.bind(this));
        
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({ status: 'ok', service: 'line-webhook' });
        });
    }

    _validateSignature(body, signature) {
        if (!this.config.channelSecret) {
            this.logger.error('Channel Secret not configured');
            return false;
        }

        const hash = crypto
            .createHmac('SHA256', this.config.channelSecret)
            .update(body)
            .digest('base64');

        return hash === signature;
    }

    async _handleWebhook(req, res) {
        if (!this._isWebhookAuthorized(req)) {
            return res.status(401).send('Unauthorized');
        }
        const signature = req.headers['x-line-signature'];
        
        // Validate signature
        if (!this._validateSignature(req.body, signature)) {
            this.logger.warn('Invalid signature');
            return res.status(401).send('Unauthorized');
        }

        try {
            const events = JSON.parse(req.body.toString()).events;
            
            for (const event of events) {
                if (event.type === 'message' && event.message.type === 'text') {
                    await this._handleTextMessage(event);
                }
            }
            
            res.status(200).send('OK');
        } catch (error) {
            this.logger.error('Webhook handling error:', error.message);
            res.status(500).send('Internal Server Error');
        }
    }

    async _handleTextMessage(event) {
        const userId = event.source.userId;
        const groupId = event.source.groupId;
        const messageText = event.message.text.trim();
        const replyToken = event.replyToken;
        
        if (!this._checkRateLimit(userId, groupId)) {
            await this._replyMessage(replyToken, '⏳ Rate limit exceeded. Please try again later.');
            return;
        }

        // Check if user is authorized
        if (!this._isAuthorized(userId, groupId)) {
            this.logger.warn(`Unauthorized user/group: ${userId || groupId}`);
            await this._replyMessage(replyToken, '⚠️ 您沒有權限使用此功能');
            return;
        }

        if (messageText === 'repo list' || messageText === '/repo list') {
            await this._sendRepoList(replyToken);
            return;
        }

        if (messageText.startsWith('repo work-on') || messageText.startsWith('/repo work-on')) {
            const match = messageText.match(/^\/?repo work-on\s+--repo\s+([^\s]+)$/i);
            const repoName = match ? match[1] : null;
            await this._repoWorkOn(replyToken, repoName, userId, groupId);
            return;
        }

        if (messageText.startsWith('sessions list') || messageText.startsWith('/sessions list')) {
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
            await this._sendSessionsList(replyToken, repoName, filter);
            return;
        }

        if (messageText.startsWith('sessions new') || messageText.startsWith('/sessions new')) {
            const match = messageText.match(/^\/?sessions new\s+--repo\s+([^\s]+)$/i);
            const repoName = match ? match[1] : null;
            await this._sendSessionNew(replyToken, repoName);
            return;
        }

        if (messageText.startsWith('work-on') || messageText.startsWith('/work-on')) {
            const match = messageText.match(/^\/?work-on\s+([A-Z0-9]{8})$/i);
            const token = match ? match[1].toUpperCase() : null;
            await this._setWorkOn(replyToken, userId, token);
            return;
        }

        // Parse command
        const commandMatch = messageText.match(/^Token\s+([A-Z0-9]{8})\s+(.+)$/i);
        let token = null;
        let command = null;
        if (commandMatch) {
            token = commandMatch[1].toUpperCase();
            command = commandMatch[2];
        } else {
            const workingToken = currentTokenStore.getToken(this._getChatKey(userId, groupId));
            if (workingToken) {
                token = workingToken;
                command = messageText;
            } else {
                await this._replyMessage(replyToken, 
                    '❌ 格式錯誤。請使用:\nToken <8位Token> <您的指令>\n\n例如:\nToken ABC12345 請幫我分析這段程式碼');
                return;
            }
        }

        if (!this._isCommandAllowed(command)) {
            await this._replyMessage(replyToken, '⚠️ 指令已被安全檢查拒絕。');
            return;
        }

        // Find session by token
        const session = await this._findSessionByToken(token);
        if (!session) {
            await this._replyMessage(replyToken, 
                '❌ Token 無效。請等待新的任務通知。');
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
                const maxLength = parseInt(process.env.LINE_MAX_LENGTH) || 1500;
                const responseChunks = formatLineResponse(this.runner.name, result.finalText, maxLength);
                const previewLength = 50;
                const commandPreview = command.length > previewLength
                    ? `${command.slice(0, previewLength)}...`
                    : command;
                const workingToken = currentTokenStore.getToken(this._getChatKey(userId, groupId));
                const header = workingToken && workingToken === token
                    ? ''
                    : `📝 Reply on [${token}] ${commandPreview}:\n`;
                const maxLength = 1500;
                const firstChunkMax = header ? Math.max(0, maxLength - header.length) : maxLength;
                const chunks = responseChunks || [''];
                let firstChunk = chunks.length ? chunks[0] : '';
                let remaining = chunks.length > 1 ? chunks.slice(1) : [];
                if (firstChunk.length > firstChunkMax) {
                    const overflow = firstChunk.slice(firstChunkMax);
                    firstChunk = firstChunk.slice(0, firstChunkMax);
                    remaining = [overflow, ...remaining];
                }
                const messages = [];
                const firstMessage = `${header}${firstChunk}`;
                messages.push(firstMessage);
                for (const chunk of remaining) {
                    messages.push(chunk);
                }
                await this._replyMessage(replyToken, messages);
            } else {
                await this._replyMessage(replyToken, 
                    `✅ 指令已發送\n\n📝 指令: ${command}\n🖥️ 會話: ${tmuxSession}\n\n請稍候，AI 正在處理您的請求...`);
            }

            this.logger.info(`Command handled - User: ${userId}, Token: ${token}, Runner: ${this.runner.name}`);
            
        } catch (error) {
            this.logger.error('Command injection failed:', error.message);
            await this._replyMessage(replyToken, 
                `❌ 指令執行失敗: ${error.message}`);
        }
    }

    _isAuthorized(userId, groupId) {
        // Check whitelist
        const whitelist = this.config.whitelist || [];
        
        if (groupId && whitelist.includes(groupId)) {
            return true;
        }
        
        if (userId && whitelist.includes(userId)) {
            return true;
        }
        
        // If no whitelist configured, allow configured user/group
        if (whitelist.length === 0) {
            if (groupId && groupId === this.config.groupId) {
                return true;
            }
            if (userId && userId === this.config.userId) {
                return true;
            }
        }
        
        return false;
    }

    _isWebhookAuthorized(req) {
        if (!this.config.appSecret) return true;
        const pathSecret = req.params?.secret || req.query?.secret;
        if (!pathSecret || pathSecret !== this.config.appSecret) {
            this.logger.warn('LINE webhook secret mismatch');
            return false;
        }
        return true;
    }

    _checkRateLimit(userId, groupId) {
        const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 300000;
        const perSender = parseInt(process.env.RATE_LIMIT_PER_SENDER) || 60;
        const key = groupId ? `line:${groupId}` : `line:${userId}`;
        const result = this.rateLimiter.check(key, perSender, windowMs);
        return result.allowed;
    }

    _isCommandAllowed(command) {
        const maxLength = parseInt(process.env.COMMAND_MAX_LENGTH) || 1000;
        return isCommandSafe(command, maxLength);
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

    async _replyMessage(replyToken, text) {
        try {
            enforceAllowedUrl('https://api.line.me/v2/bot/message/reply');
            const texts = Array.isArray(text) ? text : [text];
            await axios.post(
                'https://api.line.me/v2/bot/message/reply',
                {
                    replyToken: replyToken,
                    messages: texts.map((message) => ({
                        type: 'text',
                        text: redactText(message)
                    }))
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.config.channelAccessToken}`
                    }
                }
            );
        } catch (error) {
            this.logger.error('Failed to reply message:', error.response?.data || error.message);
        }
    }

    async _sendRepoList(replyToken) {
        try {
            const repos = sessionStore.getRepos();
            if (!repos.length) {
                await this._replyMessage(replyToken, '沒有已註冊的 repos。');
                return;
            }
            const lines = repos.map(repo => `• ${repo.name} -> ${repo.path}`);
            await this._replyMessage(replyToken, `📁 Repos:\n${lines.join('\n')}`);
        } catch (error) {
            await this._replyMessage(replyToken, `❌ 無法列出 repos: ${error.message}`);
        }
    }

    async _sendSessionsList(replyToken, repoName = null, filter = null) {
        try {
            const entries = sessionStore.listSessions({ repoName, filter, limit: 10 });
            if (!entries.length) {
                await this._replyMessage(replyToken, '沒有啟用中的 sessions。');
                return;
            }
            const output = formatSessionsList(entries, {
                updatedLabel: 'Updated',
                tokenLabel: 'Token',
                conversationLabel: 'Conversation'
            });
            await this._replyMessage(replyToken, `🧾 Sessions:\n${output}`);
        } catch (error) {
            await this._replyMessage(replyToken, `❌ 無法列出 sessions: ${error.message}`);
        }
    }

    async _sendSessionNew(replyToken, repoName) {
        try {
            if (!repoName) {
                await this._replyMessage(replyToken, 'Usage: /sessions new --repo <name>');
                return;
            }
            const result = sessionStore.createManualSession(repoName);
            await this._replyMessage(replyToken, `✅ Token created: ${result.token}`);
        } catch (error) {
            await this._replyMessage(replyToken, `❌ 無法建立 token: ${error.message}`);
        }
    }

    async _repoWorkOn(replyToken, repoName, userId, groupId) {
        try {
            if (!repoName) {
                await this._replyMessage(replyToken, 'Usage: /repo work-on --repo <name>');
                return;
            }
            const result = sessionStore.createManualSession(repoName);
            currentTokenStore.setToken(this._getChatKey(userId, groupId), result.token);
            await this._replyMessage(replyToken, `✅ Working token set: ${result.token}`);
        } catch (error) {
            await this._replyMessage(replyToken, `❌ 無法建立 token: ${error.message}`);
        }
    }

    async _setWorkOn(replyToken, userId, token) {
        if (!token) {
            await this._replyMessage(replyToken, 'Usage: /work-on <TOKEN>');
            return;
        }
        const session = await this._findSessionByToken(token);
        if (!session) {
            await this._replyMessage(replyToken, '❌ Token 無效。');
            return;
        }
        currentTokenStore.setToken(this._getChatKey(userId), token);
        await this._replyMessage(replyToken, `✅ Working token set: ${token}`);
    }

    _getChatKey(userId, groupId) {
        if (userId) return `line:${userId}`;
        if (groupId) return `line:${groupId}`;
        return 'line:unknown';
    }

    start(port = 3000) {
        this.app.listen(port, () => {
            this.logger.info(`LINE webhook server started on port ${port}`);
        });
    }
}

module.exports = LINEWebhookHandler;
