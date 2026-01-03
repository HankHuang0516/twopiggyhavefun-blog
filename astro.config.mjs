import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
    integrations: [tailwind()],
    // Replace with your GitHub username and repository name
    // Example: https://my-username.github.io/my-repo/
    site: 'https://HankHuang0516.github.io',
    base: '/twopiggyhavefun-blog',
});
