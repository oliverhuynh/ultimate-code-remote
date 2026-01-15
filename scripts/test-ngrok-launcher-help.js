#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function run() {
    const scriptPath = path.join(__dirname, 'start-with-ngrok.js');
    if (!fs.existsSync(scriptPath)) {
        throw new Error('start-with-ngrok.js missing');
    }
    console.log('✅ ngrok launcher script exists');
}

run();
