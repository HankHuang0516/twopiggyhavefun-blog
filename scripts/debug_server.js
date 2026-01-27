try {
    const server = require('../blog_sync_server.js');
    console.log('Successfully loaded blog_sync_server.js');
    console.log('Exports:', Object.keys(server));

    if (server.syncArticles) {
        console.log('Running syncArticles...');
        server.syncArticles().then(() => console.log('Sync done')).catch(e => console.error(e));
    } else {
        console.error('syncArticles not found in exports');
    }
} catch (e) {
    console.error('Failed to load:', e);
}
