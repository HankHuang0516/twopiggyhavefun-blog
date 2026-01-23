const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const axios = require('axios');

const DIST_DIR = path.resolve(__dirname, 'dist');

// Stats
const stats = {
    pagesScanned: 0,
    linksFound: 0,
    imagesFound: 0,
    brokenLinks: [],
    brokenImages: []
};

// Set to track unique URLs to avoid double checking
const checkedExternalUrls = new Map(); // url -> boolean (exists)
const checkedInternalPaths = new Map(); // path -> boolean (exists)

// Simplified concurrent checker
async function batchCheckUrls(urls) {
    const uniqueHelper = [...new Set(urls)];
    const results = new Map();
    const BATCH_SIZE = 50;

    for (let i = 0; i < uniqueHelper.length; i += BATCH_SIZE) {
        const chunk = uniqueHelper.slice(i, i + BATCH_SIZE);
        const promises = chunk.map(url =>
            axios.head(url, { timeout: 3000 })
                .then(res => res.status >= 200 && res.status < 400)
                .catch(() => axios.get(url, { timeout: 3000 }).then(res => res.status >= 200 && res.status < 400).catch(() => false))
                .then(exists => {
                    results.set(url, exists);
                    process.stdout.write('.');
                })
        );
        await Promise.all(promises);
    }
    return results;
}

function normalizePath(filePath, relativeLink) {
    if (relativeLink.startsWith('//')) return 'https:' + relativeLink;
    if (relativeLink.startsWith('http')) return relativeLink;
    if (relativeLink.startsWith('#') || relativeLink.startsWith('mailto:') || relativeLink.startsWith('javascript:')) return null;

    let resolvedPath;
    if (relativeLink.startsWith('/')) {
        resolvedPath = path.join(DIST_DIR, relativeLink);
    } else {
        const currentDir = path.dirname(filePath);
        resolvedPath = path.resolve(currentDir, relativeLink);
    }
    resolvedPath = resolvedPath.split('?')[0].split('#')[0];
    return resolvedPath;
}

function checkInternalFile(resolvedPath) {
    if (checkedInternalPaths.has(resolvedPath)) return checkedInternalPaths.get(resolvedPath);

    let exists = false;
    if (fs.existsSync(resolvedPath)) {
        if (fs.statSync(resolvedPath).isDirectory()) {
            exists = fs.existsSync(path.join(resolvedPath, 'index.html'));
        } else {
            exists = true;
        }
    } else if (fs.existsSync(resolvedPath + '.html')) {
        exists = true;
    } else if (fs.existsSync(resolvedPath + '/index.html')) {
        exists = true;
    }

    checkedInternalPaths.set(resolvedPath, exists);
    return exists;
}

async function verifySite() {
    const skipExternal = process.argv.includes('--internal-only');
    console.log('🔍 Starting Site Verification (Optimized)...');
    if (skipExternal) console.log('⚡ Mode: Internal Check Only');
    console.log(`📂 Scanning directory: ${DIST_DIR}\n`);

    if (!fs.existsSync(DIST_DIR)) {
        console.error('❌ dist directory not found. Please run "npm run build" first.');
        process.exit(1);
    }

    const htmlFiles = [];
    function walk(dir) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            if (stat.isDirectory()) {
                walk(filePath);
            } else if (file.endsWith('.html')) {
                htmlFiles.push(filePath);
            }
        }
    }
    walk(DIST_DIR);
    stats.pagesScanned = htmlFiles.length;
    console.log(`📄 Found ${stats.pagesScanned} HTML pages to scan.`);

    const externalLinksToCheck = new Set();
    const externalImagesToCheck = new Set();
    const internalLinkMap = []; // {page, link, path}
    const internalImageMap = []; // {page, src, path}

    // Phase 1: Collect all links
    for (const file of htmlFiles) {
        const content = fs.readFileSync(file, 'utf8');
        const $ = cheerio.load(content);
        const relativeDisplayPath = path.relative(DIST_DIR, file);

        $('a').each((_, el) => {
            const href = $(el).attr('href');
            if (!href) return;
            const normalized = normalizePath(file, href);
            if (!normalized) return;

            stats.linksFound++;
            if (normalized.startsWith('http')) {
                if (normalized.includes('twopiggyhavefun.uk') || normalized.includes('localhost')) {
                    externalLinksToCheck.add(normalized);
                }
            } else {
                internalLinkMap.push({ page: relativeDisplayPath, link: href, path: normalized });
            }
        });

        $('img').each((_, el) => {
            const src = $(el).attr('src');
            if (!src) return;
            const normalized = normalizePath(file, src);
            if (!normalized) return;

            stats.imagesFound++;
            if (normalized.startsWith('http')) {
                externalImagesToCheck.add(normalized);
            } else {
                internalImageMap.push({ page: relativeDisplayPath, src: src, path: normalized });
            }
        });
    }

    // Phase 2: Verify Internal
    console.log(`Checking ${internalLinkMap.length} internal links...`);
    internalLinkMap.forEach(item => {
        if (!checkInternalFile(item.path)) {
            stats.brokenLinks.push({ page: item.page, link: item.link, reason: 'File not found' });
        }
    });

    console.log(`Checking ${internalImageMap.length} internal images...`);
    internalImageMap.forEach(item => {
        if (!checkInternalFile(item.path)) {
            stats.brokenImages.push({ page: item.page, src: item.src, reason: 'File not found' });
        }
    });

    // Phase 3: Verify External Images
    if (!skipExternal) {
        console.log(`Checking ${externalImagesToCheck.size} external images...`);
        const imageResults = await batchCheckUrls([...externalImagesToCheck]);

        const brokenImageUrls = new Set();
        imageResults.forEach((exists, url) => {
            if (!exists) brokenImageUrls.add(url);
        });

        if (brokenImageUrls.size > 0) {
            for (const file of htmlFiles) {
                const content = fs.readFileSync(file, 'utf8');
                const $ = cheerio.load(content);
                const relativeDisplayPath = path.relative(DIST_DIR, file);
                $('img').each((_, el) => {
                    const src = $(el).attr('src');
                    if (!src) return;
                    const normalized = normalizePath(file, src);
                    if (normalized && brokenImageUrls.has(normalized)) {
                        stats.brokenImages.push({ page: relativeDisplayPath, src: src, reason: 'External 404' });
                    }
                });
            }
        }
    } else {
        console.log('⚠️ Skipping external image verification (--internal-only)');
    }

    console.log('\n\n📊 Verification Report');
    console.log('======================');
    console.log(`Pages Scanned: ${stats.pagesScanned}`);
    console.log(`Broken Links: ${stats.brokenLinks.length}`);
    console.log(`Broken Images: ${stats.brokenImages.length}`);

    if (stats.brokenLinks.length > 0) {
        console.log('\n❌ Broken Links Found:');
        stats.brokenLinks.slice(0, 20).forEach(item => {
            console.log(`  - Page: ${item.page}`);
            console.log(`    Link: ${item.link}`);
        });
        if (stats.brokenLinks.length > 20) console.log(`...and ${stats.brokenLinks.length - 20} more.`);
    }

    if (stats.brokenImages.length > 0) {
        console.log('\n❌ Broken Images Found:');
        stats.brokenImages.slice(0, 20).forEach(item => {
            console.log(`  - Page: ${item.page}`);
            console.log(`    Image: ${item.src}`);
        });
        if (stats.brokenImages.length > 20) console.log(`...and ${stats.brokenImages.length - 20} more.`);
    }

    if (stats.brokenLinks.length > 0 || stats.brokenImages.length > 0) {
        process.exit(1);
    } else {
        console.log('\n✨ Site Verification Passed!');
        process.exit(0);
    }
}

verifySite();
