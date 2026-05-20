import { useState, useRef, useEffect } from "react";

/**
 * DonutChart – beautiful interactive SVG donut with hover/touch support.
 *
 * Props
 * ─────
 * segments  [{label, value, color, icon?}]  – required
 * total     number                           – optional override; defaults to sum of values
 * size      number                           – SVG canvas side length (default 140)
 * thickness number                           – ring thickness in px  (default 22)
 * centerLabel string                         – top line in center hole
 * centerSub   string                         – bottom line in center hole
 * onHover     (index|null) => void           – optional callback
 */
export default function DonutChart({
  segments = [],
  total: totalProp,
  size = 140,
  thickness = 22,
  centerLabel,
  centerSub,
  onHover,
}) {
  const [hovered, setHovered] = useState(null);
  const [tooltip, setTooltip] = useState(null); // {x,y,label,pct,value}
  const svgRef = useRef(null);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 80);
    return () => clearTimeout(t);
  }, []);

  const total = totalProp ?? segments.reduce((s, r) => s + (r.value ?? 0), 0);
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;

  /* build arc paths */
  let cumAngle = -90; // start at top
  const arcs = segments.map((seg, i) => {
    const pct = total > 0 ? (seg.value / total) * 100 : 0;
    const angle = (pct / 100) * 360;
    const startAngle = cumAngle;
    cumAngle += angle;
    const endAngle = cumAngle;
    return { ...seg, pct, startAngle, endAngle, index: i };
  });

  function polarToXY(angleDeg, radius) {
    const rad = (angleDeg * Math.PI) / 180;
    return {
      x: cx + radius * Math.cos(rad),
      y: cy + radius * Math.sin(rad),
    };
  }

  function arcPath(startAngle, endAngle, outerR, innerR, expand = false) {
    // expand: push segment outward slightly when hovered
    const gap = 1.5; // gap between segments in degrees
    const s = startAngle + gap / 2;
    const e = endAngle - gap / 2;
    if (e - s <= 0) return "";

    const midAngle = (s + e) / 2;
    const offset = expand ? 5 : 0;
    const ox = expand ? Math.cos((midAngle * Math.PI) / 180) * offset : 0;
    const oy = expand ? Math.sin((midAngle * Math.PI) / 180) * offset : 0;

    const outerS = polarToXY(s, outerR);
    const outerE = polarToXY(e, outerR);
    const innerS = polarToXY(s, innerR);
    const innerE = polarToXY(e, innerR);
    const large = e - s > 180 ? 1 : 0;

    return `
      M ${outerS.x + ox} ${outerS.y + oy}
      A ${outerR} ${outerR} 0 ${large} 1 ${outerE.x + ox} ${outerE.y + oy}
      L ${innerE.x + ox} ${innerE.y + oy}
      A ${innerR} ${innerR} 0 ${large} 0 ${innerS.x + ox} ${innerS.y + oy}
      Z
    `;
  }

  function handleEnter(e, arc) {
    setHovered(arc.index);
    onHover?.(arc.index);
    const svgRect = svgRef.current?.getBoundingClientRect();
    if (svgRect) {
      const mid = (arc.startAngle + arc.endAngle) / 2;
      const tip = polarToXY(mid, r);
      setTooltip({
        svgX: tip.x,
        svgY: tip.y,
        label: arc.label,
        pct: arc.pct,
        value: arc.value,
      });
    }
  }

  function handleLeave() {
    setHovered(null);
    setTooltip(null);
    onHover?.(null);
  }

  /* touch support */
  function handleTouchStart(e, arc) {
    e.preventDefault();
    handleEnter(e, arc);
  }

  const outerR = size / 2 - 2;
  const innerR = outerR - thickness;

  /* center text */
  const activeArc = hovered !== null ? arcs[hovered] : null;
  const displayLabel = activeArc ? `${activeArc.pct.toFixed(1)}%` : centerLabel;
  const displaySub = activeArc ? activeArc.label : centerSub;

  return (
    <div style={{ position: "relative", display: "inline-block", userSelect: "none" }}>
      <svg
        ref={svgRef}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ overflow: "visible", display: "block" }}
      >
        <defs>
          {arcs.map((arc, i) => (
            <radialGradient key={i} id={`donut-grad-${i}`} cx="50%" cy="50%" r="60%">
              <stop offset="0%" stopColor={arc.color} stopOpacity="1" />
              <stop offset="100%" stopColor={arc.color} stopOpacity="0.75" />
            </radialGradient>
          ))}
          {/* glow filter for active segment */}
          <filter id="donut-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* subtle drop shadow for inactive */}
          <filter id="donut-shadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.12" />
          </filter>
        </defs>

        {/* track ring */}
        <circle
          cx={cx} cy={cy} r={(outerR + innerR) / 2}
          fill="none"
          stroke="rgba(148,163,184,0.10)"
          strokeWidth={thickness}
        />

        {/* segments */}
        {arcs.map((arc, i) => {
          const isHov = hovered === i;
          const isDim = hovered !== null && !isHov;
          return (
            <g key={i}>
              <path
                d={arcPath(arc.startAngle, arc.endAngle, outerR, innerR, isHov)}
                fill={`url(#donut-grad-${i})`}
                filter={isHov ? "url(#donut-glow)" : "url(#donut-shadow)"}
                opacity={isDim ? 0.35 : 1}
                style={{
                  transition: "opacity 0.25s ease, d 0.2s ease",
                  cursor: "pointer",
                  strokeWidth: isHov ? 1.5 : 0,
                  stroke: isHov ? "#fff" : "none",
                }}
                onMouseEnter={(e) => handleEnter(e, arc)}
                onMouseLeave={handleLeave}
                onTouchStart={(e) => handleTouchStart(e, arc)}
                onTouchEnd={handleLeave}
              />
              {/* percentage tick on hover */}
              {isHov && (() => {
                const mid = (arc.startAngle + arc.endAngle) / 2;
                const tickPt = polarToXY(mid, outerR + 10);
                return (
                  <text
                    x={tickPt.x} y={tickPt.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="9"
                    fontWeight="800"
                    fill={arc.color}
                    style={{ pointerEvents: "none" }}
                  >
                    {arc.pct.toFixed(1)}%
                  </text>
                );
              })()}
            </g>
          );
        })}

        {/* center hole */}
        <circle cx={cx} cy={cy} r={innerR - 2} fill="white" />
        <circle cx={cx} cy={cy} r={innerR - 2} fill="url(#centerGrad)" />
        <defs>
          <radialGradient id="centerGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#F8FAFC" />
          </radialGradient>
        </defs>
        <circle cx={cx} cy={cy} r={innerR - 2} fill="none" stroke="rgba(226,232,240,0.8)" strokeWidth="1.5" />

        {/* center label */}
        <text
          x={cx} y={cy - 6}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={activeArc ? "13" : "11"}
          fontWeight="800"
          fill={activeArc ? activeArc.color : "#1E293B"}
          style={{ transition: "all 0.2s ease", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          {displayLabel}
        </text>
        <text
          x={cx} y={cy + 9}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="7"
          fontWeight="600"
          fill="#94A3B8"
          letterSpacing="0.05em"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          {displaySub?.toUpperCase()}
        </text>
      </svg>
    </div>
  );
}
