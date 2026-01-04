import { defineCollection, z } from 'astro:content';

const posts = defineCollection({
    schema: z.object({
        title: z.string(),
        date: z.string().or(z.date()),
        cover: z.string().optional(),
        tags: z.array(z.string()).optional(),
        category: z.string().optional(), // 個人分類 from Pixnet
        originalUrl: z.string().optional(),
        businessHours: z.string().nullable().optional(),
        isPermanentlyClosed: z.boolean().nullable().optional(),
        lat: z.number().optional(),
        lng: z.number().optional(),
    }),
});

export const collections = { posts };
