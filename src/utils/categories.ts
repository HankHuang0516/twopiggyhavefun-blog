// Category mapping from Pixnet 個人分類 to sidebar categories
// Complete mapping of all Pixnet categories to parent categories

// Parent category structure matching Pixnet exactly
export const PIXNET_CATEGORY_HIERARCHY = {
    '國內美食': {
        slug: 'domestic-food',
        subcategories: ['台北美食', '新北市美食', '基隆美食', '桃園美食', '新竹美食', '苗栗美食',
            '台中美食', '南投美食', '彰化美食', '台南美食', '雲林美食', '宜蘭美食',
            '花蓮美食', '台東美食', '甜點分享']
    },
    '國內旅遊': {
        slug: 'domestic-travel',
        subcategories: ['新北市景點', '台北景點', '基隆景點', '宜蘭景點', '新竹景點', '桃園景點',
            '苗栗景點', '台中景點', '彰化景點', '台南景點', '花蓮景點', '征服小百岳全紀錄', '展覽']
    },
    '國內住宿': {
        slug: 'domestic-hotel',
        subcategories: ['烏來住宿', '基隆住宿', '板橋住宿', '桃園住宿', '宜蘭住宿', '花蓮住宿',
            '台南住宿', '台中住宿', '南投住宿', '彰化住宿', '台東住宿']
    },
    '國外旅遊': {
        slug: 'foreign-travel',
        subcategories: ['2025香港自由行', '2016年4月-香港.澳門員工旅遊', '2025沖繩親子自由行',
            '2019年2月-日本北海道跟團遊', '2019年5月-中國湖北']
    },
    '時尚流行': {
        slug: 'fashion',
        subcategories: ['包款推薦', '鞋款/手錶推薦', '美容美髮']
    },
    '開箱': {
        slug: 'unboxing',
        subcategories: ['滋補養身食品', '宅配伴手禮', '保健食品', '居家好物', '孕媽咪日記', '鍋具']
    },
    '親子育兒': {
        slug: 'parenting',
        subcategories: ['月子中心推薦', '育兒好物']
    },
    '婚禮大小事': {
        slug: 'wedding',
        subcategories: ['婚禮活動', '婚紗攝影']
    },
    '生活綜合': {
        slug: 'lifestyle',
        subcategories: ['懶人減肥法', '居家生活', '英文線上課程', '韓式照相館', '數位生活', '創作', '食譜分享']
    },
    '股票投資/房地產': {
        slug: 'investment',
        subcategories: ['建案賞屋心得', '投資經濟學']
    },
    'Arduino應用': {
        slug: 'arduino',
        subcategories: ['教學', 'DIY']
    },
    '實用的工具網站': {
        slug: 'tools',
        subcategories: ['實用的工具', '電影評論']
    },
    '其他': {
        slug: 'other',
        subcategories: ['好康', '未分類文章']
    }
} as const;

export type ParentCategoryName = keyof typeof PIXNET_CATEGORY_HIERARCHY;
export type SidebarCategorySlug = typeof PIXNET_CATEGORY_HIERARCHY[ParentCategoryName]['slug'];

// Build reverse lookup: subcategory -> parent category
const subcategoryToParent: Record<string, ParentCategoryName> = {};
for (const [parent, config] of Object.entries(PIXNET_CATEGORY_HIERARCHY)) {
    for (const sub of config.subcategories) {
        subcategoryToParent[sub] = parent as ParentCategoryName;
    }
}

// Get parent category slug from 個人分類 (either parent or subcategory name)
export function getCategorySlug(category: string | undefined): SidebarCategorySlug {
    if (!category) return 'other';

    // Check if it's a parent category
    if (category in PIXNET_CATEGORY_HIERARCHY) {
        return PIXNET_CATEGORY_HIERARCHY[category as ParentCategoryName].slug;
    }

    // Check if it's a subcategory
    if (category in subcategoryToParent) {
        const parent = subcategoryToParent[category];
        return PIXNET_CATEGORY_HIERARCHY[parent].slug;
    }

    // Pattern matching fallback for categories with region names
    // Food categories
    if (category.endsWith('美食') || category.includes('甜點')) {
        return 'domestic-food';
    }

    // Travel categories
    if (category.endsWith('景點') || category.includes('展覽') || category.includes('小百岳')) {
        return 'domestic-travel';
    }

    // Hotel categories
    if (category.endsWith('住宿')) {
        return 'domestic-hotel';
    }

    // Foreign travel
    const foreignKeywords = ['香港', '沖繩', '日本', '北海道', '中國', '澳門', '自由行'];
    if (foreignKeywords.some(kw => category.includes(kw))) {
        return 'foreign-travel';
    }

    // Fashion
    if (category.includes('包款') || category.includes('鞋款') || category.includes('手錶') || category.includes('美容')) {
        return 'fashion';
    }

    // Unboxing
    const unboxingKeywords = ['開箱', '滋補', '伴手禮', '保健', '居家好物', '鍋具', '孕媽咪'];
    if (unboxingKeywords.some(kw => category.includes(kw))) {
        return 'unboxing';
    }

    // Parenting
    const parentingKeywords = ['親子', '育兒', '月子'];
    if (parentingKeywords.some(kw => category.includes(kw))) {
        return 'parenting';
    }

    // Wedding
    if (category.includes('婚禮') || category.includes('婚紗')) {
        return 'wedding';
    }

    // Lifestyle
    const lifestyleKeywords = ['減肥', '居家生活', '線上課程', '照相館', '數位', '創作', '食譜'];
    if (lifestyleKeywords.some(kw => category.includes(kw))) {
        return 'lifestyle';
    }

    // Investment
    if (category.includes('投資') || category.includes('股票') || category.includes('房地產') || category.includes('建案')) {
        return 'investment';
    }

    // Arduino
    if (category.includes('Arduino') || category.includes('DIY') || category === '教學') {
        return 'arduino';
    }

    // Tools
    if (category.includes('工具') || category.includes('電影')) {
        return 'tools';
    }

    return 'other';
}

// Get parent category name from slug
export function getParentCategoryName(slug: SidebarCategorySlug): ParentCategoryName {
    for (const [name, config] of Object.entries(PIXNET_CATEGORY_HIERARCHY)) {
        if (config.slug === slug) {
            return name as ParentCategoryName;
        }
    }
    return '其他';
}

// Get display name for a sidebar category slug
export function getCategoryDisplayName(slug: SidebarCategorySlug): string {
    return getParentCategoryName(slug);
}

// Region mappings for subcategories with location names
export const regionNames: Record<string, string> = {
    'taipei': '台北',
    'newtaipei': '新北市',
    'keelung': '基隆',
    'taoyuan': '桃園',
    'hsinchu': '新竹',
    'miaoli': '苗栗',
    'taichung': '台中',
    'nantou': '南投',
    'changhua': '彰化',
    'yunlin': '雲林',
    'chiayi': '嘉義',
    'tainan': '台南',
    'kaohsiung': '高雄',
    'pingtung': '屏東',
    'yilan': '宜蘭',
    'hualien': '花蓮',
    'taitung': '台東',
    'wulai': '烏來',
    'banqiao': '板橋',
};

export const regionKeywords: Record<string, string[]> = {
    'taipei': ['台北', '北投', '士林', '天母', '西門', '中山', '信義', '大安', '內湖', '松山', '中正', '萬華'],
    'newtaipei': ['新北', '板橋', '新莊', '三重', '淡水', '三峽', '中和', '永和', '蘆洲', '林口', '萬里', '瑞芳', '九份', '烏來'],
    'taoyuan': ['桃園', '大溪', '中壢', '龍潭', '復興'],
    'yilan': ['宜蘭', '礁溪', '羅東', '頭城', '冬山', '五結', '員山', '三星'],
    'hsinchu': ['新竹', '竹東'],
    'miaoli': ['苗栗', '三義', '頭屋', '南庄'],
    'taichung': ['台中', '逢甲'],
    'nantou': ['南投', '清境', '日月潭', '埔里'],
    'changhua': ['彰化', '鹿港'],
    'chiayi': ['嘉義', '阿里山'],
    'yunlin': ['雲林'],
    'tainan': ['台南', '玉井', '赤崁'],
    'kaohsiung': ['高雄'],
    'pingtung': ['屏東', '墾丁'],
    'hualien': ['花蓮'],
    'taitung': ['台東'],
    'keelung': ['基隆'],
};

// Legacy helper functions for backward compatibility
export function isForeignTravel(title: string, tags: string[] = [], category?: string): boolean {
    if (category) {
        return getCategorySlug(category) === 'foreign-travel';
    }
    const foreignKeywords = ['香港', '沖繩', '日本', '北海道', '中國'];
    return foreignKeywords.some(kw => title.includes(kw) || tags.includes(kw));
}

export function isParenting(title: string, tags: string[] = [], category?: string): boolean {
    if (category) {
        return getCategorySlug(category) === 'parenting';
    }
    const parentingKeywords = ['親子', '育兒', '寶寶', '嬰兒', '月子', '哺乳', '尿布', '奶瓶'];
    return parentingKeywords.some(kw => title.includes(kw) || tags.includes(kw));
}

export function isUnboxing(title: string, tags: string[] = [], category?: string): boolean {
    if (category) {
        return getCategorySlug(category) === 'unboxing';
    }
    const unboxingKeywords = ['開箱', '團購', '保健', '滋補', '宅配', '伴手禮', '鍋具', '包款', '手錶', '鞋款', '居家好物'];
    return unboxingKeywords.some(kw => title.includes(kw) || tags.includes(kw));
}

export function isWedding(title: string, tags: string[] = [], category?: string): boolean {
    if (category) {
        return getCategorySlug(category) === 'wedding';
    }
    const weddingKeywords = ['婚', '新娘', '婚紗'];
    return weddingKeywords.some(kw => title.includes(kw) || tags.includes(kw));
}

// Deprecated: Old categorizePost function, kept for backward compatibility
export function categorizePost(title: string, tags: string[], category?: string) {
    if (category) {
        const slug = getCategorySlug(category);
        return {
            contentType: '',
            region: '',
            sidebarSlug: slug
        };
    }
    return { contentType: '', region: '', sidebarSlug: 'other' as SidebarCategorySlug };
}

export const contentKeywords: Record<string, string[]> = {
    'food': ['美食', '餐廳', '小吃', '火鍋', '燒烤'],
    'travel': ['景點', '一日遊', '旅遊', '步道'],
    'hotel': ['住宿', '飯店', '民宿'],
    'foreign': ['香港', '沖繩', '日本'],
};
