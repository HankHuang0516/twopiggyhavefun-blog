
const assert = require('assert');

// ---------------------------------------------------------
// Logic to test (Copy-paste from BusinessStatus.astro)
// Modified to accept 'nowDate' for testing
// ---------------------------------------------------------

function parseTime(timeStr) {
    if (!timeStr) return null;
    const match = timeStr.match(/(\d{1,2})[:：](\d{2})/);
    if (!match) return null;
    return parseInt(match[1]) * 60 + parseInt(match[2]);
}

function getCurrentDayChar(date) {
    const days = ['日', '一', '二', '三', '四', '五', '六'];
    return days[date.getDay()];
}

function checkStatus(rawHours, nowDate) {
    if (!rawHours) return { state: 'unknown', msg: 'No hours' };

    const now = nowDate || new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const currentDayChar = getCurrentDayChar(now);

    let isClosedDay = false;

    // Check for explicit closed days
    // regex for "週X公休", "周X公休"
    const closedMatch = rawHours.match(/週([一二三四五六日])\s*公休/g) || rawHours.match(/周([一二三四五六日])\s*公休/g);
    if (closedMatch) {
        closedMatch.forEach(m => {
            if (m.includes(`週${currentDayChar}`) || m.includes(`周${currentDayChar}`)) {
                isClosedDay = true;
            }
        });
    }

    if (isClosedDay) return { state: 'closed-day', msg: '今日公休' };

    const rangeRegex = /(\d{1,2}[:：]\d{2})\s*[-~～]\s*(\d{1,2}[:：]\d{2})/g;
    let match;
    let allRanges = [];

    while ((match = rangeRegex.exec(rawHours)) !== null) {
        const s = parseTime(match[1]);
        const e = parseTime(match[2]);
        if (s !== null && e !== null) {
            let effectiveEnd = e;
            if (e < s) effectiveEnd += 24 * 60; // Overnight
            allRanges.push({ start: s, end: effectiveEnd, rawStart: match[1], rawEnd: match[2] });
        }
    }

    allRanges.sort((a, b) => a.start - b.start);

    if (allRanges.length === 0) return { state: 'unknown', msg: '請查看營業時間' };

    // Check State
    for (let i = 0; i < allRanges.length; i++) {
        const r = allRanges[i];
        // Check Open
        if (currentMinutes >= r.start && currentMinutes < r.end) {
            return {
                state: 'open',
                msg: `營業中 (直到 ${r.rawEnd})`,
                endTime: r.end
            };
        }
        // Check Opening Soon (within 60m)
        if (currentMinutes < r.start && (r.start - currentMinutes) <= 60) {
            return {
                state: 'opening-soon',
                msg: `即將營業 (${r.rawStart} 開門)`,
                startTime: r.start
            };
        }
    }

    // If not open, check if there's a next range TODAY
    const nextRange = allRanges.find(r => r.start > currentMinutes);

    if (nextRange) {
        // Resting between shifts
        return {
            state: 'closed',
            msg: '休息中',
            nextOpen: nextRange.rawStart
        };
    } else {
        // No more ranges today
        return { state: 'closed-day', msg: '今日營業已結束' };
    }
}

// ---------------------------------------------------------
// Tests
// ---------------------------------------------------------

console.log("Running Business Status Logic Tests...");

const mockDate = (hours, minutes, dayIndex) => {
    // dayIndex: 0=Sun, 1=Mon...
    // We pick a random date that matches the dayIndex
    // Jan 4 2026 is Sunday (0). Jan 5 (1), Jan 6 (2) etc.
    const d = new Date('2026-01-04T00:00:00');
    d.setDate(d.getDate() + dayIndex); // Move to correct day
    d.setHours(hours);
    d.setMinutes(minutes);
    return d;
};

// Case 1: Simple Open
// "11:00-21:00"
// Test at 12:00 (Open)
try {
    const res = checkStatus("11:00-21:00", mockDate(12, 0, 1)); // Mon 12:00
    assert.strictEqual(res.state, 'open', 'Should be open');
    console.log("PASS: Simple Open");
} catch (e) { console.error("FAIL: Simple Open", e); }

// Case 2: Opening Soon
// "17:00-22:00"
// Test at 16:30 (Opening Soon)
try {
    const res = checkStatus("17:00-22:00", mockDate(16, 30, 1));
    assert.strictEqual(res.state, 'opening-soon', 'Should be opening soon');
    assert.ok(res.msg.includes('即將營業'), 'Msg should say opening soon');
    console.log("PASS: Opening Soon");
} catch (e) { console.error("FAIL: Opening Soon", e); }

// Case 3: Resting (Split Shift)
// "11:00-14:00, 17:00-22:00"
// Test at 15:00 (Resting)
try {
    const res = checkStatus("11:00-14:00, 17:00-22:00", mockDate(15, 0, 1));
    assert.strictEqual(res.state, 'closed', 'Should be resting/closed');
    assert.strictEqual(res.nextOpen, '17:00', 'Next open should be 17:00');
    console.log("PASS: Resting (Split Shift)");
} catch (e) { console.error("FAIL: Resting", e); }

// Case 4: Closed Day
// "11:00-21:00 (週一公休)"
// Test on Monday
try {
    const res = checkStatus("11:00-21:00 (週一公休)", mockDate(12, 0, 1)); // Mon
    assert.strictEqual(res.state, 'closed-day', 'Should be closed day');
    assert.strictEqual(res.msg, '今日公休', 'Msg should be closed today');
    console.log("PASS: Closed Day (Explicit)");
} catch (e) { console.error("FAIL: Closed Day", e); }

// Case 5: Closed for the day (End of day)
// "09:00-17:00"
// Test at 18:00
try {
    const res = checkStatus("09:00-17:00", mockDate(18, 0, 1));
    assert.strictEqual(res.state, 'closed-day', 'Should be closed for the day');
    assert.strictEqual(res.msg, '今日營業已結束', 'Msg should say ended');
    console.log("PASS: Ended Day");
} catch (e) { console.error("FAIL: Ended Day", e); }

console.log("Done.");
