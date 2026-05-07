import { useState, useMemo } from "react";
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceDot
} from "recharts";

// ── 상수 ───────────────────────────────────────────────────────────────
const ORIG_PRICE = { dram: 1.15, hbm: 2.15, nand: 0.15 };
const ORIG_OPEX  = { dram: 2800, hbm: 5000, nand: 4800 };
const BITS_PER_WAFER = { dram: 17500, hbm: 7500, nand: 77000 };
const MONTHLY_CAPA   = { dram: 1600, hbm: 400, nand: 1300 };
const ANNUAL_WAFERS  = {
  dram: MONTHLY_CAPA.dram * 1000 * 12,
  hbm:  MONTHLY_CAPA.hbm  * 1000 * 12,
  nand: MONTHLY_CAPA.nand * 1000 * 12,
};

const LABELS   = { dram: "DRAM", hbm: "HBM", nand: "NAND" };
const PRICEUNIT = { dram: "$/Gb", hbm: "$/Gb", nand: "$/GB" };   // ← 가격 단위 (슬라이더 표시)
const BITUNIT   = { dram: "Gb",   hbm: "Gb",   nand: "GB"   };   // ← Bit 단위
const COLOR    = { dram: "#38bdf8", hbm: "#a78bfa", nand: "#34d399" };
const SLIDER_R = {
  dram: { min: 0.30, max: 2.50, step: 0.01  },
  hbm:  { min: 0.50, max: 5.00, step: 0.01  },
  nand: { min: 0.03, max: 0.40, step: 0.005 },
};
const KEYS    = ["dram", "hbm", "nand"];
const LOSS    = "#f87171";
const LINE_MIN = -70; const LINE_MAX = 100;

const fmt  = (n, d = 0) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtB = (n) => `$${(n / 1e9).toFixed(1)}B`;

// ── 라인차트 툴팁 ───────────────────────────────────────────────────────
const LineTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#060e1c", border: "1px solid #1a2840", borderRadius: 8, padding: "10px 14px", fontSize: 12 }}>
      <div style={{ color: "#475569", marginBottom: 8, fontSize: 10, letterSpacing: ".1em" }}>
        기준가 대비 {label > 0 ? "+" : ""}{Number(label).toFixed(0)}% 변동 시
      </div>
      {payload.map((p) =>
        p.value != null ? (
          <div key={p.dataKey} style={{ display: "flex", justifyContent: "space-between", gap: 22, marginBottom: 3 }}>
            <span style={{ color: COLOR[p.dataKey] }}>{LABELS[p.dataKey]}</span>
            <span style={{ fontWeight: 700, color: p.value >= 0 ? COLOR[p.dataKey] : LOSS }}>
              {p.value.toFixed(1)}%
            </span>
          </div>
        ) : null
      )}
    </div>
  );
};

// ── OPEX 편집 인풋 ─────────────────────────────────────────────────────
const OpexInput = ({ k, value, onChange }) => {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState("");

  const start  = () => { setDraft(String(value)); setEditing(true); };
  const commit = () => {
    const v = parseInt(draft.replace(/,/g, ""), 10);
    if (!isNaN(v) && v > 0) onChange(k, v);
    setEditing(false);
  };

  return editing ? (
    <input
      autoFocus value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
      style={{
        width: 80, textAlign: "right", background: "#0a1628",
        border: "1px solid #38bdf8", borderRadius: 4,
        color: "#f1f5f9", fontSize: 12, padding: "1px 5px",
        fontFamily: "inherit", outline: "none",
      }}
    />
  ) : (
    <span onClick={start} title="클릭하여 수정" style={{
      cursor: "text", borderBottom: "1px dashed #334155",
      color: "#64748b", fontSize: 11, paddingBottom: 1,
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = "#38bdf8"}
      onMouseLeave={e => e.currentTarget.style.borderColor = "#334155"}
    >
      ${fmt(value)}
    </span>
  );
};

// ── 메인 ──────────────────────────────────────────────────────────────
export default function App() {
  const [prices,     setPrices]     = useState({ ...ORIG_PRICE });
  const [basePrices, setBasePrices] = useState({ ...ORIG_PRICE });
  const [opex,       setOpex]       = useState({ ...ORIG_OPEX  });

  const updateOpex = (k, v) => setOpex(o => ({ ...o, [k]: v }));

  const metrics = useMemo(() => KEYS.map((k) => {
    const rev   = BITS_PER_WAFER[k] * prices[k];
    const total = rev * ANNUAL_WAFERS[k];
    const op    = rev - opex[k];
    const mg    = rev > 0 ? (op / rev) * 100 : -Infinity;
    return { key: k, rev, total, op, mg };
  }), [prices, opex]);

  const sorted   = [...metrics].sort((a, b) => b.mg - a.mg);
  const totalMkt = metrics.reduce((s, m) => s + m.total, 0);
  const badge    = ["①", "②", "③"];

  const lineData = useMemo(() => {
    const pts = [];
    for (let p = LINE_MIN; p <= LINE_MAX; p++) {
      const pt = { pct: p };
      KEYS.forEach((k) => {
        const pr = basePrices[k] * (1 + p / 100);
        const rv = BITS_PER_WAFER[k] * Math.max(pr, 0);
        pt[k] = rv > 0 ? parseFloat(((rv - opex[k]) / rv * 100).toFixed(2)) : null;
      });
      pts.push(pt);
    }
    return pts;
  }, [basePrices, opex]);

  const curPct = useMemo(() =>
    Object.fromEntries(KEYS.map((k) => [k, (prices[k] / basePrices[k] - 1) * 100])),
    [prices, basePrices]
  );
  const curMg = useMemo(() =>
    Object.fromEntries(KEYS.map((k) => {
      const rv = BITS_PER_WAFER[k] * prices[k];
      return [k, rv > 0 ? (rv - opex[k]) / rv * 100 : null];
    })),
    [prices, opex]
  );

  const handleReset  = () => { setPrices({ ...ORIG_PRICE }); setBasePrices({ ...ORIG_PRICE }); setOpex({ ...ORIG_OPEX }); };
  const handleRebase = () => setBasePrices({ ...prices });

  return (
    <div style={{
      minHeight: "100vh", background: "#060e1c", color: "#e2e8f0",
      fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
      padding: "20px 26px", boxSizing: "border-box",
    }}>
      <style>{`
        input[type=range]{-webkit-appearance:none;appearance:none;background:transparent;height:18px;cursor:pointer;width:100%}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:13px;height:13px;border-radius:50%;background:#f1f5f9;border:2px solid #334155;cursor:pointer;transition:box-shadow .15s}
        input[type=range]::-webkit-slider-thumb:hover{box-shadow:0 0 0 5px rgba(241,245,249,.12)}
        .c{background:#0b1827;border:1px solid #1a2840;border-radius:10px}
        .dl{color:#334155;font-size:9px;letter-spacing:.12em;text-transform:uppercase}
      `}</style>

      {/* 헤더 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}>
        <div>
          <div className="dl" style={{ marginBottom: 4 }}>Memory Semiconductor · Profitability Simulator · 2026E</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9", letterSpacing: "-0.02em" }}>
            메모리 제품별 수익성 시뮬레이터
          </div>
        </div>
        <button onClick={handleReset} style={{
          fontSize: 10, color: "#475569", background: "none",
          border: "1px solid #1a2840", borderRadius: 5, padding: "5px 13px",
          cursor: "pointer", letterSpacing: ".08em",
        }}>전체 초기화</button>
      </div>

      {/* 슬라이더 */}
      <div className="c" style={{ padding: "15px 20px", marginBottom: 12 }}>
        <div className="dl" style={{ marginBottom: 13 }}>Bit 단가 조정</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0 34px" }}>
          {KEYS.map((k) => {
            const r    = SLIDER_R[k];
            const fill = ((prices[k] - r.min) / (r.max - r.min)) * 100;
            const diff = (prices[k] / basePrices[k] - 1) * 100;
            const isUp = diff > 0.05, isDn = diff < -0.05;
            return (
              <div key={k}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 6 }}>
                  <div>
                    <span style={{ color: COLOR[k], fontWeight: 600, fontSize: 13 }}>{LABELS[k]}</span>
                    {/* ── 단위: DRAM/HBM → Gb, NAND → GB ── */}
                    <span className="dl" style={{ marginLeft: 6, fontSize: 9 }}>{PRICEUNIT[k]}</span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9" }}>
                      ${prices[k].toFixed(k === "nand" ? 3 : 2)}
                    </span>
                    <span style={{ fontSize: 10, marginLeft: 5, color: isUp ? "#4ade80" : isDn ? LOSS : "#334155" }}>
                      {isUp ? "+" : ""}{diff.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div style={{ position: "relative" }}>
                  <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 3, background: "#1e293b", borderRadius: 2, transform: "translateY(-50%)" }} />
                  <div style={{ position: "absolute", top: "50%", left: 0, width: `${Math.min(100, Math.max(0, fill))}%`, height: 3, background: COLOR[k], borderRadius: 2, transform: "translateY(-50%)" }} />
                  <input type="range" min={r.min} max={r.max} step={r.step} value={prices[k]}
                    onChange={e => setPrices(p => ({ ...p, [k]: parseFloat(e.target.value) }))} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#1e3a5f", marginTop: 1 }}>
                  <span>${r.min}</span>
                  <span style={{ color: "#2d4a6a" }}>기준 ${basePrices[k].toFixed(k === "nand" ? 3 : 2)}</span>
                  <span>${r.max}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 제품별 지표 요약 */}
      <div className="c" style={{ padding: "13px 20px", marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 11 }}>
          <div className="dl">제품별 지표 요약 — Wafer 1장 기준</div>
          <div style={{ fontSize: 9, color: "#2d4a6a" }}>영업원가 클릭 시 직접 수정 가능</div>
        </div>
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 0.85fr 1fr 1fr 1fr 1fr 0.8fr",
          fontSize: 9, color: "#2d4a6a", letterSpacing: ".1em", textTransform: "uppercase",
          borderBottom: "1px solid #0f1f33", paddingBottom: 6, marginBottom: 2,
        }}>
          {["제품", "Wafer당 Bit", "장당 매출액", "영업원가 ✎", "장당 영업이익", "전체 시장규모", "이익률"].map((h, i) => (
            <span key={i} style={{ textAlign: i > 0 ? "right" : "left" }}>{h}</span>
          ))}
        </div>
        {sorted.map((m, i) => {
          const pos = m.op >= 0;
          return (
            <div key={m.key} style={{
              display: "grid", gridTemplateColumns: "1fr 0.85fr 1fr 1fr 1fr 1fr 0.8fr",
              padding: "8px 0", borderBottom: "1px solid #0a1628", alignItems: "center",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ fontSize: 11, color: "#334155" }}>{badge[i]}</span>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: COLOR[m.key] }} />
                <span style={{ fontSize: 12, color: COLOR[m.key], fontWeight: 600 }}>{LABELS[m.key]}</span>
              </div>
              <span style={{ textAlign: "right", fontSize: 11, color: "#64748b" }}>
                {fmt(BITS_PER_WAFER[m.key])} {BITUNIT[m.key]}
              </span>
              <span style={{ textAlign: "right", fontSize: 12, color: "#94a3b8" }}>
                ${fmt(Math.round(m.rev))}
              </span>
              <div style={{ textAlign: "right" }}>
                <OpexInput k={m.key} value={opex[m.key]} onChange={updateOpex} />
              </div>
              <span style={{ textAlign: "right", fontSize: 12, fontWeight: 700, color: pos ? "#4ade80" : LOSS }}>
                {pos ? "+" : "-"}${fmt(Math.abs(Math.round(m.op)))}
              </span>
              <span style={{ textAlign: "right", fontSize: 12, color: "#94a3b8" }}>
                {fmtB(m.total)}
              </span>
              <div style={{ textAlign: "right" }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 4,
                  background: pos ? "#052e16" : "#2d1212", color: pos ? "#4ade80" : LOSS,
                }}>
                  {m.mg.toFixed(1)}%
                </span>
              </div>
            </div>
          );
        })}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 0.85fr 1fr 1fr 1fr 1fr 0.8fr",
          paddingTop: 8, alignItems: "center",
        }}>
          <span className="dl">Total</span>
          <span /><span /><span /><span />
          <span style={{ textAlign: "right", fontSize: 13, fontWeight: 700, color: "#64748b" }}>
            {fmtB(totalMkt)}
          </span>
          <span />
        </div>
      </div>

      {/* 라인차트 */}
      <div className="c" style={{ padding: "13px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div>
            <div className="dl" style={{ marginBottom: 4 }}>가격 변화율 대비 영업이익률 추이</div>
            <div style={{ fontSize: 9, color: "#1e3a5f" }}>
              ● = 현재 선택가 위치 &nbsp;|&nbsp; 점선 = 기준가(0%) &nbsp;|&nbsp; 적선 = 손익분기점
            </div>
          </div>
          <button onClick={handleRebase} style={{
            fontSize: 10, color: "#38bdf8", background: "rgba(56,189,248,0.06)",
            border: "1px solid rgba(56,189,248,0.18)", borderRadius: 5,
            padding: "5px 13px", cursor: "pointer", letterSpacing: ".06em", whiteSpace: "nowrap",
          }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(56,189,248,0.13)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(56,189,248,0.06)"}
          >
            현재가를 기준점으로 재설정
          </button>
        </div>
        <div style={{ display: "flex", gap: 20, marginBottom: 10 }}>
          {KEYS.map((k) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
              <svg width="22" height="10">
                <line x1="0" y1="5" x2="22" y2="5" stroke={COLOR[k]} strokeWidth="2"/>
                <circle cx="11" cy="5" r="4" fill={COLOR[k]} stroke="#060e1c" strokeWidth="1.5"/>
              </svg>
              <span style={{ color: "#64748b" }}>{LABELS[k]}</span>
              <span style={{ color: curMg[k] != null && curMg[k] >= 0 ? COLOR[k] : LOSS, fontWeight: 700 }}>
                {curMg[k] != null ? `${curMg[k].toFixed(1)}%` : "N/A"}
              </span>
            </div>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={lineData} margin={{ top: 10, right: 24, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#0d1e30" vertical={false} />
            <XAxis
              dataKey="pct" type="number"
              domain={[LINE_MIN, LINE_MAX]}
              ticks={[-60, -40, -20, 0, 20, 40, 60, 80, 100]}
              tickFormatter={(v) => `${v > 0 ? "+" : ""}${v}%`}
              tick={{ fontSize: 9, fill: "#2d4a6a" }}
              axisLine={{ stroke: "#1a2840" }} tickLine={false}
            />
            <YAxis
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 9, fill: "#2d4a6a" }}
              axisLine={false} tickLine={false} width={40}
            />
            <Tooltip content={<LineTooltip />} cursor={{ stroke: "#1e3a5f", strokeWidth: 1, strokeDasharray: "3 3" }} />
            <ReferenceLine x={0} stroke="#1e3a5f" strokeDasharray="5 3"
              label={{ value: "기준가", position: "insideTopLeft", fill: "#2d4a6a", fontSize: 9, dy: -10 }} />
            <ReferenceLine y={0} stroke="#3d1515" strokeWidth={1.5} />
            {KEYS.map((k) => (
              <Line key={k} type="monotone" dataKey={k}
                stroke={COLOR[k]} strokeWidth={1.8} dot={false} connectNulls={false}
                activeDot={{ r: 4, fill: COLOR[k], stroke: "#060e1c", strokeWidth: 2 }}
              />
            ))}
            {KEYS.map((k) => {
              const x = curPct[k]; const y = curMg[k];
              if (y == null || x < LINE_MIN - 1 || x > LINE_MAX + 1) return null;
              return (
                <ReferenceDot key={k}
                  x={parseFloat(x.toFixed(1))} y={parseFloat(y.toFixed(2))}
                  r={5} fill={COLOR[k]} stroke="#060e1c" strokeWidth={2}
                  label={{ value: `${y.toFixed(1)}%`, position: "top", fill: COLOR[k], fontSize: 9, dy: -3 }}
                />
              );
            })}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 주석 */}
      <div style={{ marginTop: 10, fontSize: 9, color: "#1a2e44", lineHeight: 2 }}>
        * 장당 매출액 = Wafer당 Bit × Bit단가 &nbsp;|&nbsp;
        전체 시장규모 = 장당 매출액 × 연간 Capa(월Capa×1,000×12) &nbsp;|&nbsp;
        라인차트: "현재가를 기준점으로 재설정" 클릭 시 선그래프가 현재 선택가 기준으로 재계산
        <br />
        † DRAM 수치는 HBM을 포함하지 않은 Conventional DRAM 기준이며, HBM은 별도 항목으로 구분 표기됨
      </div>
    </div>
  );
}
