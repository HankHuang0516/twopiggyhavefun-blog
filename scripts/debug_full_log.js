const { syncArticles } = require('../blog_sync_server.js');

// We need to monkey-patch syncArticles or copy logic?
// Easier to just write a standalone script that uses the SAME functions if possible.
// But syncArticles is async and uses internal state.

// Better approach: Modify blog_sync_server.js to accept an ID filter?
// OR: Just interpret the logs I missed?

// Let's create a script that imports 'blog_sync_server.js' and runs sync, 
// but we intercept console.log to capture everything.

const originalLog = console.log;
const fs = require('fs');

const logFile = fs.createWriteStream('sync_debug.log', { flags: 'w' });

console.log = function (...args) {
    logFile.write(args.join(' ') + '\n');
    originalLog.apply(console, args);
};

// Also console.error
const originalError = console.error;
console.error = function (...args) {
    logFile.write('ERROR: ' + args.join(' ') + '\n');
    originalError.apply(console, args);
};

console.log('Starting sync debug...');
try {
    const server = require('../blog_sync_server.js');
    if (server.syncArticles) {
        server.syncArticles()
            .then(res => console.log('Result:', JSON.stringify(res)))
            .catch(err => console.error('Failed:', err));
    }
} catch (e) {
    console.error('Loader error:', e);
}
