'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('logger loads without undeclared packages and generates unique UUID request IDs', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'notification-logger-'));
    try {
        fs.copyFileSync(path.join(__dirname, '../src/middleware/logger.js'), path.join(directory, 'logger.js'));
        const result = spawnSync(process.execPath, ['-e', `
            const Logger = require('./logger.js');
            const logger = new Logger();
            console.log(JSON.stringify([
                logger.generateLogEntry('test', 'socket-a', 'first', { source: 'test' }),
                logger.generateLogEntry('test', 'socket-b', 'second')
            ]));
        `], { cwd: directory, encoding: 'utf8', env: { ...process.env, NODE_PATH: '' } });
        assert.equal(result.status, 0, result.stderr);
        const entries = JSON.parse(result.stdout);
        for (const entry of entries) {
            assert.match(entry.requestId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
            assert.ok(Number.isFinite(Date.parse(entry.timestamp)));
        }
        assert.notEqual(entries[0].requestId, entries[1].requestId);
        assert.equal(entries[0].clientId, 'socket-a');
        assert.deepEqual(entries[0].metadata, { source: 'test' });
    } finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});
