/* ============================================================
   رسم نمودار معادلات درجه ۱ تا ۳
   ------------------------------------------------------------
   امکانات:
     - ورودی داینامیک ضرایب بر اساس درجه
     - محاسبه دقیق ریشه‌ها (تحلیلی، با روش کاردانو برای درجه ۳)
     - یافتن نقاط اکسترمم (ماکسیمم/مینیمم محلی)
     - یافتن نقاط عطف (برای درجه ۳)
     - رسم نمودار روی Canvas با محورها و شبکه
     - نمایش لیست نقاط مهم با رنگ‌بندی
   ============================================================ */

// ---------- عناصر DOM ----------
const degreeSelect = document.getElementById('degree');
const coefficientsDiv = document.getElementById('coefficients');
const plotBtn = document.getElementById('plotBtn');
const canvas = document.getElementById('graphCanvas');
const ctx = canvas.getContext('2d');
const pointsList = document.getElementById('pointsList');

// ---------- متغیرهای سراسری ----------
let currentCoeffs = [];  // ضرایب از بالاترین درجه به پایین‌ترین
let view = { xLo: -10, xHi: 10, yLo: -10, yHi: 10 };

// ============================================================
//  بخش ۱: مدیریت ورودی ضرایب
// ============================================================

const DEGREE_LABELS = {
    1: ['a', 'b'],
    2: ['a', 'b', 'c'],
    3: ['a', 'b', 'c', 'd']
};

const DEGREE_FORMS = {
    1: 'ax + b = 0',
    2: 'ax² + bx + c = 0',
    3: 'ax³ + bx² + cx + d = 0'
};

function createCoefficientInputs(degree) {
    coefficientsDiv.innerHTML = '';

    DEGREE_LABELS[degree].forEach((label, i) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'coeff-wrapper';
        wrapper.style.display = 'flex';
        wrapper.style.alignItems = 'center';
        wrapper.style.gap = '4px';

        const lbl = document.createElement('label');
        lbl.textContent = label + ' =';
        lbl.setAttribute('for', `coeff-${label}`);
        lbl.style.fontWeight = 'bold';

        const input = document.createElement('input');
        input.type = 'number';
        input.step = 'any';
        input.id = `coeff-${label}`;
        input.value = (i === 0) ? 1 : 0;  // پیش‌فرض: a=1، بقیه=0

        wrapper.appendChild(lbl);
        wrapper.appendChild(input);
        coefficientsDiv.appendChild(wrapper);
    });
}

function readCoefficients() {
    const degree = parseInt(degreeSelect.value);
    const labels = DEGREE_LABELS[degree];
    return labels.map(label => {
        const el = document.getElementById(`coeff-${label}`);
        if (!el) return 0;
        const v = parseFloat(el.value);
        return isFinite(v) ? v : 0;
    });
}

// ============================================================
//  بخش ۲: توابع ریاضی پایه
// ============================================================

// ارزیابی چندجمله‌ای در نقطه x
function polyEval(coeffs, x) {
    let result = 0;
    for (let i = 0; i < coeffs.length; i++) {
        result += coeffs[i] * Math.pow(x, coeffs.length - 1 - i);
    }
    return result;
}

// مشتق چندجمله‌ای
function derivative(coeffs) {
    const n = coeffs.length - 1;
    if (n <= 0) return [0];
    const d = [];
    for (let i = 0; i < n; i++) {
        d.push(coeffs[i] * (n - i));
    }
    return d;
}

// حذف ضرایب صفر ابتدایی (برای تشخیص درجه واقعی)
function trimLeadingZeros(coeffs) {
    const c = [...coeffs];
    while (c.length > 1 && Math.abs(c[0]) < 1e-14) c.shift();
    return c;
}

// ============================================================
//  بخش ۳: حل معادلات درجه ۱، ۲ و ۳
// ============================================================

function solveLinear(a, b) {
    // ax + b = 0
    if (Math.abs(a) < 1e-14) return [];
    return [-b / a];
}

function solveQuadratic(a, b, c) {
    // ax² + bx + c = 0
    if (Math.abs(a) < 1e-14) return solveLinear(b, c);
    const disc = b * b - 4 * a * c;
    if (disc < 0) return [];
    const sq = Math.sqrt(disc);
    return [(-b + sq) / (2 * a), (-b - sq) / (2 * a)];
}

function solveCubic(a, b, c, d) {
    // ax³ + bx² + cx + d = 0  با روش کاردانو
    if (Math.abs(a) < 1e-14) return solveQuadratic(b, c, d);

    const a0 = b / a, b0 = c / a, c0 = d / a;

    // تبدیل به فرم کاهش‌یافته: t³ + pt + q = 0  با  x = t - a0/3
    const p = b0 - (a0 * a0) / 3;
    const q = (2 * a0 * a0 * a0) / 27 - (a0 * b0) / 3 + c0;

    const disc = (q / 2) ** 2 + (p / 3) ** 3;
    const eps = 1e-9;
    const roots = [];

    if (disc > eps) {
        // یک ریشه حقیقی
        const sq = Math.sqrt(disc);
        const u = Math.cbrt(-q / 2 + sq);
        const v = Math.cbrt(-q / 2 - sq);
        roots.push(u + v - a0 / 3);
    } else if (disc < -eps) {
        // سه ریشه حقیقی (حالت تحویل‌ناپذیر) — روش مثلثاتی
        const m = 2 * Math.sqrt(-p / 3);
        let arg = ((3 * q) / (2 * p)) * Math.sqrt(-3 / p);
        arg = Math.max(-1, Math.min(1, arg));
        const theta = Math.acos(arg) / 3;
        for (let k = 0; k < 3; k++) {
            roots.push(m * Math.cos(theta - (2 * Math.PI * k) / 3) - a0 / 3);
        }
    } else {
        // ممیز صفر
        if (Math.abs(q) < eps && Math.abs(p) < eps) {
            roots.push(-a0 / 3);  // ریشه سه‌گانه
        } else {
            const u = Math.cbrt(-q / 2);
            roots.push(2 * u - a0 / 3);   // ریشه ساده
            roots.push(-u - a0 / 3);      // ریشه مضاعف
        }
    }

    roots.sort((x, y) => x - y);
    return roots;
}

// یافتن ریشه‌های یک چندجمله‌ای بر اساس درجه واقعی
function findRoots(coeffs) {
    const c = trimLeadingZeros(coeffs);
    const n = c.length - 1;
    if (n <= 0) return [];
    if (n === 1) return solveLinear(c[0], c[1]);
    if (n === 2) return solveQuadratic(c[0], c[1], c[2]);
    if (n === 3) return solveCubic(c[0], c[1], c[2], c[3]);
    return [];
}

// حذف ریشه‌های تکراری (نزدیک به هم) و مرتب‌سازی
function uniqueRoots(roots, tol = 1e-6) {
    const result = [];
    for (const r of roots) {
        if (isFinite(r) && !result.some(x => Math.abs(x - r) < tol)) {
            result.push(r);
        }
    }
    return result.sort((a, b) => a - b);
}

// ============================================================
//  بخش ۴: محاسبه نقاط مهم
// ============================================================

function computeImportantPoints(coeffs) {
    const c = trimLeadingZeros(coeffs);
    const degree = c.length - 1;
    const result = { roots: [], extrema: [], inflections: [] };

    // --- ریشه‌ها ---
    result.roots = uniqueRoots(findRoots(c));

    // --- نقاط اکسترمم (ریشه‌های مشتق اول با مشتق دوم ناصفر) ---
    if (degree >= 2) {
        const d1 = derivative(c);
        const d2 = derivative(d1);
        const critRoots = uniqueRoots(findRoots(d1));
        for (const x of critRoots) {
            const d2v = polyEval(d2, x);
            if (Math.abs(d2v) > 1e-9) {
                const y = polyEval(c, x);
                result.extrema.push({
                    x, y,
                    type: d2v > 0 ? 'min' : 'max'
                });
            }
        }
    }

    // --- نقاط عطف (ریشه‌های مشتق دوم) ---
    if (degree >= 3) {
        const d1 = derivative(c);
        const d2 = derivative(d1);
        const inflRoots = uniqueRoots(findRoots(d2));
        for (const x of inflRoots) {
            const y = polyEval(c, x);
            result.inflections.push({ x, y });
        }
    }

    return result;
}

// ============================================================
//  بخش ۵: تعیین محدوده نمایش نمودار
// ============================================================

function computeView(coeffs, points) {
    const xLo = -10, xHi = 10;

    // نمونه‌گیری از تابع برای تعیین بازه y
    const N = 400;
    const ys = [];
    for (let i = 0; i <= N; i++) {
        const x = xLo + ((xHi - xLo) * i) / N;
        const y = polyEval(coeffs, x);
        if (isFinite(y)) ys.push(y);
    }
    // شامل کردن نقاط مهم
    for (const r of points.roots) ys.push(polyEval(coeffs, r));
    for (const p of points.extrema) ys.push(p.y);
    for (const p of points.inflections) ys.push(p.y);

    ys.sort((a, b) => a - b);

    // استفاده از صدک‌ها برای جلوگیری از مقادیر خیلی بزرگ در لبه‌ها
    const lo = ys[Math.floor(ys.length * 0.05)];
    const hi = ys[Math.floor(ys.length * 0.95)];

    let yLo = lo, yHi = hi;
    if (yHi - yLo < 1e-6) { yLo -= 1; yHi += 1; }

    const pad = (yHi - yLo) * 0.12;
    yLo -= pad;
    yHi += pad;

    return { xLo, xHi, yLo, yHi };
}

// ============================================================
//  بخش ۶: توابع کمکی رسم
// ============================================================

function toCanvasX(x, v) {
    return ((x - v.xLo) / (v.xHi - v.xLo)) * canvas.width;
}
function toCanvasY(y, v) {
    return canvas.height - ((y - v.yLo) / (v.yHi - v.yLo)) * canvas.height;
}
function toMathX(cx, v) {
    return v.xLo + (cx / canvas.width) * (v.xHi - v.xLo);
}

// گام مناسب برای شبکه/درجه‌بندی
function niceStep(range, targetTicks) {
    const raw = range / targetTicks;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / mag;
    let step;
    if (norm <= 1) step = 1;
    else if (norm <= 2) step = 2;
    else if (norm <= 5) step = 5;
    else step = 10;
    return step * mag;
}

// قالب‌بندی اعداد برای نمایش روی محور
function formatNum(n) {
    if (Math.abs(n) < 1e-9) return '0';
    const s = n.toFixed(2);
    return s.replace(/\.?0+$/, '');
}

// ============================================================
//  بخش ۷: رسم نمودار
// ============================================================

function drawGrid(v) {
    const W = canvas.width, H = canvas.height;
    const xStep = niceStep(v.xHi - v.xLo, 10);
    const yStep = niceStep(v.yHi - v.yLo, 8);

    ctx.strokeStyle = '#e8e8e8';
    ctx.lineWidth = 1;

    // خطوط عمودی
    const xStart = Math.ceil(v.xLo / xStep) * xStep;
    for (let x = xStart; x <= v.xHi; x += xStep) {
        const cx = toCanvasX(x, v);
        ctx.beginPath();
        ctx.moveTo(cx, 0);
        ctx.lineTo(cx, H);
        ctx.stroke();
    }

    // خطوط افقی
    const yStart = Math.ceil(v.yLo / yStep) * yStep;
    for (let y = yStart; y <= v.yHi; y += yStep) {
        const cy = toCanvasY(y, v);
        ctx.beginPath();
        ctx.moveTo(0, cy);
        ctx.lineTo(W, cy);
        ctx.stroke();
    }
}

function drawAxes(v) {
    const W = canvas.width, H = canvas.height;
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1.5;

    // محور X
    if (v.yLo <= 0 && v.yHi >= 0) {
        const cy = toCanvasY(0, v);
        ctx.beginPath();
        ctx.moveTo(0, cy);
        ctx.lineTo(W, cy);
        ctx.stroke();
    }
    // محور Y
    if (v.xLo <= 0 && v.xHi >= 0) {
        const cx = toCanvasX(0, v);
        ctx.beginPath();
        ctx.moveTo(cx, 0);
        ctx.lineTo(cx, H);
        ctx.stroke();
    }

    // اعداد روی محور X
    ctx.fillStyle = '#333';
    ctx.font = '11px Tahoma';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const xStep = niceStep(v.xHi - v.xLo, 10);
    const xStart = Math.ceil(v.xLo / xStep) * xStep;
    const cy0 = (v.yLo <= 0 && v.yHi >= 0) ? toCanvasY(0, v) : H - 2;
    for (let x = xStart; x <= v.xHi; x += xStep) {
        if (Math.abs(x) < 1e-9) continue;
        const cx = toCanvasX(x, v);
        ctx.fillText(formatNum(x), cx, cy0 + 3);
    }

    // اعداد روی محور Y
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const yStep = niceStep(v.yHi - v.yLo, 8);
    const yStart = Math.ceil(v.yLo / yStep) * yStep;
    const cx0 = (v.xLo <= 0 && v.xHi >= 0) ? toCanvasX(0, v) : 2;
    for (let y = yStart; y <= v.yHi; y += yStep) {
        if (Math.abs(y) < 1e-9) continue;
        const cy = toCanvasY(y, v);
        ctx.fillText(formatNum(y), cx0 - 3, cy);
    }

    // مبدأ
    if (v.xLo <= 0 && v.xHi >= 0 && v.yLo <= 0 && v.yHi >= 0) {
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillText('0', toCanvasX(0, v) - 3, toCanvasY(0, v) + 3);
    }
}

function drawCurve(coeffs, v) {
    const W = canvas.width, H = canvas.height;
    ctx.strokeStyle = '#0066cc';
    ctx.lineWidth = 2.5;
    ctx.beginPath();

    const clipLo = -H, clipHi = 2 * H;
    let started = false;

    for (let px = 0; px <= W; px++) {
        const x = toMathX(px, v);
        const y = polyEval(coeffs, x);
        let cy = toCanvasY(y, v);

        if (!isFinite(cy)) { started = false; continue; }

        // محدود کردن مقدار برای جلوگیری از طول‌های خیلی زیاد
        cy = Math.max(clipLo, Math.min(clipHi, cy));

        if (!started) {
            ctx.moveTo(px, cy);
            started = true;
        } else {
            ctx.lineTo(px, cy);
        }
    }
    ctx.stroke();
}

function drawPoint(cx, cy, color, radius) {
    if (cx < -20 || cx > canvas.width + 20) return;
    if (cy < -20 || cy > canvas.height + 20) return;

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
}

function drawImportantPoints(coeffs, points, v) {
    // نقاط عطف (بنفش)
    for (const p of points.inflections) {
        drawPoint(toCanvasX(p.x, v), toCanvasY(p.y, v), '#9c27b0', 5);
    }
    // اکسترمم‌ها: مینیمم سبز، ماکسیمم نارنجی
    for (const p of points.extrema) {
        const color = p.type === 'max' ? '#ff9800' : '#4caf50';
        drawPoint(toCanvasX(p.x, v), toCanvasY(p.y, v), color, 6);
    }
    // ریشه‌ها (قرمز)
    for (const r of points.roots) {
        const y = polyEval(coeffs, r);
        drawPoint(toCanvasX(r, v), toCanvasY(y, v), '#e53935', 6);
    }
}

function drawGraph(coeffs, points) {
    const W = canvas.width, H = canvas.height;

    // پس‌زمینه
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    drawGrid(view);
    drawAxes(view);
    drawCurve(coeffs, view);
    drawImportantPoints(coeffs, points, view);
}

// ============================================================
//  بخش ۸: نمایش لیست نقاط مهم
// ============================================================

function renderPointsList(coeffs, points) {
    pointsList.innerHTML = '';

    const makeDot = (color) =>
        `<span style="display:inline-block;width:11px;height:11px;border-radius:50%;background:${color};margin-left:6px;vertical-align:middle;"></span>`;

    const addItem = (label, x, y, color) => {
        const li = document.createElement('li');
        li.innerHTML =
            `${makeDot(color)} ${label}: ` +
            `x = <strong>${x.toFixed(4)}</strong> ، ` +
            `y = <strong>${y.toFixed(4)}</strong>`;
        pointsList.appendChild(li);
    };

    // ریشه‌ها
    if (points.roots.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'ریشه حقیقی وجود ندارد.';
        pointsList.appendChild(li);
    } else {
        points.roots.forEach((r, i) => {
            addItem(`ریشه ${i + 1}`, r, polyEval(coeffs, r), '#e53935');
        });
    }

    // اکسترمم‌ها
    points.extrema.forEach(p => {
        const type = p.type === 'max' ? 'ماکسیمم محلی' : 'مینیمم محلی';
        const color = p.type === 'max' ? '#ff9800' : '#4caf50';
        addItem(type, p.x, p.y, color);
    });

    // نقاط عطف
    points.inflections.forEach(p => {
        addItem('نقطه عطف', p.x, p.y, '#9c27b0');
    });
}

// ============================================================
//  بخش ۹: تابع اصلی رندر
// ============================================================

function render() {
    const coeffs = readCoefficients();
    currentCoeffs = coeffs;

    const points = computeImportantPoints(coeffs);
    view = computeView(coeffs, points);

    drawGraph(coeffs, points);
    renderPointsList(coeffs, points);
}

// ============================================================
//  بخش ۱۰: رویدادها و راه‌اندازی اولیه
// ============================================================

// تغییر درجه → بازسازی فیلدهای ضرایب و رندر مجدد
degreeSelect.addEventListener('change', () => {
    createCoefficientInputs(parseInt(degreeSelect.value));
    render();
});

// کلیک روی دکمه رسم
plotBtn.addEventListener('click', render);

// به‌روزرسانی خودکار هنگام تغییر ضرایب (با debounce)
let _renderTimer = null;
coefficientsDiv.addEventListener('input', () => {
    clearTimeout(_renderTimer);
    _renderTimer = setTimeout(render, 250);
});

// راه‌اندازی اولیه
createCoefficientInputs(parseInt(degreeSelect.value) || 1);
render();
