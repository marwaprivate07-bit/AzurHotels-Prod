/**
 * Section — Clean section header with gradient accent bar (reference design)
 */
export default function Section({ title, subtitle }) {
  return (
    <div
      style={{display:"flex",alignItems:"flex-start",gap:"16px",marginBottom:"22px",marginTop:"36px"}}
      className="first:mt-0"
    >
      {/* Gradient accent bar */}
      <div style={{
        width:"4px",minHeight:"48px",borderRadius:"8px",flexShrink:0,marginTop:"2px",
        background:"linear-gradient(180deg,#3B82F6 0%,#6366F1 50%,#0EA5E9 100%)",
        boxShadow:"2px 0 12px rgba(59,130,246,0.25)",
      }}/>

      <div>
        <h2 style={{
          fontSize:"20px",fontWeight:"800",marginBottom:"4px",
          letterSpacing:"-0.03em",lineHeight:1.15,
          color:"#0F172A",
        }}>
          {title}
        </h2>
        {subtitle && (
          <p style={{fontSize:"12px",color:"#94A3B8",fontWeight:"500",lineHeight:1.5}}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
