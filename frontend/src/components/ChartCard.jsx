/**
 * ChartCard — Premium white card for recharts visualizations
 */
import { useState, useRef, useEffect } from "react";

function EditableSpan({ textKey, defaultText, style }) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("editable_texts") || "{}");
      return saved[textKey] || defaultText;
    } catch { return defaultText; }
  });
  const inputRef = useRef(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("editable_texts") || "{}");
      setValue(saved[textKey] || defaultText);
    } catch { setValue(defaultText); }
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
        const saved = JSON.parse(localStorage.getItem("editable_texts") || "{}");
        saved[textKey] = value.trim();
        localStorage.setItem("editable_texts", JSON.stringify(saved));
      } catch {}
    } else if (!value.trim()) {
      setValue(defaultText);
    }
  };

  if (isEditing) {
    return (
      <input ref={inputRef} type="text" value={value}
        onChange={e => setValue(e.target.value)} onBlur={handleSave}
        onKeyDown={e => { if (e.key==="Enter") handleSave(); else if (e.key==="Escape") { setValue(defaultText); setIsEditing(false); } }}
        style={{ fontFamily:"var(--font-heading)", fontSize:15, fontWeight:700, color:"#0F172A", border:"none", borderBottom:"2px solid #8B5CF6", background:"transparent", outline:"none", padding:"0", letterSpacing:"-0.01em", width:"100%", maxWidth:300, ...style }}
      />
    );
  }

  return (
    <span onClick={() => setIsEditing(true)}
      style={{ cursor:"pointer", borderBottom:"1px dashed transparent", transition:"border-color 0.2s", ...style }}
      title="Cliquez pour modifier"
      onMouseEnter={e => e.currentTarget.style.borderBottomColor="#94A3B8"}
      onMouseLeave={e => e.currentTarget.style.borderBottomColor="transparent"}
    >{value}</span>
  );
}

export default function ChartCard({ title, subtitle, children, className="", action, accent="#3B82F6", badge, badgeType="pos", titleKey, height }) {
  const hex2rgba = (hex, a) => {
    if (!hex || hex.length < 7) return `rgba(59,130,246,${a})`;
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    return `rgba(${r},${g},${b},${a})`;
  };
  const badgeStyles = {
    pos:     { bg:"rgba(16,185,129,0.10)",  color:"#059669", bd:"1.5px solid rgba(16,185,129,0.25)" },
    neg:     { bg:"rgba(239,68,68,0.10)",   color:"#DC2626", bd:"1.5px solid rgba(239,68,68,0.25)" },
    neutral: { bg:hex2rgba(accent,0.10),    color:accent,    bd:`1.5px solid ${hex2rgba(accent,0.25)}` },
  };
  const bStyle = badgeStyles[badgeType] || badgeStyles.neutral;

  return (
    <div className={`animate-fade-up ${className}`} style={{ display:"flex", flexDirection:"column", gap:"10px", height: height }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", paddingLeft:"4px", flexWrap:"wrap", gap:"6px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"9px" }}>
          <div style={{ width:"10px", height:"10px", borderRadius:"50%", background:accent, flexShrink:0, boxShadow:`0 0 0 3px ${hex2rgba(accent,0.18)}, 0 0 12px ${hex2rgba(accent,0.45)}` }}/>
          {titleKey
            ? <EditableSpan textKey={titleKey} defaultText={title} style={{ fontSize:"15px", fontWeight:"800", color:"#0F172A", letterSpacing:"-0.02em", fontFamily: "var(--font-heading)" }} />
            : <span style={{ fontSize:"15px", fontWeight:"800", color:"#0F172A", letterSpacing:"-0.02em", fontFamily: "var(--font-heading)" }}>{title}</span>
          }
          {subtitle && <span style={{ fontSize:"13px", fontWeight:"500", color:"#94A3B8" }}>· {subtitle}</span>}
        </div>
        {(badge || action) && (
          <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
            {action && <div>{action}</div>}
            {badge && <span style={{ fontSize:"10px", fontWeight:"700", padding:"3px 10px", borderRadius:"999px", background:bStyle.bg, color:bStyle.color, border:bStyle.bd }}>{badge}</span>}
          </div>
        )}
      </div>

      {/* Card body */}
        <div
          style={{
          background: "linear-gradient(160deg, #FFFFFF 0%, #F4F8FF 100%)",
          borderRadius: "20px",
          overflow: "hidden",
          border: "1px solid rgba(208,226,255,0.85)",
          boxShadow: "0 1px 2px rgba(0,0,0,0.03), 0 6px 24px rgba(59,130,246,0.07), inset 0 1px 0 #FFFFFF",
          transition: "box-shadow 0.3s ease, transform 0.3s ease, border-color 0.3s ease",
            padding: "6px 8px 8px",
          }}
        onMouseEnter={e => {
          e.currentTarget.style.boxShadow = `0 14px 44px ${hex2rgba(accent,0.13)}, 0 4px 12px rgba(0,0,0,0.05), inset 0 1px 0 #FFFFFF`;
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.borderColor = hex2rgba(accent, 0.32);
        }}
        onMouseLeave={e => {
          e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.03), 0 6px 24px rgba(59,130,246,0.07), inset 0 1px 0 #FFFFFF";
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.borderColor = "rgba(208,226,255,0.85)";
        }}
      >
        {children}
      </div>
    </div>
  );
}
