import { useState, useMemo, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine, Cell,
  Area, AreaChart
} from "recharts";

/* ─────────────── PROP FIRM CONFIGS ─────────────── */
const FIRMS = {
  instant_funding: {
    name: "Instant Funding",
    accounts: {
      if_standard: { name: "Instant Funding", bestDayPct: null, minProfitPct: null, dailyDD: null, staticDD: null, smartDD: 10, riskPerTrade: 3, profitSplit: 80, hasOnDemand: false, riskType: "balance" },
      if_micro: { name: "IF Micro", bestDayPct: 15, minProfitPct: 3, dailyDD: 4, staticDD: 6, riskPerTrade: 1, profitSplit: 80, hasOnDemand: true, riskType: "balance" },
      if1: { name: "IF1", bestDayPct: 15, minProfitPct: 3, dailyDD: 2, staticDD: 4, riskPerTrade: 1, profitSplit: 90, hasOnDemand: false, riskType: "balance", bestTradeRule: true },
      one_phase: { name: "One-Phase", bestDayPct: 40, minProfitPct: 1.5, dailyDD: 3, staticDD: 8, riskPerTrade: 50, profitSplit: 80, hasOnDemand: true, riskType: "dailydd" },
      one_phase_micro: { name: "One-Phase Micro", bestDayPct: 15, minProfitPct: 1.5, dailyDD: 4, staticDD: 7, riskPerTrade: 50, profitSplit: 80, hasOnDemand: true, riskType: "dailydd" },
      two_phase: { name: "Two-Phase", bestDayPct: 40, minProfitPct: 1.5, dailyDD: 5, staticDD: 10, riskPerTrade: 50, profitSplit: 80, hasOnDemand: true, riskType: "dailydd" },
      two_phase_max: { name: "Two-Phase Max", bestDayPct: 40, minProfitPct: null, dailyDD: 4, staticDD: 10, riskPerTrade: 50, profitSplit: null, hasOnDemand: false, riskType: "dailydd" },
    }
  },
  ftmo: {
    name: "FTMO",
    accounts: {
      ftmo_normal: { name: "FTMO Normal", bestDayPct: null, minProfitPct: null, dailyDD: 5, staticDD: 10, riskPerTrade: null, profitSplit: 80, hasOnDemand: false, riskType: null },
      ftmo_aggressive: { name: "FTMO Aggressive", bestDayPct: null, minProfitPct: null, dailyDD: 10, staticDD: 20, riskPerTrade: null, profitSplit: 80, hasOnDemand: false, riskType: null },
    }
  },
  the_funded_trader: {
    name: "The Funded Trader",
    accounts: {
      tft_standard: { name: "Standard", bestDayPct: null, minProfitPct: null, dailyDD: 5, staticDD: 10, riskPerTrade: null, profitSplit: 80, hasOnDemand: false, riskType: null },
      tft_rapid: { name: "Rapid", bestDayPct: null, minProfitPct: null, dailyDD: 5, staticDD: 8, riskPerTrade: null, profitSplit: 80, hasOnDemand: false, riskType: null },
    }
  },
  topstep: {
    name: "TopStep",
    accounts: {
      ts_50k: { name: "50K Combine", bestDayPct: 50, minProfitPct: null, dailyDD: null, staticDD: null, trailingDD: 2000, riskPerTrade: null, profitSplit: 90, hasOnDemand: false, riskType: null, profitTarget: 3000 },
      ts_100k: { name: "100K Combine", bestDayPct: 50, minProfitPct: null, dailyDD: null, staticDD: null, trailingDD: 3000, riskPerTrade: null, profitSplit: 90, hasOnDemand: false, riskType: null, profitTarget: 6000 },
      ts_150k: { name: "150K Combine", bestDayPct: 50, minProfitPct: null, dailyDD: null, staticDD: null, trailingDD: 4500, riskPerTrade: null, profitSplit: 90, hasOnDemand: false, riskType: null, profitTarget: 9000 },
    }
  },
  custom: {
    name: "Custom / Other",
    accounts: {
      custom_account: { name: "Custom", bestDayPct: null, minProfitPct: null, dailyDD: 5, staticDD: 10, riskPerTrade: null, profitSplit: 80, hasOnDemand: false, riskType: null },
    }
  }
};

/* ─────────────── BROKER PARSERS ─────────────── */
function parseDateTime(val) {
  if (!val) return null;
  if (val instanceof Date && !isNaN(val)) return val;
  if (typeof val === "number") {
    const d = new Date((val - 25569) * 86400000);
    return isNaN(d.getTime()) ? null : d;
  }
  const s = String(val).trim();
  // DD/MM/YYYY HH:MM:SS.ms
  const m1 = s.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (m1) return new Date(+m1[3], +m1[2] - 1, +m1[1], +m1[4], +m1[5], +m1[6]);
  // YYYY-MM-DD HH:MM:SS
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (m2) return new Date(+m2[1], +m2[2] - 1, +m2[3], +m2[4], +m2[5], +m2[6]);
  // MM/DD/YYYY HH:MM:SS
  const m3 = s.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (m3) return new Date(+m3[3], +m3[1] - 1, +m3[2], +m3[4], +m3[5], +m3[6]);
  // YYYY.MM.DD HH:MM:SS (MT4/MT5 format)
  const m4 = s.match(/^(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2}):?(\d{2})?/);
  if (m4) return new Date(+m4[1], +m4[2] - 1, +m4[3], +m4[4], +m4[5], +(m4[6] || 0));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function findCol(headers, patterns) {
  const lh = headers.map(h => String(h).toLowerCase().trim());
  for (const p of patterns) {
    const idx = lh.findIndex(h => {
      if (typeof p === "string") return h === p || h.includes(p);
      return p.test(h);
    });
    if (idx >= 0) return headers[idx];
  }
  return null;
}

function detectBrokerAndParse(data, headers) {
  const h = headers.map(x => String(x).toLowerCase().trim());

  // — cTrader (FR) —
  if (h.some(x => x.includes("sens d'ouverture") || x.includes("heure de clôture"))) {
    return { broker: "cTrader", trades: data.map(r => parseTrade(r, {
      closeTime: findCol(headers, ["Heure de clôture", "heure de clôture"]),
      netPnl: findCol(headers, ["$ nets", "$ Nets"]),
      balance: findCol(headers, ["Solde $", "solde $"]),
      symbol: findCol(headers, ["Symbole", "symbole"]),
      direction: findCol(headers, ["Sens d'ouverture"]),
      entry: findCol(headers, ["Cours d'entrée"]),
      close: findCol(headers, ["Price de clôture"]),
      qty: findCol(headers, ["Quantité de clôture"]),
      volume: findCol(headers, ["Volume de clôture"]),
      buyWords: ["acheter"],
    })).filter(Boolean) };
  }

  // — cTrader (EN) —
  if (h.some(x => x.includes("closing direction") || x.includes("close time"))) {
    return { broker: "cTrader", trades: data.map(r => parseTrade(r, {
      closeTime: findCol(headers, ["Close Time", "Closing Time"]),
      netPnl: findCol(headers, ["Net P&L", "Net $", "Profit"]),
      balance: findCol(headers, ["Balance", "Balance $"]),
      symbol: findCol(headers, ["Symbol"]),
      direction: findCol(headers, ["Direction", "Side", "Closing Direction"]),
      entry: findCol(headers, ["Entry Price", "Open Price"]),
      close: findCol(headers, ["Close Price", "Closing Price"]),
      qty: findCol(headers, ["Quantity", "Close Quantity", "Closing Quantity"]),
      volume: findCol(headers, ["Volume", "Close Volume"]),
      buyWords: ["buy"],
    })).filter(Boolean) };
  }

  // — MetaTrader 4/5 —
  if (h.some(x => x === "type" || x === "order") && h.some(x => x === "profit" || x === "time")) {
    return { broker: "MetaTrader", trades: data.filter(r => {
      const t = String(r[findCol(headers, ["Type", "type"])] || "").toLowerCase();
      return t === "buy" || t === "sell";
    }).map(r => parseTrade(r, {
      closeTime: findCol(headers, ["Close Time", "Time", "Close Date"]),
      netPnl: findCol(headers, ["Profit", "profit"]),
      balance: findCol(headers, ["Balance", "balance"]),
      symbol: findCol(headers, ["Symbol", "symbol"]),
      direction: findCol(headers, ["Type", "type"]),
      entry: findCol(headers, ["Open Price", "Price"]),
      close: findCol(headers, ["Close Price", "S/L"]),
      qty: findCol(headers, ["Volume", "Lots", "Size"]),
      volume: null,
      buyWords: ["buy"],
      swapCol: findCol(headers, ["Swap", "swap"]),
      commCol: findCol(headers, ["Commission", "commission"]),
    })).filter(Boolean) };
  }

  // — Match-Trader —
  if (h.some(x => x.includes("deal") || x.includes("match"))) {
    return { broker: "Match-Trader", trades: data.map(r => parseTrade(r, {
      closeTime: findCol(headers, ["Close Time", "Closing Time", "Time"]),
      netPnl: findCol(headers, ["Profit", "P/L", "Net P/L", "Net Profit"]),
      balance: findCol(headers, ["Balance"]),
      symbol: findCol(headers, ["Symbol", "Instrument"]),
      direction: findCol(headers, ["Direction", "Side", "Type"]),
      entry: findCol(headers, ["Open Price", "Entry Price"]),
      close: findCol(headers, ["Close Price"]),
      qty: findCol(headers, ["Volume", "Lots", "Size"]),
      volume: null,
      buyWords: ["buy", "long"],
    })).filter(Boolean) };
  }

  // — TradeLocker —
  if (h.some(x => x.includes("tradelocker") || x.includes("instrument"))) {
    return { broker: "TradeLocker", trades: data.map(r => parseTrade(r, {
      closeTime: findCol(headers, ["Close Time", "Closed At", "Exit Time"]),
      netPnl: findCol(headers, ["P&L", "Profit", "PnL", "Net P&L"]),
      balance: findCol(headers, ["Balance"]),
      symbol: findCol(headers, ["Instrument", "Symbol"]),
      direction: findCol(headers, ["Side", "Direction", "Type"]),
      entry: findCol(headers, ["Entry", "Open Price", "Entry Price"]),
      close: findCol(headers, ["Exit", "Close Price", "Exit Price"]),
      qty: findCol(headers, ["Size", "Volume", "Qty"]),
      volume: null,
      buyWords: ["buy", "long"],
    })).filter(Boolean) };
  }

  // — Generic auto-detect —
  const timeCol = findCol(headers, [/close.*time/i, /closing.*time/i, /exit.*time/i, /time/i, /date/i]);
  const pnlCol = findCol(headers, [/net.*p/i, /profit/i, /p.?l/i, /\$.*net/i, /net.*\$/i]);
  const symCol = findCol(headers, [/symbol/i, /instrument/i, /asset/i, /pair/i]);
  const dirCol = findCol(headers, [/direction/i, /side/i, /type/i, /sens/i]);
  const balCol = findCol(headers, [/balance/i, /solde/i, /equity/i]);
  const entryCol = findCol(headers, [/entry/i, /open.*price/i, /prix/i]);
  const closeCol = findCol(headers, [/close.*price/i, /exit.*price/i, /closing.*price/i]);
  const qtyCol = findCol(headers, [/volume/i, /qty/i, /quantity/i, /lots/i, /size/i]);

  if (timeCol && pnlCol) {
    return { broker: "Auto-detected", trades: data.map(r => parseTrade(r, {
      closeTime: timeCol, netPnl: pnlCol, balance: balCol, symbol: symCol || headers[0],
      direction: dirCol, entry: entryCol, close: closeCol, qty: qtyCol, volume: null,
      buyWords: ["buy", "long", "acheter"],
    })).filter(Boolean) };
  }

  return null;
}

function parseTrade(row, cols) {
  const dt = parseDateTime(row[cols.closeTime]);
  if (!dt) return null;
  let pnl = parseFloat(String(row[cols.netPnl] || 0).replace(/[^0-9.\-]/g, "")) || 0;
  if (cols.swapCol && row[cols.swapCol]) pnl += parseFloat(row[cols.swapCol]) || 0;
  if (cols.commCol && row[cols.commCol]) pnl += parseFloat(row[cols.commCol]) || 0;
  const dir = String(row[cols.direction] || "").toLowerCase();
  return {
    symbol: String(row[cols.symbol] || "Unknown"),
    direction: dir,
    closeTime: dt,
    entryPrice: parseFloat(row[cols.entry]) || 0,
    closePrice: parseFloat(row[cols.close]) || 0,
    qty: parseFloat(String(row[cols.qty] || 0).replace(/[^0-9.]/g, "")) || 0,
    volume: cols.volume ? parseFloat(row[cols.volume]) || 0 : 0,
    netPnl: pnl,
    balance: parseFloat(String(row[cols.balance] || 0).replace(/[^0-9.]/g, "")) || 0,
    tradingDay: getTradingDay(dt),
    isBuy: (cols.buyWords || ["buy"]).some(w => dir.includes(w)),
  };
}

function getTradingDay(dt) {
  if (dt.getHours() >= 22) {
    const n = new Date(dt); n.setDate(n.getDate() + 1);
    return n.toISOString().slice(0, 10);
  }
  return dt.toISOString().slice(0, 10);
}

/* ─────────────── UTILITIES ─────────────── */
const fmt$ = (v) => (v >= 0 ? "$" : "-$") + Math.abs(v).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const fmtPct = (v) => v.toFixed(1) + "%";

const C = {
  bg: "#0a0e17", card: "#111827", border: "#1e293b",
  green: "#10b981", greenDim: "#065f46", greenBg: "rgba(16,185,129,0.08)",
  red: "#ef4444", redDim: "#991b1b", redBg: "rgba(239,68,68,0.08)",
  blue: "#3b82f6", blueBg: "rgba(59,130,246,0.08)",
  amber: "#f59e0b", amberDim: "#92400e", amberBg: "rgba(245,158,11,0.08)",
  purple: "#8b5cf6",
  text: "#e2e8f0", textDim: "#94a3b8", textMuted: "#475569",
};

/* ─────────────── UI COMPONENTS ─────────────── */
const s = {
  card: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 },
  label: { fontSize: 11, color: C.textDim, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, marginBottom: 4, display: "block" },
  mono: { fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace" },
  select: { background: C.card, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, width: "100%", outline: "none", appearance: "none", WebkitAppearance: "none" },
  input: { background: C.card, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, width: "100%", outline: "none", boxSizing: "border-box" },
  btn: { border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.2s" },
};

function Badge({ ok, label }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: ok ? C.greenBg : C.redBg, color: ok ? C.green : C.red, border: `1px solid ${ok ? C.greenDim : C.redDim}` }}>
    <span style={{ width: 5, height: 5, borderRadius: "50%", background: ok ? C.green : C.red }} /> {label}
  </span>;
}

function Metric({ label, value, sub, color = C.text, icon, alert }) {
  return <div style={{ ...s.card, position: "relative", overflow: "hidden", ...(alert && { borderColor: C.red }) }}>
    {alert && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: C.red }} />}
    <div style={{ ...s.label, marginBottom: 6 }}>{icon} {label}</div>
    <div style={{ fontSize: 22, fontWeight: 700, color, ...s.mono, letterSpacing: -0.5 }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: C.textDim, marginTop: 3 }}>{sub}</div>}
  </div>;
}

function Progress({ value, max, color, label }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return <div style={{ marginBottom: 10 }}>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3, fontSize: 11 }}>
      <span style={{ color: C.textDim }}>{label}</span>
      <span style={{ color, ...s.mono, fontWeight: 600 }}>{fmt$(value)} / {fmt$(max)}</span>
    </div>
    <div style={{ height: 5, background: C.border, borderRadius: 3, overflow: "hidden" }}>
      <div style={{ height: "100%", width: pct + "%", background: color, borderRadius: 3, transition: "width 0.5s ease" }} />
    </div>
  </div>;
}

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 11 }}>
    <div style={{ color: C.textDim, marginBottom: 4, fontWeight: 700 }}>{label}</div>
    {payload.map((p, i) => <div key={i} style={{ color: p.color || C.text }}>{p.name}: <strong>{typeof p.value === "number" ? (Math.abs(p.value) > 100 ? fmt$(p.value) : fmtPct(p.value)) : p.value}</strong></div>)}
  </div>;
}

/* ─────────────── MAIN APP ─────────────── */
export default function App() {
  const [trades, setTrades] = useState([]);
  const [broker, setBroker] = useState("");
  const [firmId, setFirmId] = useState("instant_funding");
  const [accountId, setAccountId] = useState("if_micro");
  const [startBalance, setStartBalance] = useState(50000);
  const [tab, setTab] = useState("overview");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();

  const firm = FIRMS[firmId];
  const account = firm?.accounts[accountId] || {};

  const processFile = useCallback((file) => {
    const ext = file.name.split(".").pop().toLowerCase();
    if (ext === "csv" || ext === "tsv") {
      Papa.parse(file, {
        header: true, skipEmptyLines: true, dynamicTyping: true,
        complete: (result) => {
          if (!result.data?.length) return;
          const headers = Object.keys(result.data[0]);
          const parsed = detectBrokerAndParse(result.data, headers);
          if (parsed) { setBroker(parsed.broker); finalize(parsed.trades); }
          else alert("Could not detect broker format in CSV.");
        }
      });
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const data = XLSX.utils.sheet_to_json(sheet);
          if (!data.length) return;
          const headers = Object.keys(data[0]);
          const parsed = detectBrokerAndParse(data, headers);
          if (parsed) { setBroker(parsed.broker); finalize(parsed.trades); }
          else alert("Could not detect broker format. Try exporting as CSV from your platform.");
        } catch (err) { alert("Error: " + err.message); }
      };
      reader.readAsArrayBuffer(file);
    }
  }, []);

  function finalize(parsed) {
    const sorted = parsed.sort((a, b) => a.closeTime - b.closeTime);
    setTrades(sorted);
    if (sorted.length) {
      const bal = sorted[0].balance - sorted[0].netPnl;
      const rounded = Math.round(bal / 1000) * 1000;
      if (rounded > 0) setStartBalance(rounded);
    }
  }

  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer?.files?.[0]; if (f) processFile(f);
  }, [processFile]);

  /* ─── ANALYSIS ENGINE ─── */
  const a = useMemo(() => {
    if (!trades.length) return null;
    const totalPnl = trades.reduce((s, t) => s + t.netPnl, 0);

    // Daily breakdown (17:00 EST rollover)
    const dayMap = {};
    trades.forEach(t => {
      if (!dayMap[t.tradingDay]) dayMap[t.tradingDay] = { trades: [], wins: 0, losses: 0, grossWin: 0, grossLoss: 0, net: 0 };
      const d = dayMap[t.tradingDay];
      d.trades.push(t); d.net += t.netPnl;
      if (t.netPnl > 0) { d.wins++; d.grossWin += t.netPnl; }
      else if (t.netPnl < 0) { d.losses++; d.grossLoss += t.netPnl; }
    });
    const days = Object.entries(dayMap).sort(([a], [b]) => a.localeCompare(b)).map(([date, d]) => ({
      date, ...d, count: d.trades.length, winRate: d.count ? (d.wins / d.count) * 100 : 0
    }));

    const positiveDays = days.filter(d => d.net > 0);
    const bestDay = positiveDays.length ? positiveDays.reduce((a, b) => a.net > b.net ? a : b) : null;
    const bestDayNet = bestDay ? bestDay.net : 0;
    const worstDay = days.length ? days.reduce((a, b) => a.net < b.net ? a : b) : null;

    const consistencyPct = totalPnl > 0 && bestDayNet > 0 ? (bestDayNet / totalPnl) * 100 : null;
    const minProfit = account.minProfitPct ? startBalance * (account.minProfitPct / 100) : 0;
    const profitNeeded = account.bestDayPct && bestDayNet > 0 ? bestDayNet / (account.bestDayPct / 100) : 0;
    const profitTarget = Math.max(minProfit, profitNeeded);
    const shortfall = Math.max(0, profitTarget - totalPnl);

    // Equity curve
    let bal = startBalance;
    const equity = [{ i: 0, balance: startBalance }];
    trades.forEach((t, i) => { bal += t.netPnl; equity.push({ i: i + 1, balance: bal }); });

    // Risk check
    let maxRisk = null;
    if (account.riskType === "balance") maxRisk = startBalance * (account.riskPerTrade / 100);
    else if (account.riskType === "dailydd" && account.dailyDD) maxRisk = startBalance * (account.dailyDD / 100) * (account.riskPerTrade / 100);

    const riskViolations = [];

    // ── TRADE IDEA GROUPING (10-minute aggregation rule) ──
    const tradeIdeas = [];
    const visited = new Set();
    for (let i = 0; i < trades.length; i++) {
      if (visited.has(i)) continue;
      const idea = [i];
      visited.add(i);
      let changed = true;
      while (changed) {
        changed = false;
        for (let j = 0; j < trades.length; j++) {
          if (visited.has(j)) continue;
          if (trades[j].symbol !== trades[i].symbol || trades[j].isBuy !== trades[idea[0]].isBuy) continue;
          for (const k of idea) {
            if (Math.abs(trades[j].closeTime - trades[k].closeTime) <= 600000) {
              idea.push(j);
              visited.add(j);
              changed = true;
              break;
            }
          }
        }
      }
      const subset = idea.map(idx => trades[idx]).sort((a, b) => a.closeTime - b.closeTime);
      const dir = subset[0].isBuy ? "BUY" : "SELL";
      const totalLots = subset.reduce((s, t) => s + t.qty, 0);
      const totalPnlIdea = subset.reduce((s, t) => s + t.netPnl, 0);
      const combinedLoss = totalPnlIdea < 0 ? Math.abs(totalPnlIdea) : 0;
      const maxSlPerPt = totalLots * 100;
      const maxSlDist = maxSlPerPt > 0 ? (maxRisk || 500) / maxSlPerPt : 999;
      const entries = subset.map(t => t.entryPrice);
      const closes = subset.map(t => t.closePrice);
      const qtys = subset.map(t => t.qty);
      const worstClose = dir === "BUY" ? Math.min(...closes) : Math.max(...closes);
      const maxAdverse = Math.max(...entries.map(e => Math.abs(e - worstClose)));
      const simRisk = entries.reduce((s, e, idx) => s + Math.abs(e - worstClose) * 100 * qtys[idx], 0);
      const dur = (subset[subset.length - 1].closeTime - subset[0].closeTime) / 1000;

      let status = "safe";
      if (maxRisk && simRisk > maxRisk) status = "breach";
      else if (maxRisk && maxSlDist <= 16.7) status = "breach-zone";
      else if (maxRisk && maxSlDist <= 20) status = "critical";
      else if (maxRisk && maxSlDist <= 25) status = "danger";
      else if (maxRisk && maxSlDist <= 33.3) status = "tight";

      tradeIdeas.push({
        trades: subset, dir, n: subset.length, lots: totalLots,
        pnl: totalPnlIdea, loss: combinedLoss, maxSl: maxSlDist,
        simRisk, maxAdverse, status, duration: dur,
        date: subset[0].closeTime,
      });

      if (maxRisk && (status === "breach" || combinedLoss > maxRisk)) {
        riskViolations.push({ key: `${subset[0].tradingDay}|${subset[0].symbol}|${dir}`, loss: combinedLoss, limit: maxRisk, count: subset.length, simRisk, maxSl: maxSlDist, status });
      }
    }

    // ── HFT DETECTION ──
    const hftClusters = [];
    let currentCluster = [0];
    for (let i = 1; i < trades.length; i++) {
      const diff = (trades[i].closeTime - trades[i - 1].closeTime) / 1000;
      if (diff <= 60) currentCluster.push(i);
      else { if (currentCluster.length >= 2) hftClusters.push(currentCluster); currentCluster = [i]; }
    }
    if (currentCluster.length >= 2) hftClusters.push(currentCluster);
    const hftTradeCount = hftClusters.reduce((s, c) => s + c.length, 0);
    const sameSecCount = trades.reduce((s, t, i) => i > 0 && (trades[i].closeTime - trades[i-1].closeTime) <= 1000 ? s + 1 : s, 0);

    // Symbols
    const symbols = {};
    trades.forEach(t => {
      if (!symbols[t.symbol]) symbols[t.symbol] = { wins: 0, losses: 0, net: 0, count: 0 };
      symbols[t.symbol].count++; symbols[t.symbol].net += t.netPnl;
      if (t.netPnl > 0) symbols[t.symbol].wins++; else symbols[t.symbol].losses++;
    });

    // Win/loss stats
    const winners = trades.filter(t => t.netPnl > 0);
    const losers = trades.filter(t => t.netPnl < 0);
    const avgWin = winners.length ? winners.reduce((s, t) => s + t.netPnl, 0) / winners.length : 0;
    const avgLoss = losers.length ? Math.abs(losers.reduce((s, t) => s + t.netPnl, 0) / losers.length) : 0;
    const rr = avgLoss > 0 ? avgWin / avgLoss : 0;

    const ddPct = account.staticDD || account.smartDD || 10;
    const ddFloor = startBalance * (1 - ddPct / 100);
    const currentBal = trades.length ? trades[trades.length - 1].balance : startBalance;
    const avgDailyNet = days.length ? totalPnl / days.length : 0;
    const daysToTarget = avgDailyNet > 0 && shortfall > 0 ? Math.ceil(shortfall / avgDailyNet) : null;

    return {
      totalPnl, days, bestDay, bestDayNet, worstDay, consistencyPct,
      minProfit, profitNeeded, profitTarget, shortfall, equity, maxRisk,
      riskViolations, symbols, winners, losers, avgWin, avgLoss, rr,
      ddFloor, ddPct, currentBal, avgDailyNet, daysToTarget,
      tradeIdeas, hftClusters, hftTradeCount, sameSecCount,
    };
  }, [trades, account, startBalance]);

  /* ─── UPLOAD SCREEN ─── */
  if (!trades.length) {
    return (
      <div style={{ minHeight: "100vh", minHeight: "100dvh", background: C.bg, color: C.text, fontFamily: "'DM Sans', -apple-system, sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ width: "100%", maxWidth: 440, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>📊</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 2, background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Prop Trade Analyzer</h1>
          <p style={{ color: C.textDim, fontSize: 13, marginBottom: 28 }}>Payout & consistency tracker for prop firm traders</p>

          {/* Drop zone */}
          <div onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            style={{ border: `2px dashed ${dragOver ? C.blue : C.border}`, borderRadius: 16, padding: "40px 24px", cursor: "pointer", background: dragOver ? C.blueBg : "transparent", transition: "all 0.2s", marginBottom: 20 }}>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.tsv" style={{ display: "none" }} onChange={e => e.target.files[0] && processFile(e.target.files[0])} />
            <div style={{ fontSize: 28, marginBottom: 8 }}>{dragOver ? "📂" : "📁"}</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Drop or tap to upload</div>
            <div style={{ fontSize: 12, color: C.textDim }}>cTrader · MetaTrader · Match-Trader · TradeLocker · CSV</div>
          </div>

          {/* Settings */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, textAlign: "left" }}>
            <div>
              <label style={s.label}>Prop Firm</label>
              <select value={firmId} onChange={e => { setFirmId(e.target.value); setAccountId(Object.keys(FIRMS[e.target.value].accounts)[0]); }} style={s.select}>
                {Object.entries(FIRMS).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
              </select>
            </div>
            <div>
              <label style={s.label}>Account Type</label>
              <select value={accountId} onChange={e => setAccountId(e.target.value)} style={s.select}>
                {Object.entries(firm.accounts).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={s.label}>Starting Balance ($)</label>
              <input type="number" value={startBalance} onChange={e => setStartBalance(+e.target.value)} style={s.input} />
            </div>
          </div>

          <div style={{ marginTop: 20, padding: 12, background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 11, color: C.textDim, lineHeight: 1.5 }}>
            💡 <strong style={{ color: C.text }}>How to export:</strong> In cTrader → History → filter dates → Export. In MT4/MT5 → Account History → right-click → Save as Report. In Match-Trader → History → Export CSV.
          </div>
        </div>
      </div>
    );
  }

  /* ─── DASHBOARD ─── */
  const tabs = [
    { id: "overview", icon: "📊", label: "Overview" },
    { id: "daily", icon: "📅", label: "Daily" },
    { id: "trades", icon: "📋", label: "Trades" },
    { id: "risk", icon: "🛡️", label: "Audit" },
    { id: "payout", icon: "💰", label: "Payout" },
  ];

  return (
    <div style={{ minHeight: "100vh", minHeight: "100dvh", background: C.bg, color: C.text, fontFamily: "'DM Sans', -apple-system, sans-serif", paddingBottom: 70 }}>

      {/* Top bar */}
      <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <span style={{ fontSize: 16, fontWeight: 800, background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>PropAnalyzer</span>
          <span style={{ fontSize: 10, color: C.textDim, marginLeft: 8, background: C.card, padding: "2px 6px", borderRadius: 4 }}>{broker}</span>
        </div>
        <button onClick={() => { setTrades([]); setTab("overview"); setBroker(""); }} style={{ ...s.btn, background: C.card, color: C.textDim, border: `1px solid ${C.border}`, padding: "6px 10px", fontSize: 11 }}>New File</button>
      </div>

      {/* Account strip */}
      <div style={{ padding: "8px 16px", display: "flex", gap: 8, overflowX: "auto", borderBottom: `1px solid ${C.border}`, fontSize: 11 }}>
        <select value={firmId} onChange={e => { setFirmId(e.target.value); setAccountId(Object.keys(FIRMS[e.target.value].accounts)[0]); }} style={{ ...s.select, padding: "4px 8px", fontSize: 11, width: "auto" }}>
          {Object.entries(FIRMS).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
        </select>
        <select value={accountId} onChange={e => setAccountId(e.target.value)} style={{ ...s.select, padding: "4px 8px", fontSize: 11, width: "auto" }}>
          {Object.entries(firm.accounts).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
        </select>
        <input type="number" value={startBalance} onChange={e => setStartBalance(+e.target.value)} style={{ ...s.input, padding: "4px 8px", fontSize: 11, width: 80 }} />
      </div>

      {/* Content */}
      <div style={{ padding: 14 }}>

        {/* ═══ OVERVIEW ═══ */}
        {tab === "overview" && a && <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 14 }}>
            <Metric label="Net Profit" value={fmt$(a.totalPnl)} color={a.totalPnl >= 0 ? C.green : C.red} icon="💰" sub={fmtPct(a.totalPnl / startBalance * 100)} />
            <Metric label="Best Day" value={fmt$(a.bestDayNet)} color={C.amber} icon="⭐" sub={a.bestDay?.date || "—"} />
            <Metric label="Consistency" value={a.consistencyPct != null ? fmtPct(a.consistencyPct) : "N/A"} color={a.consistencyPct && a.consistencyPct <= (account.bestDayPct || 999) ? C.green : C.red} icon="📐" sub={account.bestDayPct ? `Limit: ${account.bestDayPct}%` : "No rule"} alert={a.consistencyPct > (account.bestDayPct || 999)} />
            <Metric label="Win Rate" value={fmtPct(a.winners.length / trades.length * 100)} color={C.purple} icon="🎯" sub={`${a.winners.length}W / ${a.losers.length}L`} />
            <Metric label="R:R" value={a.rr.toFixed(2)} color={a.rr >= 1 ? C.green : C.amber} icon="⚖️" sub={`W ${fmt$(a.avgWin)} / L ${fmt$(a.avgLoss)}`} />
            <Metric label="Balance" value={fmt$(a.currentBal)} color={C.blue} icon="🏦" sub={`Floor: ${fmt$(a.ddFloor)}`} />
          </div>

          {/* Payout progress */}
          {account.hasOnDemand && account.bestDayPct && <div style={{ ...s.card, marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>🎯 Payout Eligibility</div>
            <Progress value={a.totalPnl} max={a.minProfit} color={a.totalPnl >= a.minProfit ? C.green : C.blue} label={`Min Profit (${account.minProfitPct}%)`} />
            <Progress value={a.totalPnl} max={a.profitNeeded} color={a.consistencyPct <= account.bestDayPct ? C.green : C.amber} label={`Consistency (${fmt$(a.profitNeeded)})`} />
            <div style={{ padding: "8px 12px", borderRadius: 8, background: a.shortfall > 0 ? C.amberBg : C.greenBg, fontSize: 12, fontWeight: 600, display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <span>{a.shortfall > 0 ? `${fmt$(a.shortfall)} more needed` : "✅ Payout eligible!"}</span>
              {a.daysToTarget && a.shortfall > 0 && <span style={{ color: C.textDim }}>~{a.daysToTarget}d</span>}
            </div>
          </div>}

          {/* Equity curve */}
          <div style={{ ...s.card, marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>📈 Equity Curve</div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={a.equity}>
                <defs><linearGradient id="eg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.blue} stopOpacity={0.3} /><stop offset="100%" stopColor={C.blue} stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis dataKey="i" tick={false} stroke={C.border} />
                <YAxis domain={["auto", "auto"]} tickFormatter={v => "$" + (v / 1000).toFixed(1) + "k"} tick={{ fill: C.textDim, fontSize: 10 }} stroke={C.border} width={52} />
                <Tooltip content={<ChartTip />} />
                <ReferenceLine y={startBalance} stroke={C.textMuted} strokeDasharray="4 4" />
                <ReferenceLine y={a.ddFloor} stroke={C.red} strokeDasharray="4 4" />
                <Area type="monotone" dataKey="balance" stroke={C.blue} fill="url(#eg)" strokeWidth={2} dot={false} name="Balance" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Daily chart */}
          <div style={s.card}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>📊 Daily Net P&L</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={a.days}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis dataKey="date" tick={{ fill: C.textDim, fontSize: 10 }} stroke={C.border} />
                <YAxis tickFormatter={v => "$" + v} tick={{ fill: C.textDim, fontSize: 10 }} stroke={C.border} width={48} />
                <Tooltip content={<ChartTip />} />
                <ReferenceLine y={0} stroke={C.textMuted} />
                <Bar dataKey="net" name="Net P&L" radius={[3, 3, 0, 0]}>
                  {a.days.map((d, i) => <Cell key={i} fill={d.net >= 0 ? C.green : C.red} opacity={d === a.bestDay ? 1 : 0.65} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>}

        {/* ═══ DAILY ═══ */}
        {tab === "daily" && a && <div style={{ ...s.card, padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {["Date", "Trades", "W", "L", "Win%", "Gross+", "Gross-", "Net", "% Total"].map(h =>
                  <th key={h} style={{ padding: "10px 10px", textAlign: h === "Date" ? "left" : "right", color: C.textDim, fontSize: 10, fontWeight: 700, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                )}
              </tr></thead>
              <tbody>
                {a.days.map(d => {
                  const pct = a.totalPnl > 0 && d.net > 0 ? (d.net / a.totalPnl) * 100 : 0;
                  const over = account.bestDayPct && pct > account.bestDayPct;
                  const best = d === a.bestDay;
                  return <tr key={d.date} style={{ borderBottom: `1px solid ${C.border}`, background: best ? C.amberBg : "transparent" }}>
                    <td style={{ padding: "8px 10px", fontWeight: 600, whiteSpace: "nowrap", fontSize: 12 }}>{d.date} {best && <span style={{ color: C.amber, fontSize: 9 }}>★</span>}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", ...s.mono }}>{d.count}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", ...s.mono, color: C.green }}>{d.wins}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", ...s.mono, color: C.red }}>{d.losses}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", ...s.mono }}>{fmtPct(d.winRate)}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", ...s.mono, color: C.green }}>{fmt$(d.grossWin)}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", ...s.mono, color: C.red }}>{fmt$(d.grossLoss)}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", ...s.mono, fontWeight: 700, color: d.net >= 0 ? C.green : C.red }}>{fmt$(d.net)}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", ...s.mono, color: over ? C.red : C.textDim }}>{d.net > 0 ? fmtPct(pct) : "—"}</td>
                  </tr>;
                })}
              </tbody>
              <tfoot><tr style={{ borderTop: `2px solid ${C.border}`, fontWeight: 700 }}>
                <td style={{ padding: "10px 10px" }}>TOTAL</td>
                <td style={{ padding: "10px 10px", textAlign: "right", ...s.mono }}>{trades.length}</td>
                <td style={{ padding: "10px 10px", textAlign: "right", ...s.mono, color: C.green }}>{a.winners.length}</td>
                <td style={{ padding: "10px 10px", textAlign: "right", ...s.mono, color: C.red }}>{a.losers.length}</td>
                <td style={{ padding: "10px 10px", textAlign: "right", ...s.mono }}>{fmtPct(a.winners.length / trades.length * 100)}</td>
                <td style={{ padding: "10px 10px", textAlign: "right", ...s.mono, color: C.green }}>{fmt$(a.days.reduce((s, d) => s + d.grossWin, 0))}</td>
                <td style={{ padding: "10px 10px", textAlign: "right", ...s.mono, color: C.red }}>{fmt$(a.days.reduce((s, d) => s + d.grossLoss, 0))}</td>
                <td style={{ padding: "10px 10px", textAlign: "right", ...s.mono, fontWeight: 700, color: a.totalPnl >= 0 ? C.green : C.red }}>{fmt$(a.totalPnl)}</td>
                <td />
              </tr></tfoot>
            </table>
          </div>
        </div>}

        {/* ═══ TRADES ═══ */}
        {tab === "trades" && <div style={{ ...s.card, padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto", maxHeight: "70vh" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead style={{ position: "sticky", top: 0, background: C.card, zIndex: 1 }}>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {["#", "Date", "Symbol", "Side", "Entry", "Close", "Qty", "P&L", "Bal"].map(h =>
                    <th key={h} style={{ padding: "8px 8px", textAlign: ["Symbol", "Side", "Date"].includes(h) ? "left" : "right", color: C.textDim, fontSize: 9, fontWeight: 700, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {trades.map((t, i) => <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: "6px 8px", textAlign: "right", color: C.textMuted, ...s.mono, fontSize: 10 }}>{i + 1}</td>
                  <td style={{ padding: "6px 8px", ...s.mono, fontSize: 10, whiteSpace: "nowrap" }}>{t.tradingDay}</td>
                  <td style={{ padding: "6px 8px", fontWeight: 600, fontSize: 11 }}>{t.symbol.replace(".x", "")}</td>
                  <td style={{ padding: "6px 8px" }}>
                    <span style={{ padding: "1px 6px", borderRadius: 3, fontSize: 9, fontWeight: 700, background: t.isBuy ? C.greenBg : C.redBg, color: t.isBuy ? C.green : C.red }}>{t.isBuy ? "BUY" : "SELL"}</span>
                  </td>
                  <td style={{ padding: "6px 8px", textAlign: "right", ...s.mono, fontSize: 10 }}>{t.entryPrice.toFixed(2)}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right", ...s.mono, fontSize: 10 }}>{t.closePrice.toFixed(2)}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right", ...s.mono, fontSize: 10 }}>{t.qty}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right", ...s.mono, fontWeight: 600, color: t.netPnl >= 0 ? C.green : C.red }}>{fmt$(t.netPnl)}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right", ...s.mono, fontSize: 10 }}>{fmt$(t.balance)}</td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </div>}

        {/* ═══ RISK / BREACH AUDIT ═══ */}
        {tab === "risk" && a && <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 14 }}>
            <Metric label="Max Risk / Idea" value={a.maxRisk ? fmt$(a.maxRisk) : "N/A"} color={C.amber} icon="⚠️" />
            <Metric label="Trade Ideas" value={a.tradeIdeas.length} color={C.blue} icon="📦" sub={`${a.tradeIdeas.filter(i => i.n >= 2).length} multi-trade`} />
            <Metric label="Flagged Ideas" value={a.tradeIdeas.filter(i => i.status !== "safe").length} color={a.tradeIdeas.some(i => i.status !== "safe") ? C.red : C.green} icon={a.tradeIdeas.some(i => i.status === "breach" || i.status === "breach-zone") ? "🚨" : "✅"} alert={a.tradeIdeas.some(i => i.status === "breach")} />
            <Metric label="DD Buffer" value={fmt$(a.currentBal - a.ddFloor)} color={a.currentBal - a.ddFloor > startBalance * 0.02 ? C.green : C.red} icon="🛡️" sub={`Floor: ${fmt$(a.ddFloor)}`} />
          </div>

          {/* Rule checks summary */}
          {[
            { label: `Static Drawdown (${a.ddPct}%)`, pass: a.currentBal > a.ddFloor && Math.min(...a.equity.map(e => e.balance)) >= a.ddFloor, detail: `Lowest: ${fmt$(Math.min(...a.equity.map(e => e.balance)))} / Floor: ${fmt$(a.ddFloor)}` },
            account.dailyDD && { label: `Daily Drawdown (${account.dailyDD}%)`, pass: !a.days.some(d => d.net < -(startBalance * account.dailyDD / 100)), detail: `Worst day: ${fmt$(Math.min(...a.days.map(d => d.net)))} / Limit: ${fmt$(startBalance * account.dailyDD / 100 * -1)}` },
            a.maxRisk && { label: `1% Trade Idea Rule`, pass: !a.tradeIdeas.some(i => i.status === "breach"), detail: `${a.tradeIdeas.filter(i => i.status !== "safe").length} flagged ideas, ${a.tradeIdeas.filter(i => i.status === "breach" || i.status === "breach-zone").length} in breach zone`, warn: a.tradeIdeas.some(i => i.status !== "safe" && i.status !== "breach") },
            { label: "HFT Pattern", pass: a.hftTradeCount / trades.length < 0.3, detail: `${a.hftTradeCount}/${trades.length} trades (${(a.hftTradeCount/trades.length*100).toFixed(0)}%) in rapid clusters, ${a.sameSecCount} same-second`, warn: a.hftTradeCount / trades.length >= 0.3 && a.hftTradeCount / trades.length < 0.5 },
          ].filter(Boolean).map((r, i) => (
            <div key={i} style={{ ...s.card, display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8, ...((!r.pass && !r.warn) && { borderColor: "rgba(239,68,68,0.3)" }), ...(r.warn && { borderColor: "rgba(245,158,11,0.3)" }) }}>
              <span style={{ display: "inline-flex", padding: "3px 8px", borderRadius: 12, fontSize: 10, fontWeight: 700, flexShrink: 0, background: r.pass ? C.greenBg : r.warn ? C.amberBg : C.redBg, color: r.pass ? C.green : r.warn ? C.amber : C.red, border: `1px solid ${r.pass ? C.greenDim : r.warn ? C.amberDim : C.redDim}` }}>
                {r.pass ? "PASS" : r.warn ? "WARN" : "FAIL"}
              </span>
              <div><div style={{ fontWeight: 700, fontSize: 13 }}>{r.label}</div><div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>{r.detail}</div></div>
            </div>
          ))}

          {/* Trade Ideas breakdown */}
          {a.maxRisk && a.tradeIdeas.some(i => i.status !== "safe") && <>
            <div style={{ fontSize: 15, fontWeight: 700, margin: "20px 0 6px" }}>⚠️ Flagged Trade Ideas ({a.tradeIdeas.filter(i => i.status !== "safe").length})</div>
            <div style={{ fontSize: 11, color: C.textDim, marginBottom: 12, lineHeight: 1.6 }}>
              IF treats all positions on the same instrument + direction, closed within <b style={{ color: C.text }}>10 minutes</b> of each other, as <b style={{ color: C.text }}>one trade idea</b>.
              Combined risk (Entry→SL × total lots × 100) must stay under <b style={{ color: C.amber }}>{fmt$(a.maxRisk)}</b>.
            </div>

            {a.tradeIdeas.filter(i => i.status !== "safe").sort((a, b) => a.maxSl - b.maxSl).map((idea, idx) => {
              const statusColors = { "breach": C.red, "breach-zone": C.red, "critical": C.red, "danger": C.amber, "tight": C.blue };
              const statusLabels = { "breach": "LIKELY BREACH", "breach-zone": "BREACH ZONE", "critical": "SL CRITICAL", "danger": "DANGER", "tight": "TIGHT" };
              const sc = statusColors[idea.status] || C.textDim;
              const riskPct = a.maxRisk ? Math.min((idea.simRisk / a.maxRisk) * 100, 150) : 0;
              const lotsPct = a.maxRisk ? (idea.lots * 100 * idea.maxSl) / a.maxRisk * 100 : 0;

              const reasonText = idea.status === "breach"
                ? `Combined realized risk of ${fmt$(idea.simRisk)} exceeds the ${fmt$(a.maxRisk)} limit.`
                : idea.n > 1
                  ? `${idea.n} trades in the same direction within ${idea.duration < 60 ? idea.duration.toFixed(0) + "s" : (idea.duration/60).toFixed(1) + "min"}. Combined ${idea.lots.toFixed(2)} lots = only ${idea.maxSl.toFixed(1)}pts of SL room before hitting ${fmt$(a.maxRisk)}.`
                  : `Single trade at ${idea.lots.toFixed(2)} lots = only ${idea.maxSl.toFixed(1)}pts of SL room. Gold easily moves this much.`;

              return (
                <div key={idx} style={{ ...s.card, marginBottom: 12, padding: 0, overflow: "hidden", borderColor: idea.status.includes("breach") ? "rgba(239,68,68,0.35)" : idea.status === "critical" ? "rgba(239,68,68,0.25)" : idea.status === "danger" ? "rgba(245,158,11,0.3)" : C.border }}>
                  {/* Header */}
                  <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <span style={{ padding: "2px 10px", borderRadius: 8, fontSize: 10, fontWeight: 700, background: sc + "18", color: sc }}>{statusLabels[idea.status]}</span>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>
                        {new Date(idea.date).toLocaleDateString("en-GB", { weekday: "short", month: "short", day: "numeric" })}{" "}
                        {new Date(idea.date).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, ...s.mono, color: idea.pnl >= 0 ? C.green : C.red, marginLeft: "auto" }}>{fmt$(idea.pnl)}</span>
                    </div>

                    {/* Stats row */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 8, marginBottom: 10 }}>
                      <div style={{ background: C.bg, borderRadius: 6, padding: "6px 10px" }}>
                        <div style={{ fontSize: 9, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>Direction</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: idea.dir === "BUY" ? C.green : C.red }}>{idea.dir}</div>
                      </div>
                      <div style={{ background: C.bg, borderRadius: 6, padding: "6px 10px" }}>
                        <div style={{ fontSize: 9, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>Trades</div>
                        <div style={{ fontSize: 13, fontWeight: 700, ...s.mono }}>{idea.n}</div>
                      </div>
                      <div style={{ background: C.bg, borderRadius: 6, padding: "6px 10px" }}>
                        <div style={{ fontSize: 9, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>Total lots</div>
                        <div style={{ fontSize: 13, fontWeight: 700, ...s.mono }}>{idea.lots.toFixed(2)}</div>
                      </div>
                      <div style={{ background: C.bg, borderRadius: 6, padding: "6px 10px" }}>
                        <div style={{ fontSize: 9, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>Max SL room</div>
                        <div style={{ fontSize: 13, fontWeight: 700, ...s.mono, color: idea.maxSl <= 20 ? C.red : idea.maxSl <= 33 ? C.amber : C.text }}>{idea.maxSl.toFixed(1)} pts</div>
                      </div>
                      <div style={{ background: C.bg, borderRadius: 6, padding: "6px 10px" }}>
                        <div style={{ fontSize: 9, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>Duration</div>
                        <div style={{ fontSize: 13, fontWeight: 700, ...s.mono }}>{idea.duration < 60 ? idea.duration.toFixed(0) + "s" : (idea.duration / 60).toFixed(1) + "m"}</div>
                      </div>
                      <div style={{ background: C.bg, borderRadius: 6, padding: "6px 10px" }}>
                        <div style={{ fontSize: 9, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>Sim. risk</div>
                        <div style={{ fontSize: 13, fontWeight: 700, ...s.mono, color: idea.simRisk > (a.maxRisk || 500) ? C.red : C.amber }}>{fmt$(idea.simRisk)}</div>
                      </div>
                    </div>

                    {/* Risk bar */}
                    <div style={{ marginBottom: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 3 }}>
                        <span style={{ color: C.textDim }}>Risk vs {fmt$(a.maxRisk)} limit</span>
                        <span style={{ color: riskPct > 100 ? C.red : riskPct > 70 ? C.amber : C.green, fontWeight: 700, ...s.mono }}>{Math.min(riskPct, 999).toFixed(0)}%</span>
                      </div>
                      <div style={{ height: 6, background: C.border, borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: Math.min(riskPct, 100) + "%", background: riskPct > 100 ? C.red : riskPct > 70 ? C.amber : C.green, borderRadius: 3, transition: "width 0.5s" }} />
                      </div>
                    </div>

                    {/* Explanation */}
                    <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.5, padding: "8px 10px", background: (idea.status.includes("breach") ? C.redBg : idea.status === "danger" ? C.amberBg : C.blueBg), borderRadius: 6 }}>
                      <b style={{ color: sc }}>Why flagged:</b> {reasonText}
                    </div>
                  </div>

                  {/* Trades table */}
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                      <thead><tr style={{ borderBottom: `1px solid ${C.border}`, background: C.bg }}>
                        {["#", "Closed at", "Dir", "Lots", "Entry", "Close", "Move (pts)", "Risk ($)", "P&L", "Gap"].map(h =>
                          <th key={h} style={{ padding: "6px 10px", textAlign: ["#", "Closed at", "Dir", "Gap"].includes(h) ? "left" : "right", color: C.textDim, fontSize: 9, fontWeight: 600, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                        )}
                      </tr></thead>
                      <tbody>
                        {idea.trades.map((t, ti) => {
                          const movePts = Math.abs(t.entryPrice - t.closePrice);
                          const tradeRisk = movePts * 100 * t.qty;
                          const gap = ti > 0 ? (t.closeTime - idea.trades[ti - 1].closeTime) / 1000 : null;
                          const gapStr = gap !== null ? (gap < 60 ? gap.toFixed(0) + "s" : (gap / 60).toFixed(1) + "m") : "—";
                          const gapColor = gap !== null && gap <= 60 ? C.red : gap !== null && gap <= 300 ? C.amber : C.textMuted;
                          const riskColor = tradeRisk > (a.maxRisk || 500) * 0.5 ? C.red : tradeRisk > (a.maxRisk || 500) * 0.3 ? C.amber : C.textDim;
                          return (
                            <tr key={ti} style={{ borderBottom: `1px solid ${C.border}` }}>
                              <td style={{ padding: "6px 10px", color: C.textMuted, ...s.mono, fontSize: 9 }}>{ti + 1}</td>
                              <td style={{ padding: "6px 10px", ...s.mono, fontSize: 10, whiteSpace: "nowrap" }}>
                                {t.closeTime.toLocaleDateString("en-GB", { month: "short", day: "numeric" })}{" "}
                                <b>{t.closeTime.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</b>
                              </td>
                              <td style={{ padding: "6px 10px" }}>
                                <span style={{ padding: "1px 5px", borderRadius: 3, fontSize: 9, fontWeight: 700, background: t.isBuy ? C.greenBg : C.redBg, color: t.isBuy ? C.green : C.red }}>{t.isBuy ? "BUY" : "SELL"}</span>
                              </td>
                              <td style={{ padding: "6px 10px", textAlign: "right", ...s.mono, fontSize: 10, fontWeight: 600 }}>{t.qty.toFixed(2)}</td>
                              <td style={{ padding: "6px 10px", textAlign: "right", ...s.mono, fontSize: 10 }}>{t.entryPrice.toFixed(2)}</td>
                              <td style={{ padding: "6px 10px", textAlign: "right", ...s.mono, fontSize: 10 }}>{t.closePrice.toFixed(2)}</td>
                              <td style={{ padding: "6px 10px", textAlign: "right", ...s.mono, fontSize: 10 }}>{movePts.toFixed(1)}</td>
                              <td style={{ padding: "6px 10px", textAlign: "right", ...s.mono, fontSize: 10, color: riskColor, fontWeight: 600 }}>{fmt$(tradeRisk)}</td>
                              <td style={{ padding: "6px 10px", textAlign: "right", ...s.mono, fontSize: 10, fontWeight: 600, color: t.netPnl >= 0 ? C.green : C.red }}>{fmt$(t.netPnl)}</td>
                              <td style={{ padding: "6px 10px", ...s.mono, fontSize: 9, color: gapColor, fontWeight: gap !== null && gap <= 60 ? 700 : 400 }}>{gapStr}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot><tr style={{ borderTop: `2px solid ${C.border}`, background: C.bg }}>
                        <td colSpan={3} style={{ padding: "8px 10px", fontWeight: 700, fontSize: 11 }}>TOTAL</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", ...s.mono, fontSize: 11, fontWeight: 700 }}>{idea.lots.toFixed(2)}</td>
                        <td colSpan={2} />
                        <td style={{ padding: "8px 10px", textAlign: "right", ...s.mono, fontSize: 11, fontWeight: 700 }}>{Math.abs(idea.maxAdverse).toFixed(1)}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", ...s.mono, fontSize: 11, fontWeight: 700, color: idea.simRisk > (a.maxRisk || 500) ? C.red : C.amber }}>{fmt$(idea.simRisk)}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", ...s.mono, fontSize: 11, fontWeight: 700, color: idea.pnl >= 0 ? C.green : C.red }}>{fmt$(idea.pnl)}</td>
                        <td />
                      </tr></tfoot>
                    </table>
                  </div>
                </div>
              );
            })}
          </>}

          {/* HFT Clusters */}
          {a.hftClusters.filter(c => c.length >= 3).length > 0 && <>
            <div style={{ fontSize: 15, fontWeight: 700, margin: "20px 0 6px" }}>⚡ Rapid Close Clusters (3+ trades within 60s)</div>
            <div style={{ ...s.card, padding: 0, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {["Time", "Trades", "Duration", "P&L"].map(h =>
                    <th key={h} style={{ padding: "8px 10px", textAlign: h === "Time" ? "left" : "right", color: C.textDim, fontSize: 9, fontWeight: 700, textTransform: "uppercase" }}>{h}</th>
                  )}
                </tr></thead>
                <tbody>
                  {a.hftClusters.filter(c => c.length >= 3).map((cluster, ci) => {
                    const clTrades = cluster.map(i => trades[i]);
                    const pnl = clTrades.reduce((s, t) => s + t.netPnl, 0);
                    const dur = (clTrades[clTrades.length-1].closeTime - clTrades[0].closeTime) / 1000;
                    return <tr key={ci} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: "6px 10px", ...s.mono, fontSize: 10 }}>{clTrades[0].closeTime.toLocaleString("en-GB", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}</td>
                      <td style={{ padding: "6px 10px", textAlign: "right", ...s.mono, fontWeight: 600 }}>{cluster.length}</td>
                      <td style={{ padding: "6px 10px", textAlign: "right", ...s.mono }}>{dur.toFixed(0)}s</td>
                      <td style={{ padding: "6px 10px", textAlign: "right", ...s.mono, fontWeight: 600, color: pnl >= 0 ? C.green : C.red }}>{fmt$(pnl)}</td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
          </>}

          {/* Symbol breakdown */}
          <div style={{ fontSize: 15, fontWeight: 700, margin: "20px 0 6px" }}>📋 By Symbol</div>
          <div style={{ ...s.card, padding: 0, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {["Symbol", "Trades", "Win%", "Net P&L"].map(h =>
                    <th key={h} style={{ padding: "8px 12px", textAlign: h === "Symbol" ? "left" : "right", color: C.textDim, fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>{h}</th>
                  )}
                </tr></thead>
                <tbody>
                  {Object.entries(a.symbols).map(([sym, d]) => <tr key={sym} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: "8px 12px", fontWeight: 600 }}>{sym}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", ...s.mono }}>{d.count}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", ...s.mono }}>{fmtPct(d.wins / d.count * 100)}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", ...s.mono, fontWeight: 700, color: d.net >= 0 ? C.green : C.red }}>{fmt$(d.net)}</td>
                  </tr>)}
                </tbody>
              </table>
            </div>
          </div>
        </>}

        {/* ═══ PAYOUT CALC ═══ */}
        {tab === "payout" && a && <PayoutSim account={account} startBalance={startBalance} totalPnl={a.totalPnl} bestDayNet={a.bestDayNet} avgDailyNet={a.avgDailyNet} />}
      </div>

      {/* Bottom nav */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: C.card, borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-around", padding: "6px 0", paddingBottom: "max(6px, env(safe-area-inset-bottom))", zIndex: 50 }}>
        {tabs.map(t => <button key={t.id} onClick={() => setTab(t.id)} style={{ background: "none", border: "none", color: tab === t.id ? C.blue : C.textMuted, fontSize: 10, fontWeight: 600, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "4px 8px", transition: "color 0.2s" }}>
          <span style={{ fontSize: 18 }}>{t.icon}</span>{t.label}
          {t.id === "risk" && a?.tradeIdeas?.some(i => i.status !== "safe") && <span style={{ position: "absolute", top: 2, right: 2, width: 6, height: 6, borderRadius: 3, background: C.red }} />}
        </button>)}
      </div>
    </div>
  );
}

/* ─────────────── PAYOUT SIMULATOR ─────────────── */
function PayoutSim({ account, startBalance, totalPnl, bestDayNet, avgDailyNet }) {
  const [simDays, setSimDays] = useState(20);
  const [simAvg, setSimAvg] = useState(Math.max(Math.round(avgDailyNet / 25) * 25, 50));

  const sim = useMemo(() => {
    if (!account.bestDayPct || !account.minProfitPct) return null;
    const minP = startBalance * (account.minProfitPct / 100);
    return Array.from({ length: simDays }, (_, i) => {
      const d = i + 1;
      const tot = totalPnl + d * simAvg;
      const con = bestDayNet > 0 && tot > 0 ? (bestDayNet / tot) * 100 : 0;
      const ok1 = con <= account.bestDayPct;
      const ok2 = tot >= minP;
      const ok = ok1 && ok2;
      return { day: d, total: tot, consistency: con, metConsistency: ok1, metMinProfit: ok2, eligible: ok, payout: ok ? tot * (account.profitSplit / 100) : 0 };
    });
  }, [simDays, simAvg, account, startBalance, totalPnl, bestDayNet]);

  const first = sim?.find(d => d.eligible);

  if (!account.bestDayPct) return <div style={{ ...s.card, textAlign: "center", padding: 40 }}>
    <div style={{ fontSize: 32, marginBottom: 12 }}>ℹ️</div>
    <div style={{ fontSize: 14, fontWeight: 600 }}>No consistency rule for this account type</div>
    <div style={{ fontSize: 12, color: C.textDim, marginTop: 4 }}>Payout rules vary — check your firm's dashboard</div>
  </div>;

  return <>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
      <div style={s.card}>
        <label style={s.label}>Days to simulate</label>
        <input type="range" min={5} max={60} value={simDays} onChange={e => setSimDays(+e.target.value)} style={{ width: "100%", marginTop: 6 }} />
        <div style={{ fontSize: 22, fontWeight: 700, ...s.mono, marginTop: 4 }}>{simDays}</div>
      </div>
      <div style={s.card}>
        <label style={s.label}>Daily avg ($)</label>
        <input type="range" min={25} max={500} step={25} value={simAvg} onChange={e => setSimAvg(+e.target.value)} style={{ width: "100%", marginTop: 6 }} />
        <div style={{ fontSize: 22, fontWeight: 700, ...s.mono, marginTop: 4 }}>{fmt$(simAvg)}</div>
      </div>
    </div>

    <div style={{ ...s.card, background: first ? C.greenBg : C.amberBg, borderColor: first ? C.greenDim : C.amberDim, marginBottom: 14, textAlign: "center" }}>
      <div style={s.label}>{first ? "First eligible" : "Not eligible within range"}</div>
      <div style={{ fontSize: 28, fontWeight: 800, ...s.mono, color: first ? C.green : C.amber }}>{first ? `Day ${first.day}` : `>${simDays} days`}</div>
      {first && <div style={{ fontSize: 12, color: C.textDim, marginTop: 4 }}>Payout: {fmt$(first.payout)} at {account.profitSplit}% split</div>}
    </div>

    {sim && <div style={{ ...s.card, marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>📈 Consistency Projection</div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={sim}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
          <XAxis dataKey="day" tick={{ fill: C.textDim, fontSize: 10 }} stroke={C.border} />
          <YAxis tickFormatter={v => v.toFixed(0) + "%"} tick={{ fill: C.textDim, fontSize: 10 }} stroke={C.border} width={40} />
          <Tooltip content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0]?.payload;
            return <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 11 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Day {d.day}</div>
              <div>Profit: {fmt$(d.total)}</div>
              <div>Consistency: <span style={{ color: d.metConsistency ? C.green : C.red }}>{fmtPct(d.consistency)}</span></div>
              {d.eligible && <div style={{ color: C.green, fontWeight: 700 }}>Payout: {fmt$(d.payout)}</div>}
            </div>;
          }} />
          <ReferenceLine y={account.bestDayPct} stroke={C.green} strokeDasharray="4 4" />
          <Line type="monotone" dataKey="consistency" stroke={C.amber} strokeWidth={2} dot={(p) => {
            if (p.payload.eligible && !sim[p.payload.day - 2]?.eligible)
              return <circle cx={p.cx} cy={p.cy} r={5} fill={C.green} stroke="#fff" strokeWidth={2} />;
            return <circle cx={p.cx} cy={p.cy} r={1.5} fill={p.payload.metConsistency ? C.green : C.amber} />;
          }} name="Consistency %" />
        </LineChart>
      </ResponsiveContainer>
    </div>}

    {sim && <div style={{ ...s.card, padding: 0, overflow: "hidden" }}>
      <div style={{ overflowX: "auto", maxHeight: "50vh" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead style={{ position: "sticky", top: 0, background: C.card }}><tr style={{ borderBottom: `1px solid ${C.border}` }}>
            {["Day", "Total", "Consist.", "Eligible", "Payout"].map(h =>
              <th key={h} style={{ padding: "8px 10px", textAlign: h === "Day" ? "center" : "right", color: C.textDim, fontSize: 9, fontWeight: 700, textTransform: "uppercase" }}>{h}</th>
            )}
          </tr></thead>
          <tbody>
            {sim.map(d => <tr key={d.day} style={{ borderBottom: `1px solid ${C.border}`, background: d.eligible ? C.greenBg : "transparent" }}>
              <td style={{ padding: "6px 10px", textAlign: "center", ...s.mono, fontWeight: 600 }}>{d.day}</td>
              <td style={{ padding: "6px 10px", textAlign: "right", ...s.mono }}>{fmt$(d.total)}</td>
              <td style={{ padding: "6px 10px", textAlign: "right", ...s.mono, color: d.metConsistency ? C.green : C.red, fontWeight: 600 }}>{fmtPct(d.consistency)}</td>
              <td style={{ padding: "6px 10px", textAlign: "right" }}><Badge ok={d.eligible} label={d.eligible ? "YES" : "NO"} /></td>
              <td style={{ padding: "6px 10px", textAlign: "right", ...s.mono, fontWeight: 700, color: d.eligible ? C.green : C.textMuted }}>{d.eligible ? fmt$(d.payout) : "—"}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </div>}
  </>;
}
