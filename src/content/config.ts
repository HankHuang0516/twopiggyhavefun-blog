import { defineCollection, z } from 'astro:content';

const posts = defineCollection({
    schema: z.object({
        title: z.string(),
        date: z.string().or(z.date()),
        cover: z.string().optional(),
        tags: z.array(z.string()).optional(),
        originalUrl: z.string().optional(),
    }),
});

export const collections = { posts };
