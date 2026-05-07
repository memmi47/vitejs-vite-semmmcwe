import React, { useState, useMemo } from "react";
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceDot
} from "recharts";
import "./App.css";

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
const PRICEUNIT = { dram: "$/Gb", hbm: "$/Gb", nand: "$/GB" };   
const BITUNIT   = { dram: "Gb",   hbm: "Gb",   nand: "GB"   };   
const COLOR    = { dram: "var(--color-dram)", hbm: "var(--color-hbm)", nand: "var(--color-nand)" };
const SLIDER_R = {
  dram: { min: 0.30, max: 2.50, step: 0.01  },
  hbm:  { min: 0.50, max: 5.00, step: 0.01  },
  nand: { min: 0.03, max: 0.40, step: 0.005 },
};
const KEYS    = ["dram", "hbm", "nand"];
const LOSS    = "var(--color-loss)";
const LINE_MIN = -70; const LINE_MAX = 100;

const fmt  = (n, d = 0) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtB = (n) => `$${(n / 1e9).toFixed(1)}B`;

// ── 라인차트 툴팁 ───────────────────────────────────────────────────────
const LineTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 8, padding: "10px 14px", fontSize: 14, boxShadow: "0 4px 6px rgba(0,0,0,0.3)" }}>
      <div style={{ color: "var(--text-dim)", marginBottom: 8, fontSize: 12, letterSpacing: ".1em" }}>
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
const OpexInput = ({ k, value, onChange }: any) => {
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
      className="opex-input"
    />
  ) : (
    <span onClick={start} title="클릭하여 수정" className="opex-display">
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

  const totalMkt = metrics.reduce((s, m) => s + m.total, 0);

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
    <div className="app-container">
      {/* 헤더 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div className="section-label">Memory Semiconductor · Profitability Simulator · 2026E</div>
          <div style={{ fontSize: "clamp(18px, 4vw, 22px)", fontWeight: 700, color: "var(--text-main)", letterSpacing: "-0.02em" }}>
            메모리 제품별 수익성 시뮬레이터
          </div>
        </div>
        <button onClick={handleReset} className="btn-outline">전체 초기화</button>
      </div>

      {/* 슬라이더 */}
      <div className="card">
        <div className="section-label" style={{ marginBottom: 16 }}>Bit 단가 조정</div>
        <div className="slider-grid">
          {KEYS.map((k) => {
            const r    = SLIDER_R[k];
            const fill = ((prices[k] - r.min) / (r.max - r.min)) * 100;
            const diff = (prices[k] / basePrices[k] - 1) * 100;
            const isUp = diff > 0.05, isDn = diff < -0.05;
            return (
              <div key={k}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 6 }}>
                  <div>
                    <span style={{ color: COLOR[k], fontWeight: 600, fontSize: 15 }}>{LABELS[k]}</span>
                    {/* ── 단위: DRAM/HBM → Gb, NAND → GB ── */}
                    <span className="section-label" style={{ marginLeft: 6, fontSize: 11 }}>{PRICEUNIT[k]}</span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: 18, fontWeight: 700, color: "var(--text-main)" }}>
                      ${prices[k].toFixed(k === "nand" ? 3 : 2)}
                    </span>
                    <span style={{ fontSize: 12, marginLeft: 5, color: isUp ? "var(--color-success)" : isDn ? LOSS : "var(--text-dim)" }}>
                      {isUp ? "+" : ""}{diff.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="slider-container" style={{ '--thumb-color': COLOR[k] } as React.CSSProperties}>
                  <div className="slider-track-bg" />
                  <div className="slider-track-fill" style={{ width: `${Math.min(100, Math.max(0, fill))}%`, background: COLOR[k] }} />
                  <input type="range" min={r.min} max={r.max} step={r.step} value={prices[k]}
                    onChange={e => setPrices(p => ({ ...p, [k]: parseFloat(e.target.value) }))} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-dark)", marginTop: 4 }}>
                  <span>${r.min}</span>
                  <span style={{ color: "var(--text-dim)" }}>기준 ${basePrices[k].toFixed(k === "nand" ? 3 : 2)}</span>
                  <span>${r.max}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 제품별 지표 요약 */}
      <div className="card">
        <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="section-label" style={{ marginBottom: 0 }}>제품별 지표 요약 — Wafer 1장 기준</div>
          <div style={{ fontSize: 12, color: "var(--text-dim)" }}>영업원가 클릭 시 직접 수정 가능</div>
        </div>
        
        {/* Desktop Header */}
        <div className="data-table-header">
          <div className="col-left">지표 (Wafer 1장 기준)</div>
          <div className="col-right" style={{ color: COLOR.dram, fontWeight: 700 }}>DRAM</div>
          <div className="col-right" style={{ color: COLOR.hbm, fontWeight: 700 }}>HBM</div>
          <div className="col-right" style={{ color: COLOR.nand, fontWeight: 700 }}>NAND</div>
        </div>
        
        {/* Row 1: Wafer당 Bit */}
        <div className="data-table-row">
          <div className="col-left"><span className="section-label" style={{ marginBottom: 0 }}>Wafer당 Bit</span></div>
          {metrics.map(m => (
            <div key={m.key} className="col-right" style={{ fontSize: 13, color: "var(--text-muted)" }}>
              {fmt(BITS_PER_WAFER[m.key])} {BITUNIT[m.key]}
            </div>
          ))}
        </div>

        {/* Row 2: 장당 매출액 */}
        <div className="data-table-row">
          <div className="col-left"><span className="section-label" style={{ marginBottom: 0 }}>장당 매출액</span></div>
          {metrics.map(m => (
            <div key={m.key} className="col-right" style={{ fontSize: 14, color: "var(--text-muted)" }}>
              ${fmt(Math.round(m.rev))}
            </div>
          ))}
        </div>

        {/* Row 3: 영업원가 */}
        <div className="data-table-row">
          <div className="col-left"><span className="section-label" style={{ marginBottom: 0 }}>영업원가 ✎</span></div>
          {metrics.map(m => (
            <div key={m.key} className="col-right">
              <OpexInput k={m.key} value={opex[m.key]} onChange={updateOpex} />
            </div>
          ))}
        </div>

        {/* Row 4: 장당 영업이익 */}
        <div className="data-table-row">
          <div className="col-left"><span className="section-label" style={{ marginBottom: 0 }}>장당 영업이익</span></div>
          {metrics.map(m => {
            const pos = m.op >= 0;
            return (
              <div key={m.key} className="col-right" style={{ fontSize: 14, fontWeight: 700, color: pos ? "var(--color-success)" : LOSS }}>
                {pos ? "+" : "-"}${fmt(Math.abs(Math.round(m.op)))}
              </div>
            );
          })}
        </div>

        {/* Row 5: 이익률 */}
        <div className="data-table-row">
          <div className="col-left"><span className="section-label" style={{ marginBottom: 0 }}>이익률</span></div>
          {metrics.map(m => {
            const pos = m.op >= 0;
            return (
              <div key={m.key} className="col-right">
                <span className={`badge ${pos ? "success" : "loss"}`}>
                  {m.mg.toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>

        {/* Row 6: 전체 시장규모 */}
        <div className="data-table-row">
          <div className="col-left"><span className="section-label" style={{ marginBottom: 0 }}>전체 시장규모</span></div>
          {metrics.map(m => (
            <div key={m.key} className="col-right" style={{ fontSize: 14, color: "var(--text-muted)" }}>
              {fmtB(m.total)}
            </div>
          ))}
        </div>

        {/* Total Row */}
        <div className="data-table-total" style={{ display: "flex", justifyContent: "space-between" }}>
          <span className="section-label" style={{ marginBottom: 0 }}>Total 시장규모</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-main)" }}>
            {fmtB(totalMkt)}
          </span>
        </div>
      </div>

      {/* 라인차트 */}
      <div className="card">
        <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="section-label">가격 변화율 대비 영업이익률 추이</div>
            <div style={{ fontSize: 14, color: "var(--text-dark)", marginTop: 4 }}>
              ● = 현재 선택가 위치 &nbsp;|&nbsp; 점선 = 기준가(0%) &nbsp;|&nbsp; 적선 = 손익분기점
            </div>
          </div>
          <button onClick={handleRebase} className="btn-accent">
            현재가를 기준점으로 재설정
          </button>
        </div>
        <div style={{ display: "flex", gap: 20, marginBottom: 12, flexWrap: "wrap" }}>
          {KEYS.map((k) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 15 }}>
              <svg width="22" height="10">
                <line x1="0" y1="5" x2="22" y2="5" stroke={COLOR[k]} strokeWidth="2"/>
                <circle cx="11" cy="5" r="4" fill={COLOR[k]} stroke="var(--bg-card)" strokeWidth="1.5"/>
              </svg>
              <span style={{ color: "var(--text-muted)" }}>{LABELS[k]}</span>
              <span style={{ color: curMg[k] != null && curMg[k] >= 0 ? COLOR[k] : LOSS, fontWeight: 700 }}>
                {curMg[k] != null ? `${curMg[k].toFixed(1)}%` : "N/A"}
              </span>
            </div>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={lineData} margin={{ top: 10, right: 24, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
            <XAxis
              dataKey="pct" type="number"
              domain={[LINE_MIN, LINE_MAX]}
              ticks={[-60, -40, -20, 0, 20, 40, 60, 80, 100]}
              tickFormatter={(v) => `${v > 0 ? "+" : ""}${v}%`}
              tick={{ fontSize: 13, fill: "var(--text-dim)" }}
              axisLine={{ stroke: "var(--border-color)" }} tickLine={false}
            />
            <YAxis
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 13, fill: "var(--text-dim)" }}
              axisLine={false} tickLine={false} width={45}
            />
            <Tooltip content={<LineTooltip />} cursor={{ stroke: "var(--text-dim)", strokeWidth: 1, strokeDasharray: "3 3" }} />
            <ReferenceLine x={0} stroke="var(--text-dim)" strokeDasharray="5 3"
              label={{ value: "기준가", position: "insideTopLeft", fill: "var(--text-dim)", fontSize: 13, dy: -12 }} />
            <ReferenceLine y={0} stroke="rgba(248, 113, 113, 0.3)" strokeWidth={1.5} />
            {KEYS.map((k) => (
              <Line key={k} type="monotone" dataKey={k}
                stroke={COLOR[k]} strokeWidth={1.8} dot={false} connectNulls={false}
                activeDot={{ r: 4, fill: COLOR[k], stroke: "var(--bg-card)", strokeWidth: 2 }}
              />
            ))}
            {KEYS.map((k) => {
              const x = curPct[k]; const y = curMg[k];
              if (y == null || x < LINE_MIN - 1 || x > LINE_MAX + 1) return null;
              return (
                <ReferenceDot key={k}
                  x={parseFloat(x.toFixed(1))} y={parseFloat(y.toFixed(2))}
                  r={5} fill={COLOR[k]} stroke="var(--bg-card)" strokeWidth={2}
                  label={{ value: `${y.toFixed(1)}%`, position: "top", fill: COLOR[k], fontSize: 13, dy: -5 }}
                />
              );
            })}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 주석 */}
      <div style={{ marginTop: 8, fontSize: 10, color: "var(--text-dark)", lineHeight: 1.8 }}>
        * 장당 매출액 = Wafer당 Bit × Bit단가 &nbsp;|&nbsp;
        전체 시장규모 = 장당 매출액 × 연간 Capa(월Capa×1,000×12) &nbsp;|&nbsp;
        라인차트: "현재가를 기준점으로 재설정" 클릭 시 선그래프가 현재 선택가 기준으로 재계산
        <br />
        † DRAM 수치는 HBM을 포함하지 않은 Conventional DRAM 기준이며, HBM은 별도 항목으로 구분 표기됨
      </div>
    </div>
  );
}
