$f = "MapNationalites.jsx"
$c = Get-Content $f -Raw

# ── 1. Revert SIDEBAR to original dark theme ─────────────────────────────────
$c = $c -replace [regex]::Escape('background:"linear-gradient(180deg,#FFFFFF,#F0F7FF)"'), 'background:"linear-gradient(180deg,rgba(15,12,41,.97),rgba(26,26,62,.97))"'
$c = $c -replace [regex]::Escape('background:"linear-gradient(135deg,rgba(99,102,241,.08),rgba(99,102,241,.02))"'), 'background:"linear-gradient(135deg,rgba(99,102,241,.12),rgba(99,102,241,.04))"'
$c = $c -replace [regex]::Escape('color:"#3730a3", letterSpacing:".14em"'), 'color:"#a5b4fc", letterSpacing:".14em"'
$c = $c -replace [regex]::Escape('color:"rgba(30,58,138,.5)", marginTop:3'), 'color:"rgba(255,255,255,.4)", marginTop:3'

# Rank rows bg/border
$c = $c -replace [regex]::Escape('"rgba(99,102,241,.04)"'), '"rgba(255,255,255,.025)"'
$c = $c -replace [regex]::Escape('"rgba(99,102,241,.10)"'), '"rgba(255,255,255,.05)"'

# Rank number circle border
$c = $c -replace [regex]::Escape('"rgba(255,255,255,.7)" : r.color+"88"'), '"rgba(255,255,255,.4)" : r.color+"55"'

# Country name text
$c = $c -replace [regex]::Escape('color: isHov ? "#fff" : "#1e3a8a"'), 'color: isHov ? "#fff" : "rgba(255,255,255,.68)"'

# Progress bar track
$c = $c -replace [regex]::Escape('"rgba(99,102,241,.12)", borderRadius:99'), '"rgba(255,255,255,.06)", borderRadius:99'

# Arrivals sub-text
$c = $c -replace [regex]::Escape('"rgba(30,58,138,.6)" : "rgba(30,58,138,.4)"'), '"rgba(255,255,255,.5)" : "rgba(255,255,255,.27)"'

# Footer border
$c = $c -replace [regex]::Escape('borderTop:"1px solid rgba(99,102,241,.10)"'), 'borderTop:"1px solid rgba(255,255,255,.05)"'
$c = $c -replace [regex]::Escape('color:"rgba(30,58,138,.4)", letterSpacing'), 'color:"rgba(255,255,255,.22)", letterSpacing'

# Scrollbar
$c = $c -replace [regex]::Escape('::-webkit-scrollbar-track { background: rgba(99,102,241,.04); }'), '::-webkit-scrollbar-track { background: rgba(255,255,255,.03); }'
$c = $c -replace [regex]::Escape('::-webkit-scrollbar-thumb { background:rgba(99,102,241,.25); border-radius:9px; }'), '::-webkit-scrollbar-thumb { background:rgba(255,255,255,.15); border-radius:9px; }'
$c = $c -replace [regex]::Escape('::-webkit-scrollbar-thumb:hover { background:rgba(99,102,241,.40); }'), '::-webkit-scrollbar-thumb:hover { background:rgba(255,255,255,.28); }'

# ── 2. Replace initial center/zoom defaults with Europe-fit defaults ──────────
# The auto-zoom useEffect will override these, but set sensible defaults
$c = $c -replace [regex]::Escape('const [zoom,   setZoom]   = useState(1);'), 'const [zoom,   setZoom]   = useState(1.2);'
$c = $c -replace [regex]::Escape('const [center, setCenter] = useState([9, 48]);   // 9°E 48°N ≈ centre of western Europe'), 'const [center, setCenter] = useState([9, 48]);'

# ── 3. Inject auto-zoom useEffect after the geoData useEffect ────────────────
# Find the closing of the geoData useEffect and insert the new one after it
$autoZoom = @'

  // Auto-zoom to fit the selected countries whenever data changes
  const prevNatKey = React.useRef('');
  useEffect(() => {
    const key = natData.map(r => r.nom_nat).join(',');
    if (key === prevNatKey.current) return;
    prevNatKey.current = key;

    const coords = ranked
      .filter(r => r.iso && ISO_TO_COORDS[r.iso])
      .map(r => ISO_TO_COORDS[r.iso]);
    if (coords.length === 0) { setCenter([9, 48]); setZoom(1); return; }

    const lngs = coords.map(c => c[0]);
    const lats = coords.map(c => c[1]);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);

    const cLng = (minLng + maxLng) / 2;
    const cLat = (minLat + maxLat) / 2;
    const spread = Math.max(maxLng - minLng, (maxLat - minLat) * 1.6);
    // spread of ~80 deg → zoom 1; tighter = more zoom, cap at 4
    const newZoom = Math.min(4, Math.max(0.8, 80 / Math.max(spread, 1)));

    setCenter([cLng, cLat]);
    setZoom(newZoom);
  }, [natData]);
'@

# Insert after "return () => { cancelled = true; };\n  }, []);"
$target = "return () => { cancelled = true; };`r`n    }, []);"
$replacement = "return () => { cancelled = true; };`r`n    }, []);" + $autoZoom
$c = $c.Replace($target, $replacement)

Set-Content $f $c -NoNewline
Write-Host "Done"
