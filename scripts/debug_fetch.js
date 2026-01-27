const { syncArticles, startServer } = require('../blog_sync_server.js');

// We need to access private functions or copy them? 
// Actually syncArticles logs "Found X articles". 
// But I want to see the IDs.
// I'll modify blog_sync_server.js to export parsePixnetArticles or just add logging.

// Let's just modify blog_sync_server.js to log the IDs of found articles.
const fs = require('fs');

console.log('Use this script to trigger sync and check logs.');
