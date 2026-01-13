/**
 * Standard date formatter for the entire site.
 * Format: YYYY/MM/DD (e.g., 2023/10/25)
 * This ensures consistency across Sidebar, Post Header, and Post Cards.
 */
export function formatDate(dateInput: string | Date | undefined): string {
    if (!dateInput) return '';

    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '';

    return date.toLocaleDateString('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).replace(/\//g, '/'); // Ensure slash separator
}
