import { getCollection } from 'astro:content';

export async function GET() {
    const posts = await getCollection('posts');
    const searchIndex = posts.map(post => ({
        title: post.data.title,
        slug: post.slug,
        description: post.body ? post.body.substring(0, 100) : '',
        tags: post.data.tags || [],
        category: post.data.category,
        date: post.data.date
    }));
    return new Response(JSON.stringify(searchIndex), {
        headers: { 'Content-Type': 'application/json' }
    });
}
