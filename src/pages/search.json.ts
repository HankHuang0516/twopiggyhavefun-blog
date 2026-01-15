import { getCollection } from 'astro:content';

export async function GET() {
    const allPosts = await getCollection('posts');
    const posts = allPosts.filter(p => p.data).map(post => ({
        title: post.data.title,
        description: post.data.description,
        slug: post.slug,
        date: post.data.date,
        category: post.data.category,
        cover: post.data.cover
    }));

    return new Response(JSON.stringify(posts), {
        status: 200,
        headers: {
            "Content-Type": "application/json"
        }
    });
}
