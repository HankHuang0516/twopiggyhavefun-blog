const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

// --- improved_business_status.js logic ---

function parseTime(timeStr) {
    if (!timeStr) return null;
    const match = timeStr.match(/(\d{1,2})[:：](\d{2})/);
    if (!match) return null;
    return parseInt(match[1]) * 60 + parseInt(match[2]);
}

const DAYS_MAP = {
    '日': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6,
    'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
};

function getDayIndex(dayChar) {
    return DAYS_MAP[dayChar] !== undefined ? DAYS_MAP[dayChar] : -1;
}

function isDayMatch(segment, currentDayIdx) {
    // 0=Sun, 1=Mon, ..., 6=Sat
    const isWeekend = currentDayIdx === 0 || currentDayIdx === 6;

    // Check "平日" (Weekday) / "假日" (Weekend)
    if (segment.includes('平日')) {
        if (isWeekend) return false; // It's for weekdays, today is weekend
        // If today is weekday, we continue to check if there are other specific constraints?
        // Usually "平日" implies Mon-Fri.
    }
    if (segment.includes('假日') || segment.includes('六日') || segment.includes('週末')) {
        if (!isWeekend) return false;
    }

    // Check Range "週X~週Y" or "週X-週Y"
    // Regex for range: /週([一二三四五六日])\s*[-~～]\s*週([一二三四五六日])/
    const rangeMatch = segment.match(/週([一二三四五六日])\s*[-~～]\s*週([一二三四五六日])/);
    if (rangeMatch) {
        let startDay = getDayIndex(rangeMatch[1]);
        let endDay = getDayIndex(rangeMatch[2]);
        if (startDay !== -1 && endDay !== -1) {
            // Handle wrapping? e.g. Fri-Mon? 
            // Usually simple range.
            // If start <= end: start <= cur <= end
            // If start > end (e.g. Fri-Mon): cur >= start OR cur <= end
            let match = false;
            if (startDay <= endDay) {
                if (currentDayIdx >= startDay && currentDayIdx <= endDay) match = true;
            } else {
                if (currentDayIdx >= startDay || currentDayIdx <= endDay) match = true;
            }
            if (!match) return false;
        }
    }

    // Check specific specific days "週X" "星期X" (but not part of a range)
    // This is tricky if it contains both "週一~週五" and "週六" in same string but we split by comma previously?
    // If assume segment is specific.
    // If segment contains specific matching day?
    // e.g. "週六 10:00"

    // Simplification: If segment HAS day markers, checking if it matches today.
    // If segment has NO day markers, it applies to all.

    const dayChars = ['日', '一', '二', '三', '四', '五', '六'];
    const curChar = dayChars[currentDayIdx];

    // Gather all day markers in segment
    const allRefDays = segment.match(/週([一二三四五六日])/g) || [];
    // If we found markers, we must match one of them (or the range logic above covered it).
    // If we have a range match, we generally trust it. 
    // But "週一~週五, 週日" -> if comma split, fine. If "週一~週五 週日" in one segment?

    // Strict approach:
    // If segment mentions "週X", does it mention TODAY?
    // Or is it a range covering TODAY?

    // If we already passed Range check (which handles "Start~End"), what about "Mon, Wed, Fri"?
    // "週一、三、五" is hard to parse generally. 

    // Let's rely on: if segment mentions day names, today must be one of them or in range.
    // If segment mentions NO day names, NO "平日/假日", then it matches.

    const hasDayKeywords = /週|周|星期|平日|假日|週末/.test(segment);
    if (!hasDayKeywords) return true;

    // If has keywords, we need a positive match.
    // We already checked Range, 平日, 假日.
    // If those passed (or didn't exist), we verify specific day.

    // Re-verify Range logic: if range existed and matched, return true.
    if (rangeMatch) {
        // We already did the check. If we are here, do we return true?
        // We returned 'false' if mismatch. So if we are here, range matched? 
        // logic line 62: if (!match) return false. So if match=true, we are still here.
        // We should return true if matched range.
        let startDay = getDayIndex(rangeMatch[1]);
        let endDay = getDayIndex(rangeMatch[2]);
        // Re-eval match
        let match = false;
        if (startDay <= endDay) {
            if (currentDayIdx >= startDay && currentDayIdx <= endDay) match = true;
        } else {
            if (currentDayIdx >= startDay || currentDayIdx <= endDay) match = true;
        }
        if (match) return true;
    }

    // Specific day check
    if (segment.includes(`週${curChar}`) || segment.includes(`周${curChar}`) || segment.includes(`星期${curChar}`)) {
        return true;
    }

    if (segment.includes('平日') && !isWeekend) return true;
    if ((segment.includes('假日') || segment.includes('週末')) && isWeekend) return true;

    // If has keywords but nothing matched?
    return false;
}

function getTodayRanges(rawHours, currentDayIdx) {
    if (!rawHours) return [];

    // 1. Check strict "Closed" for today
    // "週X公休"
    const dayChars = ['日', '一', '二', '三', '四', '五', '六'];
    const curChar = dayChars[currentDayIdx];
    const closedRegex = new RegExp(`[週周]${curChar}\\s*公休`);
    if (closedRegex.test(rawHours)) {
        return 'CLOSED_DAY';
    }

    // 2. Split segments
    // Split by comma, semicolon
    const segments = rawHours.split(/[,，;；]/);

    let activeRanges = [];
    const timeRegex = /(\d{1,2}[:：]\d{2})\s*[-~～]\s*(\d{1,2}[:：]\d{2})/g;

    for (const seg of segments) {
        if (isDayMatch(seg, currentDayIdx)) {
            // Extract times
            let match;
            // reset regex index
            const localRegex = new RegExp(timeRegex);
            while ((match = localRegex.exec(seg)) !== null) {
                const s = parseTime(match[1]);
                const e = parseTime(match[2]);
                if (s !== null && e !== null) {
                    let effectiveEnd = e;
                    if (e < s) effectiveEnd += 24 * 60;
                    activeRanges.push({ start: s, end: effectiveEnd, rawStart: match[1], rawEnd: match[2] });
                }
            }
        }
    }

    return activeRanges.sort((a, b) => a.start - b.start);
}

function checkStatus(rawHours, mockDate = null) {
    const now = mockDate || new Date();
    const currentDayIdx = now.getDay();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const ranges = getTodayRanges(rawHours, currentDayIdx);

    if (ranges === 'CLOSED_DAY') {
        return { state: 'closed-day', msg: '今日公休' };
    }

    if (ranges.length === 0) {
        // If we found NO ranges for today, but string exists?
        // Maybe it's "週六日營業" and today is Monday.
        // It implies closed today.
        // Or unparseable.
        // If string length > 5 but no ranges?
        if (rawHours && rawHours.length > 5) {
            // Check if it has time but we filtered it out -> Closed Today
            // Or if it has no time -> Unknown
            return { state: 'closed-day', msg: '今日未營業' };
        }
        return { state: 'unknown', msg: '請查看營業時間' };
    }

    // Check Active
    for (const r of ranges) {
        if (currentMinutes >= r.start && currentMinutes < r.end) {
            return { state: 'open', msg: `營業中 (直到 ${r.rawEnd})` };
        }
        if (currentMinutes < r.start && (r.start - currentMinutes) <= 60) {
            return { state: 'opening-soon', msg: `即將營業 (${r.rawStart} 開門)` };
        }
    }

    // Check Next Open Today
    const next = ranges.find(r => r.start > currentMinutes);
    if (next) {
        const diffMins = next.start - currentMinutes;
        const diffHrs = Math.floor(diffMins / 60);
        const remMins = diffMins % 60;
        let timeMsg = "";
        if (diffHrs > 0) timeMsg += `${diffHrs}小時`;
        if (remMins > 0) timeMsg += `${remMins}分`;

        return {
            state: 'closed',
            msg: `休息中 (還有${timeMsg}開門)`, // "In X hr Y min"
            nextOpen: next.rawStart
        };
    }

    return { state: 'closed-day', msg: '今日營業已結束' };
}


// --- Test Suite ---
const tests = [
    {
        name: "Simple Range Open",
        hours: "10:00-22:00",
        date: new Date(2023, 0, 1, 12, 0), // Sunday Noon
        expect: "open"
    },
    {
        name: "Simple Range Closed",
        hours: "10:00-22:00",
        date: new Date(2023, 0, 1, 23, 0),
        expect: "closed-day"
    },
    {
        name: "Weekday vs Weekend (Test Weekday)",
        hours: "平日 10:00-18:00, 假日 10:00-22:00",
        date: new Date(2023, 0, 2, 19, 0), // Mon 19:00 (Should be Closed, range ends 18:00)
        expect: "closed-day" // Currently triggers closed-day because no next range 
    },
    {
        name: "Weekday vs Weekend (Test Weekend)",
        hours: "平日 10:00-18:00, 假日 10:00-22:00",
        date: new Date(2023, 0, 1, 19, 0), // Sun 19:00 (Should be Open, range starts 22:00)
        expect: "open"
    },
    {
        name: "Explicit Closed Day",
        hours: "10:00-22:00 (週一公休)",
        date: new Date(2023, 0, 2, 12, 0), // Mon 12:00
        expect: "closed-day"
    },
    {
        name: "Complex Range",
        hours: "週二~週五 11:30-14:30, 17:30-20:30; 週六日 11:00-21:00",
        date: new Date(2023, 0, 3, 15, 0), // Tue 15:00 (Resting)
        expect: "closed"
    }
];

console.log("=== RUNNING TEST SUITE ===");
let passed = 0;
for (const t of tests) {
    const res = checkStatus(t.hours, t.date);
    if (res.state === t.expect) {
        console.log(`[PASS] ${t.name}: ${res.state}`);
        passed++;
    } else {
        console.log(`[FAIL] ${t.name}`);
        console.log(`  Input: ${t.hours} @ ${t.date.getDay()} ${t.date.getHours()}:${t.date.getMinutes()}`);
        console.log(`  Got: ${res.state} (${res.msg})`);
        console.log(`  Exp: ${t.expect}`);
    }
}
console.log(`Passed ${passed}/${tests.length}`);
console.log("==========================");

// --- Real File Test (Optional) ---
// ... (Can keep existing file scan logic if desired, matching earlier script but with new logic)
