(() => {
  "use strict";

  const STORAGE_KEY = "morning-drill-v1";
  const DEFAULTS = {
    preset: "everything",
    mathMinutes: 5,
    trickMinutes: 2,
    pushupsSec: 60,
    squatsSec: 60,
    hangSec: 60,
    strict: true,
    minCorrect: 15,
    negativeMarking: false,
    autoAdvance: true,
    decimalPlaces: 3,
    digitMemorySec: 90,
  };

  const state = {
    screen: "home",
    settings: loadSettings(),
    revision: loadRevision(),
    best: loadBest(),
    session: null,
    answer: "",
    feedback: "",
    feedbackKind: "",
    help: null,
    helpKind: null,
    usedHint: false,
    savedThis: false,
  };

  function loadSettings() {
    try {
      return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(STORAGE_KEY + ":settings") || "{}")) };
    } catch {
      return { ...DEFAULTS };
    }
  }
  function saveSettings() {
    localStorage.setItem(STORAGE_KEY + ":settings", JSON.stringify(state.settings));
  }
  function loadRevision() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY + ":revision") || "[]");
    } catch {
      return [];
    }
  }
  function saveRevision() {
    localStorage.setItem(STORAGE_KEY + ":revision", JSON.stringify(state.revision.slice(0, 200)));
  }
  function loadBest() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY + ":best") || "{}");
    } catch {
      return {};
    }
  }
  function saveBest() {
    localStorage.setItem(STORAGE_KEY + ":best", JSON.stringify(state.best));
  }

  const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
  const pick = (arr) => arr[rnd(0, arr.length - 1)];
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  function roundTo(n, d) {
    const f = 10 ** d;
    return Math.round(n * f) / f;
  }

  function fmt(n, d = null) {
    if (d == null) return String(n);
    return Number(n).toFixed(d).replace(/\.?0+$/, (m) => (m.includes(".") ? m.replace(/0+$/, "").replace(/\.$/, "") : m));
  }

  // ---------- problem generators ----------
  function genAdd() {
    const a = rnd(10, 999), b = rnd(10, 999);
    return q(`${a} + ${b}`, a + b, "add", "Add left to right: hundreds, then tens, then ones.");
  }
  function genSub() {
    let a = rnd(50, 999), b = rnd(10, a);
    return q(`${a} − ${b}`, a - b, "sub", `Subtract from left: ${a} − ${b}.`);
  }
  function genMul() {
    const a = rnd(11, 99), b = rnd(11, 99);
    return q(`${a} × ${b}`, a * b, "mul", crissCrossHint(a, b));
  }
  function genDivWhole() {
    const b = rnd(3, 19), a = b * rnd(11, 48);
    return q(`${a} ÷ ${b}`, a / b, "div", `${a} ÷ ${b}: how many times does ${b} fit?`);
  }
  function genDivDec() {
    const b = rnd(3, 17);
    const quot = roundTo(rnd(110, 9875) / 100, state.settings.decimalPlaces);
    const a = roundTo(quot * b, 2);
    const ans = roundTo(a / b, state.settings.decimalPlaces);
    return q(`${fmt(a, 2)} ÷ ${b}`, ans, "divdec", `Divide ${fmt(a, 2)} by ${b}. Need ${state.settings.decimalPlaces} decimals.`, state.settings.decimalPlaces);
  }
  function genPct() {
    const pct = pick([5, 8, 10, 12, 15, 20, 25, 30, 40, 50]);
    const base = rnd(40, 800) * 5;
    return q(`${pct}% of ${base}`, roundTo(base * pct / 100, 2), "pct", `${pct}% = ${pct}/100. ${base} × ${pct} / 100.`);
  }
  function genSquare() {
    const a = rnd(12, 49);
    return q(`${a}²`, a * a, "sq", squareHint(a));
  }
  function genBpsNotional() {
    const bps = rnd(2, 45);
    const notional = pick([1e6, 2e6, 5e6, 1e7]);
    const ans = notional * bps / 10000;
    return q(`${bps} bps of ${fmtMoney(notional)}`, ans, "bps", `1 bp = 1/10000. ${bps} × ${fmtMoney(notional)} / 10000.`);
  }
  function genSpreadBps() {
    const mid = roundTo(rnd(10800, 11200) / 10000, 4);
    const spreadPips = rnd(2, 12);
    const bid = roundTo(mid - spreadPips / 20000, 4);
    const ask = roundTo(mid + spreadPips / 20000, 4);
    const realMid = roundTo((bid + ask) / 2, 4);
    const ans = roundTo((ask - bid) / realMid * 10000, 1);
    return q(`Bid ${bid.toFixed(4)} / Ask ${ask.toFixed(4)}\nSpread in bps?`, ans, "spread", `Spread = ${(ask - bid).toFixed(4)} = ${spreadPips / 2 * 2} pips.\n÷ mid ≈ ${realMid}.`, 1);
  }
  function genFracCmp() {
    let a = rnd(2, 19), b = rnd(a + 1, 25), c = rnd(2, 19), d = rnd(c + 1, 25);
    while (a * d === b * c) { c = rnd(2, 19); d = rnd(c + 1, 25); }
    const leftBigger = a * d > b * c;
    const ans = leftBigger ? 1 : 2;
    return q(`Which is bigger?\n1) ${a}/${b}   2) ${c}/${d}`, ans, "frac", `Cross-multiply: ${a}×${d}=${a * d} vs ${c}×${b}=${c * b}.`);
  }
  function genPow2() {
    const e = rnd(5, 12);
    return q(`2^${e}`, 2 ** e, "pow2", `Powers of 2: … 32,64,128,256,512,1024,2048,4096.`);
  }
  function genPnL() {
    const buy = rnd(200, 900);
    const pxBuy = roundTo(rnd(2000, 4000) / 100, 2);
    const sold = rnd(100, buy);
    const pxSell = roundTo(pxBuy + rnd(-40, 50) / 100, 2);
    const left = buy - sold;
    const mark = roundTo(pxBuy + rnd(-30, 40) / 100, 2);
    const ans = roundTo(sold * (pxSell - pxBuy) + left * (mark - pxBuy), 2);
    return q(`Buy ${buy} @ ${pxBuy}\nSell ${sold} @ ${pxSell}\nMark ${mark}\nP&L?`, ans, "pnl", `All bought at ${pxBuy}.\nP&L = ${sold}×(${pxSell}-${pxBuy}) + ${left}×(${mark}-${pxBuy}).`, 2);
  }
  function genSeq() {
    const start = rnd(2, 9);
    const step = rnd(2, 7);
    const kind = pick(["arith", "geom"]);
    let seq, ans, hint;
    if (kind === "arith") {
      seq = [start, start + step, start + 2 * step, start + 3 * step];
      ans = start + 4 * step;
      hint = `Arithmetic: common difference ${step}.`;
    } else {
      const r = pick([2, 3]);
      seq = [start, start * r, start * r * r, start * r * r * r];
      ans = start * r ** 4;
      hint = `Geometric: multiply by ${r} each time.`;
    }
    return q(`${seq.join(", ")}, ?`, ans, "seq", hint);
  }
  function genRule72() {
    const r = pick([3, 4, 5, 6, 8, 9, 12]);
    return q(`Rule of 72: years to double at ${r}%?`, Math.round(72 / r), "r72", `Years ≈ 72 / rate. 72/${r}.`);
  }
  function genDeltaHedge() {
    const delta = roundTo(rnd(15, 85) / 100, 2);
    const contracts = rnd(2, 20);
    const mult = pick([100, 100]);
    const ans = Math.round(delta * contracts * mult);
    return q(`Delta ${delta}, ${contracts} contracts ×${mult}\nShares to hedge?`, ans, "delta", `Shares ≈ Δ × contracts × multiplier = ${delta}×${contracts}×${mult}.`);
  }
  function genAnnualVol() {
    const daily = roundTo(rnd(50, 250) / 100, 2);
    const ans = roundTo(daily * Math.sqrt(252), 1);
    return q(`Daily vol ${daily}% → annualised?`, ans, "vol", `× √252 ≈ ×15.87. ${daily}×15.87.`, 1);
  }
  function genBayes() {
    const prev = pick([1, 2, 5]);
    const sens = pick([90, 95, 99]);
    const falsePos = pick([5, 10, 1]);
    // P(D|+) ≈ (sens*prev) / (sens*prev + falsePos*(100-prev))
    const num = sens * prev;
    const den = sens * prev + falsePos * (100 - prev);
    const ans = roundTo(num / den * 100, 1);
    return q(`Prevalence ${prev}%, test ${sens}% sensitive,\nfalse positive ${falsePos}%.\nP(disease|+) %?`, ans, "bayes", `Use 10000 people. True+: ${prev * 100}×${sens/100}. False+: ${(100 - prev) * 100}×${falsePos/100}.`, 1);
  }
  function genEV() {
    const p = pick([0.2, 0.25, 0.3, 0.4, 0.5]);
    const win = rnd(5, 20);
    const lose = rnd(2, 10);
    const ans = roundTo(p * win - (1 - p) * lose, 2);
    return q(`P(win)=${p}, win +${win}, lose −${lose}\nEV?`, ans, "ev", `EV = ${p}×${win} − ${1 - p}×${lose}.`, 2);
  }
  function genEleven() {
    const a = rnd(12, 89);
    return q(`${a} × 11`, a * 11, "x11", mul11Hint(a));
  }
  function genNear100() {
    const a = rnd(91, 109), b = rnd(91, 109);
    return q(`${a} × ${b}`, a * b, "near100", closeTogetherHint(a, b, 100));
  }
  function genPctChange() {
    const from = rnd(40, 200);
    const to = from + rnd(-30, 50);
    const ans = roundTo((to - from) / from * 100, 1);
    return q(`${from} → ${to}\n% change?`, ans, "pctch", `(${to}−${from})/${from} × 100.`, 1);
  }
  function genFactorialCancel() {
    const n = rnd(8, 14);
    const k = rnd(2, 4);
    let ans = 1;
    for (let i = 0; i < k; i++) ans *= (n - i);
    return q(`${n}! / ${n - k}!`, ans, "fact", `${n}×${n - 1}${k > 2 ? "×…" : ""} down ${k} terms.`);
  }
  function genBinary() {
    const n = rnd(10, 63);
    return q(`${n} in binary? (enter as decimal digits, e.g. 1011 → 1011)`, Number.parseInt(n.toString(2), 10), "bin", `${n} → binary ${n.toString(2)}. Type those digits as a number.`);
  }

  function q(prompt, answer, type, hint, decimals = 0) {
    const explanation = `Answer: ${answer}\n${hint}`;
    return { prompt, answer, type, hint, explanation, decimals };
  }

  function crissCrossHint(a, b) {
    const a1 = Math.floor(a / 10), a0 = a % 10, b1 = Math.floor(b / 10), b0 = b % 10;
    return `Criss-cross: ${a1}×${b1}=${a1 * b1}00; cross ${a1}×${b0}+${a0}×${b1}=${a1 * b0 + a0 * b1}0; ${a0}×${b0}=${a0 * b0}.`;
  }
  function squareHint(a) {
    if (a > 50) {
      const d = a - 50;
      return `Near 50: 50²=2500, then (50+d)² = 2500 + 100d + d². d=${a - 50}.`;
    }
    const base = Math.round(a / 10) * 10;
    const d = a - base;
    return `(${base}+${d})² = ${base}² + 2×${base}×${d} + ${d}².`;
  }
  function mul11Hint(a) {
    const s = String(a);
    if (s.length === 2) {
      const sum = Number(s[0]) + Number(s[1]);
      return `×11: keep digits, insert sum ${s[0]}+${s[1]}=${sum}${sum >= 10 ? " (carry 1)" : ""}.`;
    }
    return `×11 = ×10 + ×1.`;
  }
  function closeTogetherHint(a, b, base) {
    const da = a - base, db = b - base;
    return `Base ${base}: (${base}+${da})(${base}+${db}) = ${base}² + ${base}(${da}+${db}) + ${da}×${db}.`;
  }
  function fmtMoney(n) {
    if (n >= 1e6) return `${n / 1e6}m`;
    return String(n);
  }

  const GENERATORS = {
    everything: [genAdd, genSub, genMul, genDivWhole, genDivDec, genPct, genSquare, genBpsNotional, genSpreadBps, genFracCmp, genPow2, genPnL, genSeq, genRule72, genDeltaHedge, genAnnualVol, genBayes, genEV, genEleven, genNear100, genPctChange, genFactorialCancel],
    zetamac: [genAdd, genSub, genMul, genDivWhole],
    trading: [genDivDec, genPct, genBpsNotional, genSpreadBps, genPnL, genDeltaHedge, genAnnualVol, genEV, genPctChange, genBayes, genRule72],
    quant: [genMul, genDivDec, genFracCmp, genPow2, genSeq, genBayes, genEV, genFactorialCancel, genAnnualVol, genPnL, genSpreadBps],
  };

  // ---------- tricks of the day ----------
  const TRICKS = [
    {
      id: "x11",
      title: "Multiply by 11",
      body: "For a 2-digit number ab: keep a and b, insert a+b in the middle. If a+b ≥ 10, carry 1 to the left.\n\nExample: 47 × 11 → 4, 4+7=11 → 517.",
      practice: () => genEleven(),
    },
    {
      id: "near100",
      title: "Products near 100",
      body: "Write each number as 100 ± d. Then (100+d)(100+e) = 10000 + 100(d+e) + d·e.\n\nExample: 96 × 97 = (100−4)(100−3) = 10000 − 700 + 12 = 9312.",
      practice: () => genNear100(),
    },
    {
      id: "square",
      title: "Squaring near 50",
      body: "(50+d)² = 2500 + 100d + d².\n\nExample: 53² = 2500 + 300 + 9 = 2809.",
      practice: () => { const a = rnd(45, 59); return q(`${a}²`, a * a, "sq", squareHint(a)); },
    },
    {
      id: "criss",
      title: "Criss-cross 2×2 multiply",
      body: "Tens×tens, cross sum, ones×ones. Watch carries.\n\nExample: 23 × 14 → 2×1=2, cross 2×4+3×1=11, 3×4=12 → 322.",
      practice: () => genMul(),
    },
    {
      id: "pct",
      title: "Fast percentages",
      body: "10% = ÷10. 5% = half of that. 1% = ÷100. Build what you need.\n\nExample: 15% of 240 = 10% (24) + 5% (12) = 36.",
      practice: () => genPct(),
    },
    {
      id: "bps",
      title: "Basis points",
      body: "1 bp = 0.01% = 1/10000 of notional.\n\nExample: 12 bps of $5m = 5e6 × 12 / 10000 = $6,000.",
      practice: () => genBpsNotional(),
    },
    {
      id: "spread",
      title: "Spread in bps",
      body: "Spread_bps ≈ (ask − bid) / mid × 10000.\nFor FX, count pips first, then divide by mid.\n\n1/x ≈ 1 − (x−1) for x near 1.",
      practice: () => genSpreadBps(),
    },
    {
      id: "pnl",
      title: "Position P&L",
      body: "Ignore cash plumbing: mark everything vs your average entry.\nP&L = closed qty × (exit − entry) + open qty × (mark − entry).",
      practice: () => genPnL(),
    },
    {
      id: "r72",
      title: "Rule of 72",
      body: "Years to double ≈ 72 / interest rate (%).\n\nAt 8%: 72/8 = 9 years.",
      practice: () => genRule72(),
    },
    {
      id: "vol",
      title: "Annualise volatility",
      body: "σ_annual ≈ σ_period × √N.\nDaily → √252 ≈ 15.87. Weekly → √52 ≈ 7.21.",
      practice: () => genAnnualVol(),
    },
    {
      id: "frac",
      title: "Compare fractions fast",
      body: "Cross-multiply: a/b ? c/d ↔ a·d ? c·b. No division needed.",
      practice: () => genFracCmp(),
    },
    {
      id: "bayes",
      title: "Bayes with counts",
      body: "Use a population of 10,000. Count true positives and false positives, then TP/(TP+FP).",
      practice: () => genBayes(),
    },
    {
      id: "delta",
      title: "Delta hedge size",
      body: "Shares ≈ Δ × contracts × multiplier.\nLong calls → sell shares to hedge.",
      practice: () => genDeltaHedge(),
    },
    {
      id: "divdec",
      title: "Decimal division",
      body: "Scale to whole numbers when helpful, keep place value, stop at the required decimals.",
      practice: () => genDivDec(),
    },
    {
      id: "left",
      title: "Left-to-right addition",
      body: "Add hundreds first, then tens, then ones. You get a running total you can say out loud.",
      practice: () => genAdd(),
    },
  ];

  function dayIndex() {
    const d = new Date();
    return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  }
  function todaysTrick() {
    return TRICKS[dayIndex() % TRICKS.length];
  }

  // ---------- session ----------
  function newQuestion(mode) {
    const gens = GENERATORS[state.settings.preset] || GENERATORS.everything;
    if (mode === "trick") return todaysTrick().practice();
    return pick(gens)();
  }

  function startSession(kind) {
    const s = state.settings;
    const now = Date.now();
    const startWithTrick = kind === "morning" && s.trickMinutes > 0;
    state.session = {
      kind, // morning | unlock | revision
      phase: startWithTrick ? "trick" : "math",
      startedAt: now,
      phaseEndsAt: now + (startWithTrick ? s.trickMinutes : s.mathMinutes) * 60 * 1000,
      mathEndsAt: startWithTrick ? null : now + s.mathMinutes * 60 * 1000,
      score: 0,
      correct: 0,
      wrong: 0,
      skipped: 0,
      byType: {},
      question: null,
      exercise: null,
      exerciseEndsAt: null,
      revisionQueue: kind === "revision" ? state.revision.filter((x) => (x.mastered || 0) < 2).slice() : null,
    };
    nextQuestion();
    state.screen = state.session.phase === "trick" ? "trick" : "math";
    state.answer = "";
    state.feedback = "";
    state.help = null;
    render();
    startTicker();
  }

  function nextQuestion() {
    state.answer = "";
    state.feedback = "";
    state.feedbackKind = "";
    state.help = null;
    state.helpKind = null;
    state.usedHint = false;
    state.savedThis = false;
    const sess = state.session;
    if (sess.revisionQueue) {
      if (!sess.revisionQueue.length) {
        finishMath();
        return;
      }
      const item = sess.revisionQueue.shift();
      sess.question = {
        prompt: item.prompt,
        answer: item.answer,
        type: item.type || "rev",
        hint: item.hint || "Revisit the method.",
        explanation: item.explanation || `Answer: ${item.answer}`,
        decimals: item.decimals || 0,
        revisionId: item.id,
      };
      return;
    }
    sess.question = newQuestion(sess.phase === "trick" ? "trick" : "math");
  }

  function normalizeAnswer(str) {
    return String(str).trim().replace(",", ".").replace(/\s+/g, "");
  }

  function answersMatch(input, expected, decimals) {
    const s = normalizeAnswer(input);
    if (s === "" || s === "-" || s === "." || s === "-.") return false;
    const n = Number(s);
    if (!Number.isFinite(n)) return false;
    const exp = Number(expected);
    if (decimals > 0) {
      // accept once enough decimals typed and rounded value matches
      const parts = s.replace("-", "").split(".");
      const typedDecimals = parts[1] ? parts[1].length : 0;
      if (typedDecimals < decimals && Math.abs(n - exp) > 0.5 * 10 ** -decimals) {
        // allow exact early match if already exact enough
        if (Math.abs(n - exp) > 10 ** -(decimals + 1)) return false;
      }
      return Math.abs(roundTo(n, decimals) - roundTo(exp, decimals)) < 10 ** -(decimals + 1);
    }
    return Math.abs(n - exp) < 1e-9;
  }

  function onAnswerChange() {
    const sess = state.session;
    if (!sess || !sess.question) return;
    const qn = sess.question;
    if (!answersMatch(state.answer, qn.answer, qn.decimals || 0)) return;
    // correct
    const points = state.usedHint ? 0 : 1;
    sess.correct += 1;
    sess.score += points;
    bumpType(qn.type, true);
    state.feedback = points ? "Correct" : "Correct (hint used — 0 pts)";
    state.feedbackKind = "good";
    if (qn.revisionId) markRevision(qn.revisionId, true);
    render();
    setTimeout(() => {
      if (sess.phase === "trick") {
        // stay in trick until timer; keep practising
        nextQuestion();
        render();
      } else {
        nextQuestion();
        render();
      }
    }, 220);
  }

  function bumpType(type, ok) {
    const t = state.session.byType[type] || (state.session.byType[type] = { ok: 0, bad: 0 });
    if (ok) t.ok += 1; else t.bad += 1;
  }

  function skipQuestion() {
    const sess = state.session;
    const qn = sess.question;
    sess.skipped += 1;
    if (state.settings.negativeMarking) sess.score -= 1;
    bumpType(qn.type, false);
    saveQuestion(qn, true);
    if (qn.revisionId) markRevision(qn.revisionId, false);
    nextQuestion();
    render();
  }

  function showHint() {
    state.usedHint = true;
    state.help = state.session.question.hint;
    state.helpKind = "hint";
    saveQuestion(state.session.question, true);
    render();
  }

  function showAnswer() {
    state.help = state.session.question.explanation;
    state.helpKind = "answer";
    bumpType(state.session.question.type, false);
    if (state.settings.negativeMarking) state.session.score -= 1;
    saveQuestion(state.session.question, true);
    render();
  }

  function saveQuestion(qn, auto = false) {
    if (state.savedThis && auto) return;
    const id = qn.revisionId || `${qn.type}:${qn.prompt}`;
    if (!state.revision.some((x) => x.id === id)) {
      state.revision.unshift({
        id,
        prompt: qn.prompt,
        answer: qn.answer,
        type: qn.type,
        hint: qn.hint,
        explanation: qn.explanation,
        decimals: qn.decimals || 0,
        mastered: 0,
        savedAt: Date.now(),
      });
      saveRevision();
    }
    state.savedThis = true;
    if (!auto) {
      state.feedback = "Saved for revision";
      state.feedbackKind = "";
      render();
    }
  }

  function markRevision(id, ok) {
    const item = state.revision.find((x) => x.id === id);
    if (!item) return;
    item.mastered = ok ? (item.mastered || 0) + 1 : 0;
    if (item.mastered >= 2) {
      state.revision = state.revision.filter((x) => x.id !== id);
    }
    saveRevision();
  }

  function finishTrick() {
    const s = state.settings;
    state.session.phase = "math";
    state.session.phaseEndsAt = Date.now() + s.mathMinutes * 60 * 1000;
    state.session.mathEndsAt = state.session.phaseEndsAt;
    state.screen = "math";
    nextQuestion();
    render();
  }

  function finishMath() {
    const s = state.settings;
    const exercises = [];
    if (s.pushupsSec > 0) exercises.push({ id: "pushups", title: "Push-ups", sec: s.pushupsSec });
    if (s.squatsSec > 0) exercises.push({ id: "squats", title: "Squats", sec: s.squatsSec });
    if (s.hangSec > 0) exercises.push({ id: "hang", title: "Dead hang", sec: s.hangSec });

    const preset = state.settings.preset;
    const best = state.best[preset] || 0;
    if (state.session.score > best) {
      state.best[preset] = state.session.score;
      saveBest();
    }

    if (!exercises.length || state.session.kind === "unlock" || state.session.kind === "revision") {
      state.session.phase = "done";
      state.screen = "done";
      render();
      return;
    }
    state.session.exercises = exercises;
    state.session.exerciseIndex = 0;
    startExercise(0);
  }

  function startExercise(i) {
    const ex = state.session.exercises[i];
    state.session.phase = "exercise";
    state.session.exercise = ex;
    state.session.exerciseEndsAt = Date.now() + ex.sec * 1000;
    state.session.exerciseIndex = i;
    state.screen = "exercise";
    render();
  }

  function finishExercise() {
    const next = state.session.exerciseIndex + 1;
    if (next < state.session.exercises.length) startExercise(next);
    else {
      state.session.phase = "done";
      state.screen = "done";
      render();
    }
  }

  function canUnlock() {
    if (!state.settings.strict) return true;
    return state.session.correct >= state.settings.minCorrect;
  }

  function runShortcut(name) {
    // iOS Shortcuts URL scheme
    const url = `shortcuts://run-shortcut?name=${encodeURIComponent(name)}`;
    window.location.href = url;
  }

  // ---------- input ----------
  function pressKey(k) {
    if (!state.session || (state.screen !== "math" && state.screen !== "trick")) return;
    if (state.helpKind === "answer") return;
    if (k === "⌫") {
      state.answer = state.answer.slice(0, -1);
    } else if (k === "C") {
      state.answer = "";
    } else if (k === "±") {
      if (state.answer.startsWith("-")) state.answer = state.answer.slice(1);
      else state.answer = "-" + state.answer;
    } else if (k === ".") {
      if (!state.answer.includes(".")) state.answer += state.answer === "-" || state.answer === "" ? "0." : ".";
    } else {
      state.answer += k;
    }
    state.feedback = "";
    renderAnswerOnly();
    onAnswerChange();
  }

  // physical keyboard still works on desktop
  window.addEventListener("keydown", (e) => {
    if (state.screen !== "math" && state.screen !== "trick") return;
    if (e.key >= "0" && e.key <= "9") { e.preventDefault(); pressKey(e.key); }
    else if (e.key === "." || e.key === ",") { e.preventDefault(); pressKey("."); }
    else if (e.key === "Backspace") { e.preventDefault(); pressKey("⌫"); }
    else if (e.key === "Escape") { e.preventDefault(); pressKey("C"); }
    else if (e.key === "-") { e.preventDefault(); pressKey("±"); }
  });

  // ---------- ticker ----------
  let tickTimer = null;
  function startTicker() {
    if (tickTimer) return;
    tickTimer = setInterval(() => {
      if (!state.session) return;
      const now = Date.now();
      if (state.session.phase === "trick" && now >= state.session.phaseEndsAt) {
        finishTrick();
        return;
      }
      if (state.session.phase === "math" && state.session.phaseEndsAt && now >= state.session.phaseEndsAt) {
        finishMath();
        return;
      }
      if (state.session.phase === "exercise" && now >= state.session.exerciseEndsAt) {
        finishExercise();
        return;
      }
      // update timers in DOM without full rerender when possible
      const el = document.getElementById("phase-timer");
      if (el) el.textContent = formatRemain(remainMs());
      const ex = document.getElementById("ex-timer");
      if (ex) ex.textContent = formatRemain(Math.max(0, state.session.exerciseEndsAt - now));
      const bar = document.getElementById("phase-bar");
      if (bar) bar.style.width = `${phasePct()}%`;
    }, 200);
  }
  function stopTicker() {
    clearInterval(tickTimer);
    tickTimer = null;
  }

  function remainMs() {
    if (!state.session || !state.session.phaseEndsAt) return 0;
    return Math.max(0, state.session.phaseEndsAt - Date.now());
  }
  function phasePct() {
    const sess = state.session;
    if (!sess || !sess.phaseEndsAt) return 0;
    let total;
    if (sess.phase === "trick") total = state.settings.trickMinutes * 60 * 1000;
    else if (sess.phase === "math") total = state.settings.mathMinutes * 60 * 1000;
    else return 0;
    return clamp(100 * (1 - remainMs() / total), 0, 100);
  }
  function formatRemain(ms) {
    const s = Math.ceil(ms / 1000);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
  }

  // ---------- render ----------
  const app = document.getElementById("app");

  function render() {
    if (state.screen === "home") app.innerHTML = renderHome();
    else if (state.screen === "settings") app.innerHTML = renderSettings();
    else if (state.screen === "revision") app.innerHTML = renderRevision();
    else if (state.screen === "trick") app.innerHTML = renderTrick();
    else if (state.screen === "math") app.innerHTML = renderMath();
    else if (state.screen === "exercise") app.innerHTML = renderExercise();
    else if (state.screen === "done") app.innerHTML = renderDone();
    bind();
  }

  function renderAnswerOnly() {
    const ans = document.getElementById("answer");
    if (ans) {
      ans.textContent = state.answer;
      ans.classList.toggle("empty", !state.answer);
    }
  }

  function renderHome() {
    const trick = todaysTrick();
    const best = state.best[state.settings.preset] || 0;
    return `
      <section class="screen active">
        <div class="topbar">
          <div class="brand">Morning Drill</div>
          <button class="btn ghost" data-go="settings">Settings</button>
        </div>
        <div class="hero">Wake up. Solve. Move.</div>
        <div class="sub">Today’s trick: <strong>${esc(trick.title)}</strong>. Then ${state.settings.mathMinutes} min of quant math and short exercise timers.</div>
        <div class="statgrid">
          <div class="stat"><div class="n">${state.settings.minCorrect}</div><div class="l">strict target</div></div>
          <div class="stat"><div class="n">${best}</div><div class="l">best score</div></div>
          <div class="stat"><div class="n">${state.revision.length}</div><div class="l">to revise</div></div>
        </div>
        <div class="stack grow" style="justify-content:flex-end">
          <button class="btn primary block" data-start="morning">Start morning drill</button>
          <button class="btn block" data-start="unlock">5‑min unlock drill</button>
          <button class="btn ghost block" data-go="revision">Revision (${state.revision.length})</button>
        </div>
        <div class="tiny">Add to Home Screen from Safari for a full-screen app. Shortcuts can open this URL when your alarm stops.</div>
      </section>`;
  }

  function renderSettings() {
    const s = state.settings;
    return `
      <section class="screen active">
        <div class="topbar">
          <div class="brand">Settings</div>
          <button class="btn ghost" data-go="home">Done</button>
        </div>
        <div class="card scroll grow stack">
          <label class="field">Preset
            <select id="preset">
              <option value="everything" ${s.preset === "everything" ? "selected" : ""}>Everything</option>
              <option value="zetamac" ${s.preset === "zetamac" ? "selected" : ""}>Zetamac</option>
              <option value="trading" ${s.preset === "trading" ? "selected" : ""}>Trading desk</option>
              <option value="quant" ${s.preset === "quant" ? "selected" : ""}>Quant interview</option>
            </select>
          </label>
          <label class="field">Math minutes
            <input type="number" id="mathMinutes" min="1" max="30" value="${s.mathMinutes}">
          </label>
          <label class="field">Trick of the day minutes
            <input type="number" id="trickMinutes" min="0" max="10" value="${s.trickMinutes}">
          </label>
          <label class="field">Push-ups seconds (0 = skip)
            <input type="number" id="pushupsSec" min="0" max="600" value="${s.pushupsSec}">
          </label>
          <label class="field">Squats seconds (0 = skip)
            <input type="number" id="squatsSec" min="0" max="600" value="${s.squatsSec}">
          </label>
          <label class="field">Hang seconds (0 = skip)
            <input type="number" id="hangSec" min="0" max="600" value="${s.hangSec}">
          </label>
          <label class="field">Decimal places
            <input type="number" id="decimalPlaces" min="1" max="5" value="${s.decimalPlaces}">
          </label>
          <label class="field">Strict min correct
            <input type="number" id="minCorrect" min="0" max="100" value="${s.minCorrect}">
          </label>
          <div class="toggle"><span>Strict mode</span><input type="checkbox" id="strict" ${s.strict ? "checked" : ""}></div>
          <div class="toggle"><span>Negative marking</span><input type="checkbox" id="negativeMarking" ${s.negativeMarking ? "checked" : ""}></div>
          <div class="tiny">Shortcut names expected: <strong>Morning Done</strong> and <strong>Drill Done</strong>.</div>
        </div>
      </section>`;
  }

  function renderRevision() {
    const items = state.revision;
    return `
      <section class="screen active">
        <div class="topbar">
          <div class="brand">Revision</div>
          <button class="btn ghost" data-go="home">Back</button>
        </div>
        <div class="row">
          <button class="btn primary" data-start="revision" ${items.length ? "" : "disabled"}>Practise saved</button>
          <button class="btn danger" data-clear-rev ${items.length ? "" : "disabled"}>Clear</button>
        </div>
        <div class="card scroll grow">
          ${items.length ? items.map((x) => `
            <div class="list-item">
              <div class="mono">${esc(x.prompt)}</div>
              <div class="tiny">${esc(x.type)} · mastered ${x.mastered || 0}/2</div>
              <button class="btn ghost" data-show-rev="${escAttr(x.id)}">Show answer</button>
              <div class="help" id="rev-${escAttr(x.id)}" hidden>${esc(x.explanation || String(x.answer))}</div>
            </div>`).join("") : `<div class="muted">Nothing saved yet. Misses and hints are stored automatically.</div>`}
        </div>
      </section>`;
  }

  function renderTrick() {
    const trick = todaysTrick();
    const qn = state.session.question;
    return `
      <section class="screen active">
        <div class="topbar">
          <div class="brand">Trick of the day</div>
          <div class="mono" id="phase-timer">${formatRemain(remainMs())}</div>
        </div>
        <div class="progress"><span id="phase-bar" style="width:${phasePct()}%"></span></div>
        <div class="card">
          <div style="font-weight:700;margin-bottom:6px">${esc(trick.title)}</div>
          <div class="sub" style="white-space:pre-wrap">${esc(trick.body)}</div>
        </div>
        <div class="question-box">
          <div class="tiny">Practice</div>
          <div class="question">${esc(qn.prompt)}</div>
          <div class="answer ${state.answer ? "" : "empty"}" id="answer">${esc(state.answer)}</div>
          <div class="feedback ${state.feedbackKind}" id="feedback">${esc(state.feedback)}</div>
          ${state.help ? `<div class="help">${esc(state.help)}</div>` : ""}
        </div>
        ${renderActionRow()}
        ${renderKeypad()}
      </section>`;
  }

  function renderMath() {
    const qn = state.session.question;
    const sess = state.session;
    return `
      <section class="screen active">
        <div class="topbar">
          <div class="brand">${sess.kind === "revision" ? "Revision" : "Math"}</div>
          <div class="mono" id="phase-timer">${formatRemain(remainMs())}</div>
        </div>
        <div class="progress"><span id="phase-bar" style="width:${phasePct()}%"></span></div>
        <div class="row">
          <div class="stat"><div class="n">${sess.score}</div><div class="l">score</div></div>
          <div class="stat"><div class="n">${sess.correct}</div><div class="l">correct</div></div>
          <div class="stat"><div class="n">${sess.wrong + sess.skipped}</div><div class="l">miss</div></div>
        </div>
        <div class="question-box">
          <div class="question">${esc(qn.prompt)}</div>
          <div class="answer ${state.answer ? "" : "empty"}" id="answer">${esc(state.answer)}</div>
          <div class="feedback ${state.feedbackKind}" id="feedback">${esc(state.feedback)}</div>
          ${state.help ? `<div class="help">${esc(state.help)}</div>` : ""}
        </div>
        ${renderActionRow()}
        ${renderKeypad()}
      </section>`;
  }

  function renderActionRow() {
    return `
      <div class="row">
        <button class="btn ghost" data-act="hint">Hint</button>
        <button class="btn ghost" data-act="answer">${state.helpKind === "answer" ? "Next" : "Show answer"}</button>
        <button class="btn ghost" data-act="save">Save</button>
        <button class="btn ghost" data-act="skip">Skip</button>
      </div>`;
  }

  function renderKeypad() {
    const keys = ["1","2","3","4","5","6","7","8","9","±","0",".","C","⌫"];
    return `<div class="keypad" id="keypad">
      ${keys.map((k) => `<button class="key ${k === "C" || k === "⌫" || k === "±" ? "action" : ""}" data-key="${k}">${k}</button>`).join("")}
    </div>`;
  }

  function renderExercise() {
    const ex = state.session.exercise;
    const remain = Math.max(0, state.session.exerciseEndsAt - Date.now());
    return `
      <section class="screen active">
        <div class="topbar">
          <div class="brand">Exercise</div>
          <div class="muted">${state.session.exerciseIndex + 1}/${state.session.exercises.length}</div>
        </div>
        <div class="grow stack" style="justify-content:center;align-items:center;gap:18px">
          <div class="exercise-title">${esc(ex.title)}</div>
          <div class="timer-big" id="ex-timer">${formatRemain(remain)}</div>
          <div class="sub">Honor system — keep moving until the timer hits zero.</div>
        </div>
        <button class="btn block" data-act="skip-ex">Skip exercise</button>
      </section>`;
  }

  function renderDone() {
    const sess = state.session;
    const unlocked = canUnlock();
    const weak = Object.entries(sess.byType)
      .map(([type, v]) => ({ type, rate: v.ok / Math.max(1, v.ok + v.bad), n: v.ok + v.bad, ...v }))
      .filter((x) => x.n > 0)
      .sort((a, b) => a.rate - b.rate || b.n - a.n)
      .slice(0, 5);
    return `
      <section class="screen active">
        <div class="topbar">
          <div class="brand">Done</div>
          <button class="btn ghost" data-go="home">Home</button>
        </div>
        <div class="hero">${unlocked ? "Drill complete." : "Not yet."}</div>
        <div class="statgrid">
          <div class="stat"><div class="n">${sess.score}</div><div class="l">score</div></div>
          <div class="stat"><div class="n">${sess.correct}</div><div class="l">correct</div></div>
          <div class="stat"><div class="n">${state.settings.minCorrect}</div><div class="l">needed</div></div>
        </div>
        <div class="card scroll grow">
          <div style="font-weight:700;margin-bottom:8px">Weakest types</div>
          ${weak.length ? weak.map((w) => `<div class="list-item"><div>${esc(w.type)}</div><div class="tiny">${w.ok}/${w.n} correct</div></div>`).join("") : `<div class="muted">No data yet.</div>`}
        </div>
        <div class="stack">
          ${unlocked
            ? `<button class="btn good block" data-act="morning-done">Turn off backup alarm</button>
               <button class="btn primary block" data-act="drill-done">Mark Drill Done</button>`
            : `<button class="btn primary block" data-start="${sess.kind === "unlock" ? "unlock" : "morning"}">Another round</button>
               <div class="tiny">Strict mode needs ${state.settings.minCorrect} correct before unlock actions appear.</div>`}
        </div>
      </section>`;
  }

  function esc(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }
  function escAttr(s) {
    return esc(s).replaceAll("`", "&#96;");
  }

  function bind() {
    app.querySelectorAll("[data-go]").forEach((el) => el.addEventListener("click", () => {
      if (el.getAttribute("data-go") === "settings") saveSettingsFromForm();
      state.screen = el.getAttribute("data-go");
      if (state.screen === "home") { state.session = null; }
      render();
    }));
    app.querySelectorAll("[data-start]").forEach((el) => el.addEventListener("click", () => {
      saveSettingsFromForm();
      startSession(el.getAttribute("data-start"));
    }));
    app.querySelectorAll("[data-key]").forEach((el) => el.addEventListener("click", () => pressKey(el.getAttribute("data-key"))));
    app.querySelectorAll("[data-act]").forEach((el) => el.addEventListener("click", () => {
      const act = el.getAttribute("data-act");
      if (act === "hint") showHint();
      else if (act === "answer") {
        if (state.helpKind === "answer") { nextQuestion(); render(); }
        else showAnswer();
      }
      else if (act === "save") saveQuestion(state.session.question, false);
      else if (act === "skip") skipQuestion();
      else if (act === "skip-ex") finishExercise();
      else if (act === "morning-done") runShortcut("Morning Done");
      else if (act === "drill-done") runShortcut("Drill Done");
    }));
    app.querySelectorAll("[data-show-rev]").forEach((el) => el.addEventListener("click", () => {
      const id = el.getAttribute("data-show-rev");
      const box = document.getElementById(`rev-${id}`);
      if (box) box.hidden = !box.hidden;
    }));
    const clear = app.querySelector("[data-clear-rev]");
    if (clear) clear.addEventListener("click", () => {
      state.revision = [];
      saveRevision();
      render();
    });
    ["preset","mathMinutes","trickMinutes","pushupsSec","squatsSec","hangSec","decimalPlaces","minCorrect","strict","negativeMarking"]
      .forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener("change", saveSettingsFromForm);
      });
  }

  function saveSettingsFromForm() {
    if (state.screen !== "settings") return;
    const num = (id, fallback) => {
      const el = document.getElementById(id);
      if (!el) return fallback;
      const v = Number(el.value);
      return Number.isFinite(v) ? v : fallback;
    };
    const s = state.settings;
    s.preset = document.getElementById("preset")?.value || s.preset;
    s.mathMinutes = clamp(num("mathMinutes", s.mathMinutes), 1, 30);
    s.trickMinutes = clamp(num("trickMinutes", s.trickMinutes), 0, 10);
    s.pushupsSec = clamp(num("pushupsSec", s.pushupsSec), 0, 600);
    s.squatsSec = clamp(num("squatsSec", s.squatsSec), 0, 600);
    s.hangSec = clamp(num("hangSec", s.hangSec), 0, 600);
    s.decimalPlaces = clamp(num("decimalPlaces", s.decimalPlaces), 1, 5);
    s.minCorrect = clamp(num("minCorrect", s.minCorrect), 0, 100);
    s.strict = !!document.getElementById("strict")?.checked;
    s.negativeMarking = !!document.getElementById("negativeMarking")?.checked;
    saveSettings();
  }

  // Prevent iOS rubber-band scroll stealing the keypad
  document.addEventListener("touchmove", (e) => {
    if (e.target.closest && e.target.closest(".scroll")) return;
    if (state.screen === "math" || state.screen === "trick" || state.screen === "exercise") {
      // allow nothing unless in scroll areas
      if (!e.target.closest(".scroll") && !e.target.closest(".card.scroll")) {
        // only prevent if not scrolling a scrollable
      }
    }
  }, { passive: true });

  // Service worker optional — skip for simplicity on GH pages path issues

  render();
})();
