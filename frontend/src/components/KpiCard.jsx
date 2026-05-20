import { useState, useEffect, useRef } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";

function EditableField({ textKey, defaultText, style, inputStyle }) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("editable_texts") || "{}") || {};
      return saved[textKey] || defaultText;
    } catch {
      return defaultText;
    }
  });
  const inputRef = useRef(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("editable_texts") || "{}") || {};
      setValue(saved[textKey] || defaultText);
    } catch {
      setValue(defaultText);
    }
  }, [textKey, defaultText]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    setIsEditing(false);
    if (value.trim() && value !== defaultText) {
      try {
        const saved = JSON.parse(localStorage.getItem("editable_texts") || "{}") || {};
        saved[textKey] = value.trim();
        localStorage.setItem("editable_texts", JSON.stringify(saved));
      } catch {}
    } else if (!value.trim()) {
      setValue(defaultText);
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          else if (e.key === "Escape") {
            setValue(defaultText);
            setIsEditing(false);
          }
        }}
        style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          border: "none",
          borderBottom: "2px solid #8B5CF6",
          background: "transparent",
          outline: "none",
          padding: "0",
          minWidth: 40,
          ...style,
          ...inputStyle,
        }}
      />
    );
  }

  return (
    <span
      onClick={() => setIsEditing(true)}
      style={{ cursor: "pointer", borderBottom: "1px dashed transparent", transition: "border-color 0.2s", ...style }}
      title="Cliquez pour modifier"
      onMouseEnter={(e) => (e.currentTarget.style.borderBottomColor = "#94A3B8")}
      onMouseLeave={(e) => (e.currentTarget.style.borderBottomColor = "transparent")}
    >
      {value}
    </span>
  );
}

export default function KpiCard({
  title,
  value,
  subtitle,
  delta,
  color = "#3B82F6",
  icon,
  negativeIsGood = false,
  titleKey,
  subtitleKey,
  valN1,
}) {
  // helpers
  const hex2rgba = (hex, a) => {
    if (!hex || hex.length < 7) return `rgba(59,130,246,${a})`;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${a})`;
  };

  const lighten = (hex, amount = 0.5) => {
    if (!hex || hex.length < 7) return hex;
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);
    r = Math.round(r + (255 - r) * amount);
    g = Math.round(g + (255 - g) * amount);
    b = Math.round(b + (255 - b) * amount);
    return `rgb(${r},${g},${b})`;
  };

  const parseDelta = (raw) => {
    if (!raw) return { percent: null, isPos: null };
    const match = raw.match(/^([+\-−]?\d+(?:\.\d+)?%?)/);
    if (match) {
      const pct = match[1].replace("−", "-");
      const isPos = !pct.startsWith("-");
      return { percent: pct, isPos };
    }
    const isPos = !raw.startsWith("-") && !raw.startsWith("−");
    return { percent: raw, isPos };
  };

  const { percent, isPos } = parseDelta(delta);
  const isGood = isPos === null ? null : negativeIsGood ? !isPos : isPos;
  const deltaColor = isGood === null ? "#64748B" : isGood ? "#059669" : "#DC2626";

  // split value and unit
  const hasTND = typeof value === "string" && value.includes(" TND");
  const numericValue = hasTND ? value.replace(" TND", "") : value;

  // New layout for KpiCard
return (
  <div
    style={{
      background: `linear-gradient(145deg, ${lighten(color, 0.9)} 0%, ${lighten(color, 0.8)} 100%)`,
      borderRadius: "16px",
      padding: "24px",
      boxShadow: `0 4px 12px ${hex2rgba(color, 0.12)}`,
      border: `1px solid ${hex2rgba(color, 0.08)}`,
      position: "relative",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      gap: "12px",
    }}
    onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-3px)")}
    onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}
  >
    {/* Top row: Icon, Delta */}
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
      {/* Icon */}
      {icon ? (
        <div
          style={{
            flexShrink: 0,
            width: 40,
            height: 40,
            borderRadius: 10,
            background: `linear-gradient(135deg, ${color} 0%, ${hex2rgba(color, 0.7)} 100%)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            boxShadow: `0 3px 8px ${hex2rgba(color, 0.3)}`,
          }}
        >
          {icon}
        </div>
      ) : <div />}
      
      {/* Delta badge on top right */}
      {percent && (
        <span
          style={{
            flexShrink: 0,
            fontSize: 13,
            fontWeight: "700",
            color: deltaColor,
            background: isPos ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
            border: `1px solid ${isPos ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
            borderRadius: 8,
            padding: "4px 10px",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          {isPos ? <ArrowUp size={16} strokeWidth={3} /> : <ArrowDown size={16} strokeWidth={3} />}
          {percent.replace(/^[+\-−]/, '')}
        </span>
      )}
    </div>

    {/* Title */}
    <div style={{ marginTop: 2 }}>
      <span
        style={{
          fontSize: 15,
          fontWeight: "800",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: color,
          fontFamily: "var(--font-heading)",
          lineHeight: 1.3,
        }}
      >
        {titleKey ? <EditableField textKey={titleKey} defaultText={title} /> : title}
      </span>
    </div>

    {/* Value and Subtitle */}
    <div style={{ display: "flex", flexDirection: "column", marginTop: 4 }}>
      {/* Main Value */}
      <span
        style={{
          fontSize: 36,
          fontWeight: "700",
          color: "#0F172A",
          letterSpacing: "-0.03em",
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1.1,
          fontFamily: "var(--font-heading)",
        }}
      >
        {typeof value === "string" && value.includes(" TND") ? (
          <>
            {value.replace(" TND", "")}
            <span style={{ fontSize: "0.45em", opacity: 0.7, marginLeft: "4px", fontWeight: 700 }}>TND</span>
          </>
        ) : (
          value
        )}
      </span>

      {/* Subtitle */}
      {subtitle && (
        <span
          style={{
            fontSize: 13,
            color: "#64748B",
            fontWeight: "600",
            marginTop: 4,
          }}
        >
          {subtitleKey ? <EditableField textKey={subtitleKey} defaultText={subtitle} /> : subtitle}
        </span>
      )}
    </div>

    {/* N-1 badge on bottom right */}
    {valN1 !== undefined && valN1 !== null && (
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
        <span
          style={{
            fontSize: 13,
            fontWeight: "700",
            background: hex2rgba(color, 0.08),
            border: `1px solid ${hex2rgba(color, 0.2)}`,
            color: color,
            borderRadius: 8,
            padding: "4px 10px",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            whiteSpace: "nowrap"
          }}
        >
          <span style={{ fontSize: 11, fontWeight: "700", opacity: 0.8, textTransform: "uppercase", letterSpacing: "0.05em" }}>N‑1 :</span>
          <span>{valN1}</span>
        </span>
      </div>
    )}
  </div>
);
}
