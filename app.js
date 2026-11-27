// ===== תהילים — לוגיקה =====

const perekSelect = document.getElementById('perekSelect');
const perekTitle = document.getElementById('perekTitle');
const perekBody = document.getElementById('perekBody');
const loader = document.getElementById('loader');
const chapterContent = document.getElementById('chapterContent');
const emptyState = document.getElementById('emptyState');
const chapterCounter = document.getElementById('chapterCounter');
const chapterSubtitle = document.getElementById('chapterSubtitle');

let currentChapter = 0;
let selectedDay = null;
let selectedMonthDay = null;

function getWeekKey() {
    const now = new Date();
    const day = now.getDay();
    const lastSunday = new Date(now);
    lastSunday.setDate(now.getDate() - day);
    return 'tehillim_read_week_' + lastSunday.toISOString().slice(0, 10);
}
const todayKey = getWeekKey();

// Hebrew month key — resets with the Hebrew month, not Gregorian
function getHebrewMonthKey() {
    try {
        const now = new Date();
        const gYear = now.getFullYear(), gMonth = now.getMonth()+1, gDay = now.getDate();
        function isLeap(y){return((7*y)+1)%19<7;}
        function elapsed(y){
            const me=235*Math.floor((y-1)/19)+12*((y-1)%19)+Math.floor((7*((y-1)%19)+1)/19);
            const pe=204+793*(me%1080);
            const he=5+12*me+793*Math.floor(me/1080)+Math.floor(pe/1080);
            const d=1+29*me+Math.floor(he/24), p=1080*(he%24)+(pe%1080);
            let ad=d;
            if(p>=19440||(d%7===2&&p>=9924&&!isLeap(y))||(d%7===1&&p>=16789&&isLeap(y-1)))ad=d+1;
            if(ad%7===0||ad%7===3||ad%7===5)return ad+1;
            return ad;
        }
        function yearStart(y){return elapsed(y)+347997;}
        function monthDays(y,m){
            if([2,4,6,10,13].includes(m))return 29;
            if(m===12&&!isLeap(y))return 29;
            if(m===8&&(elapsed(y+1)-elapsed(y))%10!==5)return 29;
            if(m===9&&(elapsed(y+1)-elapsed(y))%10===3)return 29;
            return 30;
        }
        const aa=Math.floor((14-gMonth)/12), yr=gYear+4800-aa, mo=gMonth+12*aa-3;
        const jdn=gDay+Math.floor((153*mo+2)/5)+365*yr+Math.floor(yr/4)-Math.floor(yr/100)+Math.floor(yr/400)-32045;
        let hYear=Math.floor((jdn-347997)*98496/35975351)+1;
        if(yearStart(hYear+1)<=jdn)hYear++;
        if(yearStart(hYear)>jdn)hYear--;
        const dayOfYear=jdn-yearStart(hYear)+1;
        let days=0, hMonth=1;
        const months=isLeap(hYear)?13:12;
        // השנה מתחילה בתשרי (חודש 7): סדר החודשים 7..סוף, ואז 1..6
        const order=[];for(let i=7;i<=months;i++)order.push(i);for(let i=1;i<=6;i++)order.push(i);
        for(const i of order){const md=monthDays(hYear,i);if(days+md>=dayOfYear){hMonth=i;break;}days+=md;}
        const key='tehillim_month_read_'+hYear+'_'+hMonth;
        // העברת התקדמות מהמפתח הישן (שחושב בטעות) למפתח הנכון
        try{
            let od=0,om=1;for(let i=1;i<=months;i++){const md=monthDays(hYear,i);if(od+md>=dayOfYear){om=i;break;}od+=md;}
            const oldKey='tehillim_month_read_'+hYear+'_'+om;
            if(oldKey!==key&&localStorage.getItem(oldKey)&&!localStorage.getItem(key)){localStorage.setItem(key,localStorage.getItem(oldKey));localStorage.removeItem(oldKey);}
        }catch(e){}
        return key;
    } catch(e) {
        return 'tehillim_month_read_'+new Date().toISOString().slice(0,7);
    }
}
const monthKey = getHebrewMonthKey();

function getReadSet() {
    try { return new Set(JSON.parse(localStorage.getItem(todayKey) || '[]')); }
    catch { return new Set(); }
}
function getMonthReadSet() {
    try { return new Set(JSON.parse(localStorage.getItem(monthKey) || '[]')); }
    catch { return new Set(); }
}
function markAsRead(num) {
    const s = getReadSet(); s.add(num);
    localStorage.setItem(todayKey, JSON.stringify([...s]));
}
function markMonthAsRead(num) {
    const s = getMonthReadSet(); s.add(num);
    localStorage.setItem(monthKey, JSON.stringify([...s]));
}
// קריאה כללית — לא מתאפסת אוטומטית
const generalKey = 'tehillim_general_read';
let generalMode = true;
function getGeneralReadSet() {
    try { return new Set(JSON.parse(localStorage.getItem(generalKey) || '[]')); }
    catch { return new Set(); }
}
function isRead(num) { return getReadSet().has(num); }
function isMonthRead(num) { return getMonthReadSet().has(num); }

// Current tab
let currentTab = 'general';

function switchTab(tab) {
    currentTab = tab;
    document.getElementById('tabDaily').classList.toggle('active', tab === 'daily');
    document.getElementById('tabMonthly').classList.toggle('active', tab === 'monthly');
    document.getElementById('sectionDaily').classList.toggle('active', tab === 'daily');
    document.getElementById('sectionMonthly').classList.toggle('active', tab === 'monthly');
    document.getElementById('tabGeneral').classList.toggle('active', tab === 'general');
    document.getElementById('sectionGeneral').classList.toggle('active', tab === 'general');
    generalMode = tab === 'general';
    document.getElementById('btnRandom').hidden = !generalMode;
    if (generalMode) monthlyMode = false;
    if (currentChapter) updateMarkReadBtn(currentChapter);
}

// =====================
// WEEKLY SCHEDULE
// =====================
const dailySchedule = [
    { name: 'ראשון',  range: [1, 29],    label: 'א – כט' },
    { name: 'שני',    range: [30, 50],   label: 'ל – נ' },
    { name: 'שלישי', range: [51, 72],   label: 'נא – עב' },
    { name: 'רביעי', range: [73, 89],   label: 'עג – פט' },
    { name: 'חמישי', range: [90, 106],  label: 'צ – קו' },
    { name: 'שישי',  range: [107, 119], label: 'קז – קיט' },
    { name: 'שבת',   range: [120, 150], label: 'קכ – קנ' },
];
const todayIndex = new Date().getDay();

// =====================
// MONTHLY SCHEDULE
// 30 days, chapters 1–150 split across 30 parts
// Traditional monthly division
// =====================
const monthlySchedule = [
    { day: 1,  range: [1, 9],    label: 'א – ט' },
    { day: 2,  range: [10, 17],  label: 'י – יז' },
    { day: 3,  range: [18, 22],  label: 'יח – כב' },
    { day: 4,  range: [23, 28],  label: 'כג – כח' },
    { day: 5,  range: [29, 34],  label: 'כט – לד' },
    { day: 6,  range: [35, 38],  label: 'לה – לח' },
    { day: 7,  range: [39, 43],  label: 'לט – מג' },
    { day: 8,  range: [44, 48],  label: 'מד – מח' },
    { day: 9,  range: [49, 54],  label: 'מט – נד' },
    { day: 10, range: [55, 59],  label: 'נה – נט' },
    { day: 11, range: [60, 65],  label: 'ס – סה' },
    { day: 12, range: [66, 68],  label: 'סו – סח' },
    { day: 13, range: [69, 71],  label: 'סט – עא' },
    { day: 14, range: [72, 76],  label: 'עב – עו' },
    { day: 15, range: [77, 78],  label: 'עז – עח' },
    { day: 16, range: [79, 82],  label: 'עט – פב' },
    { day: 17, range: [83, 87],  label: 'פג – פז' },
    { day: 18, range: [88, 89],  label: 'פח – פט' },
    { day: 19, range: [90, 96],  label: 'צ – צו' },
    { day: 20, range: [97, 103], label: 'צז – קג' },
    { day: 21, range: [104, 105],label: 'קד – קה' },
    { day: 22, range: [106, 107],label: 'קו – קז' },
    { day: 23, range: [108, 112],label: 'קח – קיב' },
    { day: 24, range: [113, 118],label: 'קיג – קיח' },
    { day: 25, range: [119, 119], label: 'קיט, א–צו', verseEnd: 96 },
    { day: 26, range: [119, 119], label: 'קיט, צז–סוף הפרק', verseStart: 97 },
    { day: 27, range: [120, 134],label: 'קכ – קלד' },
    { day: 28, range: [135, 139],label: 'קלה – קלט' },
    { day: 29, range: [140, 144],label: 'קמ – קמד' },
    { day: 30, range: [145, 150],label: 'קמה – קנ' },
];

// Today's day of month (1-based)
const todayDayOfMonth = new Date().getDate(); // 1–31, we'll clamp to 1–30

function toGematria(num) {
    const letters = {1:'א',2:'ב',3:'ג',4:'ד',5:'ה',6:'ו',7:'ז',8:'ח',9:'ט',10:'י',20:'כ',30:'ל',40:'מ',50:'נ',60:'ס',70:'ע',80:'פ',90:'צ',100:'ק'};
    if (num <= 10) return letters[num];
    if (num < 100) {
        let tens = Math.floor(num / 10) * 10, units = num % 10;
        let res = letters[tens] + (units ? letters[units] : '');
        return res.replace('יה', 'טו').replace('יו', 'טז');
    }
    if (num >= 100) {
        let remainder = num - 100;
        return letters[100] + (remainder ? toGematria(remainder) : '');
    }
}

// =====================
// BUILD WEEKLY GRID
// =====================
const daysGrid = document.getElementById('daysGrid');
dailySchedule.forEach((day, i) => {
    const card = document.createElement('div');
    card.className = 'day-card' + (i === todayIndex ? ' today' : '');
    card.dataset.index = i;
    card.id = 'dayCard_' + i;

    const count = day.range[1] - day.range[0] + 1;
    const readCount = [...Array(count)].filter((_, j) => isRead(day.range[0] + j)).length;
    const progressText = readCount > 0 ? `✓ ${readCount}/${count}` : '';

    card.innerHTML = `
        ${i === todayIndex ? '<div class="today-badge">היום</div>' : ''}
        <div class="day-name" style="${i === todayIndex ? 'margin-top:14px' : ''}">${day.name}</div>
        <div class="day-range">${day.label}</div>
        <div class="day-count">${count} פרקים</div>
        <div class="day-done-progress ${readCount > 0 ? 'has-progress' : ''}" id="dayProgress_${i}">${progressText}</div>
    `;

    card.onclick = () => selectDay(i);
    daysGrid.appendChild(card);
});

// =====================
// HEBREW DATE CALCULATION (local, no API needed)
// =====================
let todayHebrewDay = 1;

function getHebrewDayOfMonth() {
    // Accurate Hebrew calendar calculation
    function hebrewFromGregorian(gYear, gMonth, gDay) {
        // Julian Day Number
        const a = Math.floor((14 - gMonth) / 12);
        const y = gYear + 4800 - a;
        const m = gMonth + 12 * a - 3;
        let jdn = gDay + Math.floor((153 * m + 2) / 5) + 365 * y
            + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;

        // Hebrew from JDN
        const EPOCH = 347997;
        const jd = jdn - EPOCH;
        const year = Math.floor((jd * 98496.0) / 35975351.0) + 1;
        let y2 = year - 1;
        while (hebrewYearStart(year) <= jdn) { y2 = year; break; }
        let yr = year;
        if (hebrewYearStart(yr) > jdn) yr--;
        const dayOfYear = jdn - hebrewYearStart(yr) + 1;
        let month = (dayOfYear < 30) ? 7 : Math.ceil(dayOfYear / 30);
        let m2 = 7;
        while (true) {
            if (hebrewMonthStart(yr, m2) <= jdn &&
                hebrewMonthStart(yr, m2) + hebrewMonthDays(yr, m2) > jdn) break;
            m2 = (m2 % 13) + 1;
            if (m2 === 7) break;
        }
        // simpler: just compute day in month
        let mo = 1;
        let days = 0;
        const months = hebrewMonthsInYear(yr);
        // השנה מתחילה בתשרי (חודש 7): סדר החודשים 7..סוף, ואז 1..6
        const order = [];
        for (let i = 7; i <= months; i++) order.push(i);
        for (let i = 1; i <= 6; i++) order.push(i);
        for (const i of order) {
            const mdays = hebrewMonthDays(yr, i);
            if (days + mdays >= dayOfYear) {
                return dayOfYear - days;
            }
            days += mdays;
        }
        return 1;
    }

    function hebrewIsLeapYear(year) {
        return ((7 * year) + 1) % 19 < 7;
    }
    function hebrewMonthsInYear(year) {
        return hebrewIsLeapYear(year) ? 13 : 12;
    }
    function hebrewElapsedDays(year) {
        const monthsElapsed = 235 * Math.floor((year - 1) / 19)
            + 12 * ((year - 1) % 19)
            + Math.floor((7 * ((year - 1) % 19) + 1) / 19);
        const partsElapsed = 204 + 793 * (monthsElapsed % 1080);
        const hoursElapsed = 5 + 12 * monthsElapsed + 793 * Math.floor(monthsElapsed / 1080)
            + Math.floor(partsElapsed / 1080);
        const day = 1 + 29 * monthsElapsed + Math.floor(hoursElapsed / 24);
        const parts = 1080 * (hoursElapsed % 24) + (partsElapsed % 1080);
        let altDay = day;
        if (parts >= 19440 || (day % 7 === 2 && parts >= 9924 && !hebrewIsLeapYear(year))
            || (day % 7 === 1 && parts >= 16789 && hebrewIsLeapYear(year - 1))) {
            altDay = day + 1;
        }
        if (altDay % 7 === 0 || altDay % 7 === 3 || altDay % 7 === 5) {
            return altDay + 1;
        }
        return altDay;
    }
    function hebrewYearStart(year) {
        return hebrewElapsedDays(year) + 347997;
    }
    function hebrewMonthDays(year, month) {
        if (month === 2 || month === 4 || month === 6 || month === 10 || month === 13) return 29;
        if (month === 12 && !hebrewIsLeapYear(year)) return 29;
        if (month === 8 && (hebrewElapsedDays(year + 1) - hebrewElapsedDays(year)) % 10 !== 5) return 29;
        if (month === 9 && (hebrewElapsedDays(year + 1) - hebrewElapsedDays(year)) % 10 === 3) return 29;
        return 30;
    }
    function hebrewMonthStart(year, month) {
        let days = hebrewYearStart(year);
        for (let i = 1; i < month; i++) days += hebrewMonthDays(year, i);
        return days;
    }

    const now = new Date();
    const hDay = hebrewFromGregorian(now.getFullYear(), now.getMonth() + 1, now.getDate());
    return Math.min(Math.max(hDay, 1), 30);
}

// מפתח ייחודי לקריאה — מאפשר הבחנה בין חלקי פרק קיט
function makeReadKey(num, vStart, vEnd) {
    if (vStart) return `${num}_vs${vStart}`;
    if (vEnd)   return `${num}_ve${vEnd}`;
    return `${num}`;
}

// =====================
// BUILD MONTHLY GRID
// =====================
function buildMonthlyGrid() {
    todayHebrewDay = getHebrewDayOfMonth();
    const monthlyGrid = document.getElementById('monthlyGrid');
    monthlyGrid.innerHTML = '';
    monthlySchedule.forEach((entry, i) => {
        const card = document.createElement('div');
        const isToday = entry.day === todayHebrewDay;
        card.className = 'month-day-card' + (isToday ? ' today-month' : '');
        card.id = 'monthDayCard_' + i;

        const count = entry.range[1] - entry.range[0] + 1;
        const monthSet = getMonthReadSet();
        const readCount = [...Array(count)].filter((_, j) => {
            const ch = entry.range[0] + j;
            const rKey = makeReadKey(ch, entry.verseStart||null, entry.verseEnd||null);
            return monthSet.has(rKey) || monthSet.has(ch);
        }).length;
        const progressText = readCount > 0 ? `✓ ${readCount}/${count}` : '';
        const dayGematria = toGematria(entry.day);

        card.innerHTML = `
            ${isToday ? '<div class="today-month-badge">היום</div>' : ''}
            <div class="month-day-num" style="${isToday ? 'margin-top:14px' : ''}">${dayGematria}</div>
            <div class="month-day-range">${entry.label}</div>
            <div class="month-day-count">${count} פרקים</div>
            <div class="month-done-progress ${readCount > 0 ? 'has-progress' : ''}" id="monthProgress_${i}">${progressText}</div>
        `;

        card.onclick = () => selectMonthDay(i);
        monthlyGrid.appendChild(card);
    });
}
buildMonthlyGrid();

// =====================
// BUILD GENERAL GRID (all 150)
// =====================
function updateGeneralProgress() {
    const n = [...getGeneralReadSet()].filter(x => x >= 1 && x <= 150).length;
    document.getElementById('generalProgress').innerHTML = n > 0
        ? `נקראו <strong>${n}</strong> מתוך 150 פרקים`
        : '150 פרקים · בחר פרק כדי להתחיל';
    document.getElementById('generalProgressFill').style.width = (n / 150 * 100) + '%';
}
function buildGeneralGrid() {
    const grid = document.getElementById('generalGrid');
    const set = getGeneralReadSet();
    grid.innerHTML = '';
    for (let ch = 1; ch <= 150; ch++) {
        const btn = document.createElement('button');
        btn.className = 'general-chapter-btn' + (set.has(ch) ? ' done' : '');
        btn.dataset.num = ch;
        btn.textContent = toGematria(ch);
        btn.title = `פרק ${toGematria(ch)}`;
        btn.onclick = () => { generalMode = true; fetchPerek(ch, false); };
        grid.appendChild(btn);
    }
    updateGeneralProgress();
}
buildGeneralGrid();

// =====================
// SELECT WEEKLY DAY
// =====================
function selectDay(index) {
    selectedDay = index;
    monthlyMode = false;
    selectedMonthDay = null;
    const day = dailySchedule[index];

    document.querySelectorAll('.day-card').forEach((c, i) => {
        c.style.borderColor = i === index ? 'var(--gold)' : '';
        c.style.background = i === index ? 'rgba(201,168,76,0.1)' : '';
    });

    const bar = document.getElementById('dayReadingBar');
    const title = document.getElementById('dayReadingTitle');
    const subtitle = document.getElementById('dayReadingSubtitle');
    const btns = document.getElementById('dayReadingBtns');

    title.textContent = `יום ${day.name} · ${day.label}`;

    btns.innerHTML = '';
    for (let ch = day.range[0]; ch <= day.range[1]; ch++) {
        const btn = document.createElement('button');
        const read = isRead(ch);
        btn.className = 'day-chapter-btn' + (ch === currentChapter ? ' reading' : '') + (read ? ' done' : '');
        btn.dataset.num = ch;
        btn.textContent = toGematria(ch);
        btn.title = `פרק ${toGematria(ch)}${read ? ' (נקרא)' : ''}`;
        const chNum = ch;
        btn.onclick = () => {
            generalMode = false;
            fetchPerek(chNum);
            document.querySelectorAll('.day-chapter-btn').forEach(b => b.classList.remove('reading'));
            btn.classList.add('reading');
        };
        btns.appendChild(btn);
    }

    const total = day.range[1] - day.range[0] + 1;
    const readCount = [...getReadSet()].filter(n => n >= day.range[0] && n <= day.range[1]).length;
    subtitle.textContent = readCount > 0
        ? `${readCount} מתוך ${total} פרקים נקראו ✓`
        : `${total} פרקים לקריאה`;

    bar.classList.add('visible');
    bar.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// =====================
// SELECT MONTHLY DAY
// =====================
function selectMonthDay(index) {
    selectedMonthDay = index;
    const entry = monthlySchedule[index];

    document.querySelectorAll('.month-day-card').forEach((c, i) => {
        c.style.borderColor = i === index ? 'var(--silver)' : '';
        c.style.background = i === index ? 'rgba(143,163,188,0.1)' : '';
    });

    const bar = document.getElementById('monthReadingBar');
    const title = document.getElementById('monthReadingTitle');
    const subtitle = document.getElementById('monthReadingSubtitle');
    const btns = document.getElementById('monthReadingBtns');

    title.textContent = `יום ${toGematria(entry.day)} לחודש · ${entry.label}`;

    btns.innerHTML = '';
    for (let ch = entry.range[0]; ch <= entry.range[1]; ch++) {
        const btn = document.createElement('button');
        const rKey = makeReadKey(ch, entry.verseStart||null, entry.verseEnd||null);
        const read = getMonthReadSet().has(rKey);
        btn.className = 'month-chapter-btn' + (read ? ' done' : '');
        btn.dataset.num = ch;
        btn.dataset.readkey = rKey;
        btn.textContent = toGematria(ch);
        btn.title = `פרק ${toGematria(ch)}${read ? ' (נקרא)' : ''}`;
        const chNum = ch;
        const vStart = entry.verseStart || null;
        const vEnd = entry.verseEnd || null;
        btn.onclick = () => {
            generalMode = false;
            fetchPerek(chNum, true, vStart, vEnd);
            document.querySelectorAll('.month-chapter-btn').forEach(b => b.classList.remove('reading'));
            btn.classList.add('reading');
        };
        btns.appendChild(btn);
    }

    const total = entry.range[1] - entry.range[0] + 1;
    const monthSet = getMonthReadSet();
    const allKeys = Array.from({length: total}, (_, j) =>
        makeReadKey(entry.range[0] + j, entry.verseStart||null, entry.verseEnd||null));
    const readCount = allKeys.filter(k => monthSet.has(k)).length;
    subtitle.textContent = readCount > 0
        ? `${readCount} מתוך ${total} פרקים נקראו ✓`
        : `${total} פרקים לקריאה`;

    bar.classList.add('visible');
    bar.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// =====================
// QUICK CHAPTERS
// =====================

// Populate dropdown
for (let i = 1; i <= 150; i++) {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = `פרק ${toGematria(i)}`;
    perekSelect.appendChild(option);
}

// monthlyMode flag – which read set to use
let monthlyMode = false;
let currentVerseStart = null;
let currentVerseEnd = null;

let currentReadKey = null;

// טקסט התהילים נשמר מקומית (tehillim.json) — נטען פעם אחת ונשמר בזיכרון
let tehillimPromise = null;
function loadTehillim() {
    if (!tehillimPromise) {
        tehillimPromise = fetch('tehillim.json?v=1')
            .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
            .catch(e => { tehillimPromise = null; throw e; });
    }
    return tehillimPromise;
}
loadTehillim().catch(() => {}); // טעינה מוקדמת ברקע עם פתיחת האתר

async function fetchPerek(num, isMonthly, verseStart, verseEnd) {
    num = parseInt(num);
    if (!num) return;
    if (isMonthly !== undefined) monthlyMode = !!isMonthly;

    loader.style.display = 'block';
    chapterContent.style.display = 'none';
    emptyState.style.display = 'none';

    document.querySelectorAll('.quick-btn').forEach(b => {
        b.classList.toggle('active', parseInt(b.dataset.num) === num);
    });
    perekSelect.value = num;
    currentChapter = num;
    currentVerseStart = verseStart || null;
    currentVerseEnd = verseEnd || null;
    currentReadKey = makeReadKey(num, currentVerseStart, currentVerseEnd);

    document.querySelectorAll('.day-chapter-btn').forEach(b => {
        b.classList.toggle('reading', parseInt(b.dataset.num) === num);
    });
    document.querySelectorAll('.month-chapter-btn').forEach(b => {
        b.classList.toggle('reading', parseInt(b.dataset.num) === num);
    });
    document.querySelectorAll('.general-chapter-btn').forEach(b => {
        b.classList.toggle('reading', parseInt(b.dataset.num) === num);
    });

    try {
        const allChapters = await loadTehillim();
        let verses = allChapters[num - 1];
        if (verseStart) verses = verses.slice(verseStart - 1);
        if (verseEnd)   verses = verses.slice(0, verseEnd);

        const baseVerse = verseStart || 1;
        const cleanText = verses.map((v, i) => {
            const verseNum = toGematria(baseVerse + i);
            return `<span style="color:var(--gold);font-size:0.85em;margin-left:8px;opacity:0.7;">${verseNum}</span>${v}`;
        }).join(' <span class="verse-sep">׃</span> ');

        perekTitle.textContent = `פרק ${toGematria(num)}`;
        const verseRangeText = (verseStart || verseEnd)
            ? ` · פסוקים ${toGematria(baseVerse)}–${toGematria(verseEnd || verses.length + baseVerse - 1)}`
            : '';
        perekBody.innerHTML = cleanText;

        chapterCounter.textContent = `${num} / 150`;
        const [navMin, navMax] = getNavRange(num);
        document.getElementById('btnPrev').disabled = num <= navMin;
        document.getElementById('btnNext').disabled = num >= navMax;


        loader.style.display = 'none';
        chapterContent.style.display = 'block';
        chapterContent.classList.remove('animate-in');
        void chapterContent.offsetWidth;
        chapterContent.classList.add('animate-in');

        updateMarkReadBtn(num);

        document.getElementById('chapterCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
        loader.style.display = 'none';
        emptyState.style.display = 'block';
        emptyState.querySelector('.empty-text').textContent = 'שגיאה בטעינת הפרק. נסה שנית.';
    }
}

function updateMarkReadBtn(num) {
    const btn = document.getElementById('btnMarkRead');
    const icon = document.getElementById('markReadIcon');
    const text = document.getElementById('markReadText');
    if (!btn) return;
    const monthSet = getMonthReadSet();
    const read = generalMode ? getGeneralReadSet().has(num)
        : monthlyMode ? monthSet.has(currentReadKey) : isRead(num);
    btn.className = 'btn-mark-read' + (read ? ' done' : '');
    icon.textContent = read ? '✓' : '☐';
    text.textContent = read ? 'נקרא · לחץ לביטול' : 'קראתי';
}

function updateReadUI(num) {
    // General buttons
    const gSet = getGeneralReadSet();
    document.querySelectorAll('.general-chapter-btn').forEach(b => {
        if (parseInt(b.dataset.num) === num) b.classList.toggle('done', gSet.has(num));
    });
    updateGeneralProgress();
    // Weekly buttons
    document.querySelectorAll('.day-chapter-btn').forEach(b => {
        if (parseInt(b.dataset.num) === num) {
            b.classList.toggle('done', isRead(num));
        }
    });
    // Monthly buttons
    document.querySelectorAll('.month-chapter-btn').forEach(b => {
        if (parseInt(b.dataset.num) === num) {
            const key = b.dataset.readkey || String(num);
            b.classList.toggle('done', getMonthReadSet().has(key));
        }
    });

    // Update weekly day card progress
    dailySchedule.forEach((day, i) => {
        if (num >= day.range[0] && num <= day.range[1]) {
            const total = day.range[1] - day.range[0] + 1;
            const rc = [...getReadSet()].filter(n => n >= day.range[0] && n <= day.range[1]).length;
            const el = document.getElementById('dayProgress_' + i);
            if (el) {
                el.textContent = rc > 0 ? `✓ ${rc}/${total}` : '';
                el.classList.toggle('has-progress', rc > 0);
            }
            if (selectedDay === i) {
                document.getElementById('dayReadingSubtitle').textContent = rc > 0
                    ? `${rc} מתוך ${total} פרקים נקראו ✓`
                    : `${total} פרקים לקריאה`;
            }
        }
    });

    // Update monthly day card progress
    monthlySchedule.forEach((entry, i) => {
        if (num >= entry.range[0] && num <= entry.range[1]) {
            const total = entry.range[1] - entry.range[0] + 1;
            const monthSet = getMonthReadSet();
            const rc = [...Array(total)].filter((_, j) => {
                const ch = entry.range[0] + j;
                const rKey = makeReadKey(ch, entry.verseStart||null, entry.verseEnd||null);
                return monthSet.has(rKey) || monthSet.has(ch);
            }).length;
            const el = document.getElementById('monthProgress_' + i);
            if (el) {
                el.textContent = rc > 0 ? `✓ ${rc}/${total}` : '';
                el.classList.toggle('has-progress', rc > 0);
            }
            if (selectedMonthDay === i) {
                document.getElementById('monthReadingSubtitle').textContent = rc > 0
                    ? `${rc} מתוך ${total} פרקים נקראו ✓`
                    : `${total} פרקים לקריאה`;
            }
        }
    });
}

function toggleRead() {
    if (!currentChapter) return;
    if (generalMode) {
        const s = getGeneralReadSet();
        if (s.has(currentChapter)) s.delete(currentChapter);
        else s.add(currentChapter);
        localStorage.setItem(generalKey, JSON.stringify([...s]));
    } else if (monthlyMode) {
        const s = getMonthReadSet();
        if (s.has(currentReadKey)) s.delete(currentReadKey);
        else s.add(currentReadKey);
        localStorage.setItem(monthKey, JSON.stringify([...s]));
    } else {
        const s = getReadSet();
        if (s.has(currentChapter)) s.delete(currentChapter);
        else s.add(currentChapter);
        localStorage.setItem(todayKey, JSON.stringify([...s]));
    }
    updateMarkReadBtn(currentChapter);
    updateReadUI(currentChapter);
}

// טווח הפרקים שבו אפשר לדפדף הקודם/הבא:
// בקריאה חודשית ושבועית – רק הפרקים של היום שנבחר; אחרת – כל הספר
function getNavRange(num) {
    if (monthlyMode && selectedMonthDay !== null) {
        return monthlySchedule[selectedMonthDay].range;
    }
    if (!generalMode && currentTab === 'daily' && selectedDay !== null) {
        const range = dailySchedule[selectedDay].range;
        if (num >= range[0] && num <= range[1]) return range;
    }
    return [1, 150];
}

function navigate(dir) {
    const next = currentChapter + dir;
    const [navMin, navMax] = getNavRange(currentChapter);
    if (next < navMin || next > navMax) return;
    fetchPerek(next, monthlyMode && selectedMonthDay !== null);
}

function clearWeeklyReads() {
    if (!confirm('למחוק את כל הסימונים השבועיים?')) return;
    localStorage.removeItem(todayKey);
    updateMarkReadBtn(currentChapter);
    // רענן כפתורים וקוביות
    document.querySelectorAll('.day-chapter-btn').forEach(b => b.classList.remove('done'));
    document.querySelectorAll('[id^="dayProgress_"]').forEach(el => {
        el.textContent = '';
        el.classList.remove('has-progress');
    });
}

function clearMonthlyReads() {
    if (!confirm('למחוק את כל הסימונים החודשיים?')) return;
    localStorage.removeItem(monthKey);
    updateMarkReadBtn(currentChapter);
    // רענן כפתורים וקוביות
    document.querySelectorAll('.month-chapter-btn').forEach(b => b.classList.remove('done'));
    document.querySelectorAll('[id^="monthProgress_"]').forEach(el => {
        el.textContent = '';
        el.classList.remove('has-progress');
    });
}

function clearGeneralReads() {
    if (!confirm('למחוק את כל הסימונים של הקריאה הכללית?')) return;
    localStorage.removeItem(generalKey);
    document.querySelectorAll('.general-chapter-btn').forEach(b => b.classList.remove('done'));
    updateGeneralProgress();
    if (currentChapter) updateMarkReadBtn(currentChapter);
}

// =====================
// מצב בהיר / כהה
// =====================
function applyTheme(theme) {
    const light = theme === 'light';
    if (light) document.documentElement.dataset.theme = 'light';
    else delete document.documentElement.dataset.theme;
    document.querySelector('meta[name="theme-color"]').content = light ? '#f9fafb' : '#0a1628';
    const btn = document.getElementById('btnTheme');
    btn.textContent = light ? '🌙' : '☀️';
    btn.title = light ? 'מעבר למצב כהה' : 'מעבר למצב בהיר';
}
function toggleTheme() {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    applyTheme(next);
    try { localStorage.setItem('tehillim_theme', next); } catch (e) {}
}
applyTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');

// =====================
// גודל טקסט
// =====================
const TEXT_SCALES = [0.85, 1, 1.15, 1.3, 1.5, 1.75];
let textScaleIndex = 1;
try {
    const stored = parseInt(localStorage.getItem('tehillim_text_scale'), 10);
    if (TEXT_SCALES[stored]) textScaleIndex = stored;
} catch (e) {}

function applyTextScale() {
    document.documentElement.style.setProperty('--text-scale', TEXT_SCALES[textScaleIndex]);
    document.getElementById('btnTextSmaller').disabled = textScaleIndex === 0;
    document.getElementById('btnTextBigger').disabled = textScaleIndex === TEXT_SCALES.length - 1;
}
function changeTextScale(dir) {
    const next = textScaleIndex + dir;
    if (!TEXT_SCALES[next]) return;
    textScaleIndex = next;
    try { localStorage.setItem('tehillim_text_scale', String(textScaleIndex)); } catch (e) {}
    applyTextScale();
}
applyTextScale();

// לחיצה על הלוגו: טעינה מחדש של העמוד הראשי, בלי פרק פתוח (גם בלי ?perek=)
function goHome() {
    window.scrollTo(0, 0); // כדי שהדפדפן לא ישחזר את מיקום הגלילה הקודם
    window.location.href = window.location.pathname;
}
document.querySelector('.logo').addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goHome(); }
});

function getRandomPerek() {
    fetchPerek(Math.floor(Math.random() * 150) + 1);
}

function shareToWhatsapp() {
    const currentText = currentChapter > 0
        ? `פרק ${toGematria(currentChapter)}`
        : 'ספר תהילים';
    const link = chapterShareUrl(window.location.origin + window.location.pathname);
    const text = `מזמין אותך לקרוא תהילים איתי: ${currentText}\n${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}

// קישור שיתוף שפותח ישר את הפרק הנוכחי, למשל ...?perek=23
function chapterShareUrl(base) {
    return currentChapter > 0 ? `${base}?perek=${currentChapter}` : base;
}

// פתיחה מקישור משותף: אם בכתובת יש ?perek=N – פותחים את הפרק וגוללים אליו
(function openSharedChapter() {
    const num = parseInt(new URLSearchParams(window.location.search).get('perek'), 10);
    if (!(num >= 1 && num <= 150)) return;
    fetchPerek(num, false).then(() => {
        document.getElementById('chapterCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
})();

window.addEventListener('load', () => {
    setTimeout(() => {
        const todayCard = document.querySelector(`.day-card.today`);
        if (todayCard) todayCard.style.animation = 'pulse 0.6s ease';
        const todayMonthCard = document.querySelector(`.month-day-card.today-month`);
        if (todayMonthCard) todayMonthCard.style.animation = 'pulse 0.6s ease';
    }, 300);
});
