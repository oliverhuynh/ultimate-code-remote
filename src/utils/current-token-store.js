const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT_DIR = path.join(os.homedir(), '.ultimate-code-remote');
const CURRENT_PATH = path.join(ROOT_DIR, 'current.json');

function ensureRootDir() {
    if (!fs.existsSync(ROOT_DIR)) {
        fs.mkdirSync(ROOT_DIR, { recursive: true });
    }
}

function readCurrent() {
    ensureRootDir();
    if (!fs.existsSync(CURRENT_PATH)) return { chats: {} };
    try {
        return JSON.parse(fs.readFileSync(CURRENT_PATH, 'utf8'));
    } catch (error) {
        return { chats: {} };
    }
}

function writeCurrent(data) {
    ensureRootDir();
    fs.writeFileSync(CURRENT_PATH, JSON.stringify(data, null, 2));
}

function setToken(chatKey, token) {
    const data = readCurrent();
    data.chats = data.chats || {};
    data.chats[chatKey] = {
        token,
        updatedAt: new Date().toISOString()
    };
    writeCurrent(data);
}

function getToken(chatKey) {
    const data = readCurrent();
    return data.chats && data.chats[chatKey] ? data.chats[chatKey].token : null;
}

function clearToken(chatKey) {
    const data = readCurrent();
    if (data.chats && data.chats[chatKey]) {
        delete data.chats[chatKey];
        writeCurrent(data);
    }
}

module.exports = {
    setToken,
    getToken,
    clearToken
};
