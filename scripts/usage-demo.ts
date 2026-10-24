// Person B visual check. Runs the real pipeline end to end on seeded data:
//   fake "Person A" calls -> logger.record -> SQLite -> logger.list -> weeklyStats
// then prints a trace, runs connection checks, and writes an HTML dashboard preview
// plus a sample JSON for the front-end.
//   npx tsx scripts/usage-demo.ts [out.html]
import { writeFileSync } from 'node:fs';
import { openDatabase } from '../src/main/db';
import { getWeeklyStats } from '../src/main/ipc/stats';
import { createUsageLogger, type UsageLogger } from '../src/main/usage/logger';
import { baselineCost, netSavings } from '../src/main/usage/pricing';
import { seedWeek } from '../src/main/usage/seed';
import type { Difficulty, ModelId, UsageRecord, WeeklyStats } from '../src/main/usage/types';
import { WEEK_MS } from '../src/main/usage/weekly';

const DAY = WEEK_MS / 7;
const now = Date.now();
const outHtml = process.argv[2] ?? 'usage-demo.html';

const db = openDatabase(':memory:');
const logger = createUsageLogger(db);

// ---- Stand-in for Person A's chat.ts: shows exactly what must be logged. ----
const MODEL_FOR: Record<Difficulty, ModelId> = { easy: 'haiku', medium: 'sonnet', hard: 'opus' };
const NEXT: Record<ModelId, ModelId> = { haiku: 'sonnet', sonnet: 'opus', opus: 'opus' };
let n = 0;
const base = { language: 'fr', createdAt: 0 };
function fakeSendMessage(l: UsageLogger, id: string, difficulty: Difficulty, t: number) {
  const model = MODEL_FOR[difficulty];
  l.record({ ...base, id: `${id}-cls`, messageId: id, parentMessageId: null, kind: 'classifier',
    model: 'haiku', difficulty, inputTokens: 150, outputTokens: 10, isUpgrade: false, createdAt: t });
  l.record({ ...base, id: `${id}-chat`, messageId: id, parentMessageId: null, kind: 'chat',
    model, difficulty, inputTokens: 900, outputTokens: 700, isUpgrade: false, createdAt: t + 1 });
  return model;
}
function fakeUpgrade(l: UsageLogger, originalId: string, from: ModelId, t: number) {
  const id = `${originalId}-up${++n}`;
  l.record({ ...base, id, messageId: id, parentMessageId: originalId, kind: 'chat',
    model: NEXT[from], difficulty: null, inputTokens: 900, outputTokens: 900, isUpgrade: true, createdAt: t });
}

// ---- 1. Load a seeded week, then add a live, traceable exchange. ----
const seeded = seedWeek(now);
for (const r of seeded) logger.record(r);
const m = fakeSendMessage(logger, 'live-1', 'easy', now - 3000);
fakeUpgrade(logger, 'live-1', m, now - 2000);

// ---- 2. Read back through the same path the stats handler uses. ----
const stats: WeeklyStats = getWeeklyStats(logger, now);
const rows: UsageRecord[] = logger.list(now - WEEK_MS, now);

// ---- 3. Connection checks. ----
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const checks: [string, boolean, string][] = [
  ['Every record written was read back', rows.length === seeded.length + 3, `${rows.length} rows`],
  ['Stats call count matches DB rows', stats.calls === rows.length, `${stats.calls} calls`],
  ['Stats tokens match sum of DB rows', stats.tokensTotal === sum(rows.map((r) => r.inputTokens + r.outputTokens)), `${stats.tokensTotal.toLocaleString()} tokens`],
  ['Per-model calls add up to total calls', sum(Object.values(stats.byModel).map((v) => v.calls)) === stats.calls, 'haiku + sonnet + opus'],
  ['Net saved = baseline - actual', Math.abs(stats.netSaved - (stats.baselineCost - stats.actualCost)) < 1e-9, `$${stats.netSaved.toFixed(4)}`],
  ['Actual = first attempts + upgrades + overhead', Math.abs(stats.actualCost - netSavings(rows).chatCost - stats.upgradeCost - stats.overheadCost) < 1e-9, `$${stats.actualCost.toFixed(4)}`],
  ['Live upgrade was counted', stats.upgradeCount === rows.filter((r) => r.kind === 'chat' && r.isUpgrade).length, `${stats.upgradeCount} upgrades`],
  ['Live message baselined once on its final answer', netSavings(rows.filter((r) => r.id.startsWith('live-1'))).baselineCost === baselineCost(900, 900), 'upgrade tokens x Opus price'],
];

// ---- 4. Terminal trace. ----
console.log('\n== Live exchange as it landed in usage_log ==');
console.table(rows.filter((r) => r.messageId.startsWith('live-1') || r.id.startsWith('live-1')).map((r) => ({
  id: r.id, kind: r.kind, model: r.model, parent: r.parentMessageId ?? '-', in: r.inputTokens, out: r.outputTokens, upgrade: r.isUpgrade,
})));
console.log('== Weekly stats ==');
console.table({ ...stats, byModel: JSON.stringify(stats.byModel), tips: '[]' });
console.log('== Connection checks ==');
for (const [name, ok, detail] of checks) console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (${detail})`);

// ---- 5. Daily net saved for the chart. ----
const daily = Array.from({ length: 7 }, (_, i) => {
  const from = now - (7 - i) * DAY;
  const s = netSavings(rows.filter((r) => r.createdAt >= from && r.createdAt < from + DAY));
  return { label: new Date(from + DAY / 2).toLocaleDateString('en', { weekday: 'short' }), value: s.netSaved };
});

writeFileSync('docs/weekly-stats.sample.json', JSON.stringify(stats, null, 2) + '\n');

// ---- 6. HTML preview. ----
const usd = (v: number) => (v < 0 ? '-' : '') + '$' + Math.abs(v).toFixed(2);
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
const models: [ModelId, string][] = [['haiku', 'Haiku'], ['sonnet', 'Sonnet'], ['opus', 'Opus']];
const maxTok = Math.max(...models.map(([k]) => stats.byModel[k].tokens));
const modelBars = models.map(([k, label], i) => {
  const v = stats.byModel[k], w = Math.max(2, (v.tokens / maxTok) * 360), y = 14 + i * 44;
  return `<g class="bar" data-tip="${label}: ${v.calls} calls, ${v.tokens.toLocaleString()} tokens"><rect x="70" y="${y}" width="${w}" height="26" rx="4" fill="var(--s${i + 1})"/>
    <text x="62" y="${y + 18}" text-anchor="end" class="lbl">${label}</text><text x="${76 + w}" y="${y + 18}" class="val">${v.tokens.toLocaleString()}</text></g>`;
}).join('');
const maxAbs = Math.max(...daily.map((d) => Math.abs(d.value)), 0.01);
const dayBars = daily.map((d, i) => {
  const h = (Math.abs(d.value) / maxAbs) * 90, x = 20 + i * 62, up = d.value >= 0;
  return `<g class="bar" data-tip="${d.label}: ${usd(d.value)} net saved"><rect x="${x}" y="${up ? 110 - h : 110}" width="44" height="${Math.max(h, 1)}" rx="4" fill="var(--ink)"/>
    <text x="${x + 22}" y="148" text-anchor="middle" class="lbl">${d.label}</text></g>`;
}).join('');
const tile = (label: string, value: string, note: string) => `<div class="tile"><div class="tl">${label}</div><div class="tv">${value}</div><div class="tn">${note}</div></div>`;
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Usage Dashboard Preview</title><style>
:root{color-scheme:light;--bg:#fcfcfb;--card:#fff;--line:#e6e5e1;--text:#0b0b0b;--text2:#52514e;--ink:#52514e;--s1:#2a78d6;--s2:#eb6834;--s3:#1baf7a;--ok:#0a6b3a;--bad:#b3261e}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){color-scheme:dark;--bg:#1a1a19;--card:#232322;--line:#33332f;--text:#f0efec;--text2:#c3c2b7;--ink:#c3c2b7;--s1:#3987e5;--s2:#d95926;--s3:#199e70;--ok:#5fd08f;--bad:#ff8a80}}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 system-ui,sans-serif}
main{max-width:880px;margin:0 auto;padding:24px 16px}h1{font-size:22px;margin:0}h2{font-size:15px;margin:0 0 8px}
.sub{color:var(--text2);margin:2px 0 20px}.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin-bottom:16px}
.tile,.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px}.tl{color:var(--text2);font-size:13px}.tv{font-size:28px;font-weight:650}.tn{color:var(--text2);font-size:12px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:12px;margin-bottom:16px}svg{width:100%;height:auto}.lbl{fill:var(--text2);font-size:12px}.val{fill:var(--text);font-size:12px}
.bar rect{transition:opacity .1s}.bar:hover rect{opacity:.8}table{width:100%;border-collapse:collapse;font-size:13px}td,th{text-align:left;padding:4px 8px;border-bottom:1px solid var(--line)}
.ok{color:var(--ok)}.bad{color:var(--bad)}#tip{position:fixed;pointer-events:none;background:var(--text);color:var(--bg);padding:4px 8px;border-radius:6px;font-size:12px;display:none}
.note{color:var(--text2);font-size:12px}</style></head><body><main>
<h1>Usage dashboard preview</h1><p class="sub">Seeded data through the real logger, SQLite and weekly stats. Prices are unverified placeholders.</p>
<div class="tiles">${tile('Net saved (est.)', usd(stats.netSaved), `vs all-Opus ${usd(stats.baselineCost)}`)}${tile('Actual cost', usd(stats.actualCost), `${usd(stats.upgradeCost)} upgrades, ${usd(stats.overheadCost)} routing overhead`)}${tile('Tokens', stats.tokensTotal.toLocaleString(), `${stats.calls} calls`)}${tile('Upgrades', String(stats.upgradeCount), 'first attempt was not enough')}${tile('Energy (est.)', `${stats.energyWh.low.toFixed(1)} to ${stats.energyWh.high.toFixed(1)} Wh`, `estimate; saved ${stats.energySavedWh.low.toFixed(1)} to ${stats.energySavedWh.high.toFixed(1)} Wh vs all-Opus`)}</div>
<div class="grid"><div class="card"><h2>Tokens by model</h2><svg viewBox="0 0 480 150" role="img" aria-label="Tokens by model">${modelBars}</svg></div>
<div class="card"><h2>Net saved per day</h2><svg viewBox="0 0 460 156" role="img" aria-label="Net saved per day">${dayBars}</svg></div></div>
<div class="card" style="margin-bottom:16px"><h2>Connection checks</h2><table>${checks.map(([a, ok, d]) => `<tr><td class="${ok ? 'ok' : 'bad'}">${ok ? 'PASS' : 'FAIL'}</td><td>${esc(a)}</td><td class="note">${esc(d)}</td></tr>`).join('')}</table></div>
<div class="card"><h2>Live exchange in usage_log</h2><table><tr><th>id</th><th>kind</th><th>model</th><th>parent</th><th>in</th><th>out</th></tr>${rows.filter((r) => r.id.startsWith('live-1')).map((r) => `<tr><td>${r.id}</td><td>${r.kind}</td><td>${r.model}</td><td>${r.parentMessageId ?? '-'}</td><td>${r.inputTokens}</td><td>${r.outputTokens}</td></tr>`).join('')}</table>
<p class="note">A classifier call, a Haiku answer, then an Upgrade to Sonnet pointing at the original message.</p></div></main><div id="tip"></div>
<script>const t=document.getElementById('tip');document.querySelectorAll('.bar').forEach(b=>{b.addEventListener('mousemove',e=>{t.textContent=b.dataset.tip;t.style.display='block';t.style.left=e.clientX+12+'px';t.style.top=e.clientY+12+'px'});b.addEventListener('mouseleave',()=>t.style.display='none')})</script></body></html>`;
writeFileSync(outHtml, html);
console.log(`\nWrote ${outHtml} and docs/weekly-stats.sample.json`);
process.exit(checks.every(([, ok]) => ok) ? 0 : 1);
