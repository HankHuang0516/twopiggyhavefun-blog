const puppeteer = require('puppeteer');
const { spawn } = require('child_process');
const http = require('http');

const PORT = 4321;
const URL = `http://localhost:${PORT}/editor`;

// Function to check if server is ready
function checkServer(retries = 30) {
    return new Promise((resolve, reject) => {
        const tryConnect = () => {
            http.get(URL, (res) => {
                if (res.statusCode === 200 || res.statusCode === 404) { // 404 is fine as long as server responds (Astro routing)
                    resolve();
                } else {
                    retry();
                }
            }).on('error', retry);
        };

        const retry = () => {
            if (retries <= 0) return reject(new Error('Server did not start in time'));
            setTimeout(() => {
                checkServer(retries - 1).then(resolve).catch(reject);
            }, 1000);
        };

        tryConnect();
    });
}

(async () => {
    console.log('🚀 Starting Browser Verification...');

    // 1. Start Preview Server
    console.log('📦 Starting Astro Preview Server...');
    const server = spawn('npm', ['run', 'preview'], {
        cwd: process.cwd(),
        stdio: 'pipe',
        shell: true
    });

    try {
        // 2. Wait for Server to be ready
        console.log('⏳ Waiting for server to respond...');
        await checkServer();
        console.log('✅ Server is up!');

        // 3. Launch Browser
        console.log('🌐 Launching Headless Browser...');
        const browser = await puppeteer.launch({
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();

        // Capture Console Log
        page.on('console', msg => {
            const type = msg.type();
            const text = msg.text();
            if (type === 'error' && !text.includes('favicon')) {
                console.error(`❌ Browser Console Error: ${text}`);
                // Don't fail immediately, but track it? 
                // For now, fail on duplicate declaration syntax error which is critical
                if (text.includes(' SyntaxError') || text.includes('ReferenceError')) {
                    process.exitCode = 1;
                }
            }
        });

        // Capture Page Errors (Uncaught Exceptions)
        page.on('pageerror', err => {
            console.error(`❌ Uncaught Exception: ${err.message}`);
            process.exitCode = 1;
        });

        // 4. Navigate to Editor
        console.log(`➡️ Navigating to ${URL}...`);
        await page.goto(URL, { waitUntil: 'networkidle0' });

        // 5. Test Login Button
        console.log('🔍 Checking Login Button...');
        const loginBtnSelector = '#login-btn';

        try {
            await page.waitForSelector(loginBtnSelector, { timeout: 5000 });
            await page.click(loginBtnSelector);
            console.log('✅ Login Button clicked!');

            // Validate that we didn't crash after click (wait a bit)
            await new Promise(r => setTimeout(r, 1000));

            // If code reaches here without process.exitCode = 1 from pageerror, we are good.

        } catch (e) {
            console.error(`❌ Failed to find or click Login Button: ${e.message}`);
            const html = await page.content();
            console.log('📄 Page Content Dump:', html.substring(0, 500) + '...');
            process.exitCode = 1;
        }

        await browser.close();

    } catch (e) {
        console.error(`❌ Check Failed: ${e.message}`);
        process.exitCode = 1;
    } finally {
        console.log('🛑 Stopping Server...');
        server.kill();
        process.exit(process.exitCode || 0);
    }
})();
