import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

import sitemap from '@astrojs/sitemap';

export default defineConfig({
    integrations: [tailwind(), sitemap()],
    // Replace with your GitHub username and repository name
    // Example: https://my-username.github.io/my-repo/
    site: 'https://twopiggyhavefun.uk',
});