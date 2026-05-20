import { useState, useEffect, useRef } from "react";
import axios from "axios";
import azurGroupLogo from "../assets/azurhotelsgroup.png";

const C = {
  primary: "#0f172a", // Slate 900
  secondary: "#1e293b", // Slate 800
  accent: "#2563eb", // Blue 600
  bg: "#f8fafc", // Slate 50
  border: "#cbd5e1", // Slate 300
  error: "#ef4444",
  success: "#10b981",
};

const UserIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const LockIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
const EyeIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const EyeOffIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;
const MailIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>;
const ArrowLeft = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>;
const Spinner = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 1s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>;

function FormInput({ label, type, value, onChange, onKeyDown, placeholder, icon, rightElement, error, disabled }) {
  const [focused, setFocused] = useState(false);
  
  return (
    <div style={{ marginBottom: "24px" }}>
      <label style={{ display: "block", fontSize: "1.05rem", fontWeight: "700", color: C.primary, marginBottom: "10px" }}>
        {label}
      </label>
      <div style={{
        display: "flex", alignItems: "center",
        background: disabled ? "#f1f5f9" : "#fff",
        border: `2px solid ${error ? C.error : focused ? C.accent : C.border}`,
        borderRadius: "10px", transition: "all 0.2s ease",
        boxShadow: focused ? `0 0 0 4px ${error ? "rgba(239, 68, 68, 0.15)" : "rgba(37, 99, 235, 0.15)"}` : "none",
        overflow: "hidden"
      }}>
        <div style={{ paddingLeft: "16px", color: error ? C.error : focused ? C.accent : "#64748b", display: "flex" }}>
          {icon}
        </div>
        <input
          type={type} value={value} onChange={onChange} onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          placeholder={placeholder} disabled={disabled}
          style={{ flex: 1, padding: "16px", background: "transparent", border: "none", outline: "none", color: C.primary, fontSize: "1.1rem", fontWeight: "500", width: "100%" }}
        />
        {rightElement && <div style={{ paddingRight: "16px", display: "flex" }}>{rightElement}</div>}
      </div>
      {error && <p style={{ fontSize: "0.95rem", fontWeight: "600", color: C.error, marginTop: "8px" }}>{error}</p>}
    </div>
  );
}

function ForgotPasswordPanel({ onBack }) {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!username.trim()) { setError("Veuillez entrer votre identifiant."); return; }
    setError(""); setLoading(true);
    try {
      const res = await axios.post("/api/auth/forgot-password", { username: username.trim() });
      if (res.data.success) setSent(true);
      else setError(res.data.error || "Erreur inconnue.");
    } catch (err) {
      setError(err.response?.data?.error || "Impossible de contacter le serveur.");
    } finally { setLoading(false); }
  };

  return (
    <div style={{ padding: "0" }}>
      <button onClick={onBack} style={{
        display: "flex", alignItems: "center", gap: "8px",
        background: "transparent", border: "none", color: "#475569",
        fontSize: "1.05rem", fontWeight: "700", cursor: "pointer", marginBottom: "36px", padding: 0
      }} onMouseEnter={e => e.currentTarget.style.color = C.primary} onMouseLeave={e => e.currentTarget.style.color = "#475569"}>
        <ArrowLeft/> Retour à la connexion
      </button>

      <div style={{ marginBottom: "40px" }}>
        <h2 style={{ fontSize: "2.5rem", fontWeight: "900", color: C.primary, marginBottom: "16px", letterSpacing: "-0.03em" }}>
          Mot de passe oublié
        </h2>
        <p style={{ color: "#334155", fontSize: "1.15rem", lineHeight: "1.6", fontWeight: "500" }}>
          Entrez votre identifiant pour recevoir un nouveau mot de passe par e-mail.
        </p>
      </div>

      {sent ? (
        <div style={{ background: "#ecfdf5", border: "2px solid #34d399", borderRadius: "10px", padding: "24px", display: "flex", gap: "16px" }}>
          <div style={{ color: C.success, marginTop: "2px" }}><MailIcon/></div>
          <div>
            <p style={{ color: "#065f46", fontSize: "1.2rem", fontWeight: "800", marginBottom: "8px" }}>E-mail envoyé</p>
            <p style={{ color: "#047857", fontSize: "1.05rem", lineHeight: "1.6", fontWeight: "500" }}>
              Si un compte correspond, un nouveau mot de passe a été envoyé à l'adresse associée.
            </p>
          </div>
        </div>
      ) : (
        <>
          <FormInput
            label="Identifiant" type="text" value={username}
            onChange={e => { setUsername(e.target.value); setError(""); }}
            onKeyDown={e => e.key === "Enter" && handleSubmit()}
            placeholder="Votre identifiant"
            icon={<UserIcon/>} error={error} disabled={loading}
          />
          <button onClick={handleSubmit} disabled={loading} style={{
            width: "100%", padding: "18px", marginTop: "12px",
            background: loading ? "#94a3b8" : C.primary, color: "#fff",
            border: "none", borderRadius: "10px", fontSize: "1.2rem", fontWeight: "700", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", transition: "background-color 0.2s"
          }}>
            {loading ? <><Spinner/> Envoi...</> : "Réinitialiser le mot de passe"}
          </button>
        </>
      )}
    </div>
  );
}

export default function Login({ onLogin }) {
  const [form, setForm] = useState({ username: "", password: "", rememberMe: false });
  const [showPwd, setShowPwd] = useState(false);
  const [errors, setErrors] = useState({});
  const [globalError, setGErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [locked, setLocked] = useState(false);
  const [lockTimer, setLockTimer] = useState(0);
  const [attemptsLeft, setAL] = useState(null);
  const [success, setSuccess] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    const s = localStorage.getItem("bi_remember");
    if (s) setForm(f => ({ ...f, username: s, rememberMe: true }));
    
    const style = document.createElement("style");
    style.innerHTML = `@keyframes spin { 100% { transform: rotate(360deg); } }`;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  useEffect(() => {
    if (locked && lockTimer > 0) {
      timerRef.current = setInterval(() => setLockTimer(t => {
        if (t <= 1) { clearInterval(timerRef.current); setLocked(false); return 0; }
        return t - 1;
      }), 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [locked]);

  const validate = () => {
    const e = {};
    if (!form.username.trim()) e.username = "Requis";
    if (!form.password) e.password = "Requis";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleSubmit = async () => {
    setGErr("");
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await axios.post("/api/auth/login", {
        username: form.username.trim(), password: form.password, rememberMe: form.rememberMe,
      });
      if (res.data.success) {
        localStorage.setItem("bi_token", res.data.token);
        localStorage.setItem("bi_user", JSON.stringify(res.data.user));
        if (form.rememberMe) localStorage.setItem("bi_remember", form.username.trim());
        else localStorage.removeItem("bi_remember");
        setSuccess(true);
        setTimeout(() => onLogin(res.data.user), 600);
      }
    } catch (err) {
      const d = err.response?.data;
      if (d?.locked) { setLocked(true); setLockTimer((d.remainingMinutes||15)*60); setGErr(d.error); }
      else if (d?.attemptsLeft !== undefined) { setAL(d.attemptsLeft); setGErr(d.error||"Identifiants incorrects"); }
      else setGErr(d?.error||"Erreur de connexion serveur.");
    } finally { setLoading(false); }
  };

  const handleKey = e => {
    if (e.key === "Enter") handleSubmit();
  };
  
  const fmt = s => `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;

  return (
    <div style={{ minHeight: "100vh", display: "flex", fontFamily: "Inter, system-ui, sans-serif", backgroundColor: C.bg }}>
      
      {/* Left side: Image/Branding (hidden on small screens) */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "60px", background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", color: "#fff", position: "relative", overflow: "hidden" }}>
        
        <div style={{ position: "absolute", top: "-10%", right: "-10%", width: "50%", height: "50%", background: "radial-gradient(circle, rgba(56,189,248,0.15) 0%, transparent 70%)", borderRadius: "50%" }}/>
        <div style={{ position: "absolute", bottom: "-10%", left: "-10%", width: "60%", height: "60%", background: "radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)", borderRadius: "50%" }}/>
        
        <div style={{ position: "relative", zIndex: 10 }}>
          <div style={{ background: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: "24px", padding: "24px", marginBottom: "40px", boxShadow: "0 20px 40px rgba(0,0,0,0.3)", minWidth: "160px", maxWidth: "260px", minHeight: "140px" }}>
            <img src={azurGroupLogo} alt="Logo" style={{ width: "100%", height: "100%", maxHeight: "160px", objectFit: "contain" }} />
          </div>
          <h1 style={{ fontSize: "3.5rem", fontWeight: "900", letterSpacing: "-0.03em", marginBottom: "20px", lineHeight: "1.1" }}>
            Intelligence d'Affaires<br/><span style={{ color: "#38bdf8" }}>Azur Hotels Group</span>
          </h1>
          <p style={{ fontSize: "1.35rem", color: "#94a3b8", maxWidth: "500px", lineHeight: "1.6", fontWeight: "500" }}>
            Plateforme centralisée d'analyse financière et de pilotage stratégique pour les établissements du groupe.
          </p>
        </div>
        
        <div style={{ position: "relative", zIndex: 10 }}>
          <p style={{ fontSize: "1rem", color: "#cbd5e1", fontWeight: "700", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Royal Azur • Bel Azur • Sol Azur
          </p>
        </div>
      </div>

      {/* Right side: Login Form */}
      <div style={{ flex: "0 0 600px", display: "flex", alignItems: "center", justifyContent: "center", padding: "60px", backgroundColor: "#fff", boxShadow: "-20px 0 40px rgba(0,0,0,0.05)", zIndex: 20 }}>
        
        <div style={{ width: "100%", maxWidth: "460px" }}>
          
          {showForgot ? (
            <div style={{ background: "#fff" }}>
               <ForgotPasswordPanel onBack={() => setShowForgot(false)} />
            </div>
          ) : (
            <>
              <div style={{ marginBottom: "40px" }}>
                <h2 style={{ fontSize: "3rem", fontWeight: "900", color: C.primary, marginBottom: "16px", letterSpacing: "-0.03em" }}>
                  Bienvenue
                </h2>
                <p style={{ color: "#334155", fontSize: "1.2rem", fontWeight: "500" }}>
                  Connectez-vous pour accéder à vos tableaux de bord.
                </p>
              </div>

              {locked && (
                <div style={{ background: "#fef2f2", border: "2px solid #fca5a5", borderRadius: "10px", padding: "20px", marginBottom: "32px" }}>
                  <p style={{ color: "#991b1b", fontSize: "1.1rem", fontWeight: "700", marginBottom: "6px" }}>Accès temporairement bloqué</p>
                  <p style={{ color: "#dc2626", fontSize: "1rem", fontWeight: "500" }}>Déblocage dans {fmt(lockTimer)}</p>
                </div>
              )}

              {globalError && !locked && (
                <div style={{ background: "#fef2f2", border: "2px solid #fca5a5", borderRadius: "10px", padding: "16px 20px", marginBottom: "32px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <p style={{ color: "#991b1b", fontSize: "1.1rem", fontWeight: "700" }}>{globalError}</p>
                  {attemptsLeft !== null && attemptsLeft > 0 && (
                    <span style={{ background: "#fee2e2", color: "#991b1b", fontSize: "0.9rem", fontWeight: "800", padding: "4px 10px", borderRadius: "99px" }}>
                      {attemptsLeft} essai{attemptsLeft>1?"s":""}
                    </span>
                  )}
                </div>
              )}

              <FormInput label="Identifiant" type="text" value={form.username}
                onChange={e => { setForm({...form,username:e.target.value}); setErrors({}); setGErr(""); }}
                onKeyDown={handleKey} placeholder="j.doe"
                icon={<UserIcon/>} error={errors.username} disabled={loading||locked||success}
              />
              <FormInput label="Mot de passe" type={showPwd?"text":"password"} value={form.password}
                onChange={e => { setForm({...form,password:e.target.value}); setErrors({}); setGErr(""); }}
                onKeyDown={handleKey} placeholder="••••••••"
                icon={<LockIcon/>} error={errors.password} disabled={loading||locked||success}
                rightElement={
                  <button onClick={() => setShowPwd(!showPwd)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", display: "flex", padding: "4px" }}
                    onMouseEnter={e => e.currentTarget.style.color = C.primary}
                    onMouseLeave={e => e.currentTarget.style.color = "#64748b"}
                  >
                    {showPwd ? <EyeOffIcon/> : <EyeIcon/>}
                  </button>
                }
              />

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "40px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                  <input type="checkbox" checked={form.rememberMe} onChange={() => !locked && setForm(f=>({...f,rememberMe:!f.rememberMe}))} disabled={locked} style={{ width: "20px", height: "20px", accentColor: C.primary, cursor: "pointer" }} />
                  <span style={{ fontSize: "1.05rem", color: C.primary, fontWeight: "700" }}>Se souvenir de moi</span>
                </label>
                <button onClick={() => !locked && setShowForgot(true)} disabled={locked} style={{ background: "none", border: "none", cursor: "pointer", color: C.accent, fontSize: "1.05rem", fontWeight: "700", textDecoration: "none" }} onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"} onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}>
                  Mot de passe oublié ?
                </button>
              </div>

              <button onClick={handleSubmit} disabled={loading||locked||success} style={{
                width: "100%", padding: "18px",
                background: success ? C.success : locked ? "#94a3b8" : loading ? "#cbd5e1" : C.primary,
                color: "#fff", border: "none", borderRadius: "10px",
                fontSize: "1.2rem", fontWeight: "800", cursor: locked || loading || success ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
                transition: "background-color 0.2s", boxShadow: "0 6px 16px rgba(0, 0, 0, 0.15)"
              }}>
                {success ? "Connexion réussie !" : loading ? <><Spinner/> Connexion...</> : locked ? `Bloqué (${fmt(lockTimer)})` : "Se connecter"}
              </button>
            </>
          )}
          
          <div style={{ marginTop: "60px", textAlign: "center" }}>
            <p style={{ color: "#64748b", fontSize: "0.9rem", fontWeight: "600" }}>© 2026 STE BEL AZUR — Usage interne uniquement</p>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 1000px) {
          body > div > div > div:first-child { display: none !important; }
          body > div > div > div:last-child { flex: 1 !important; }
        }
      `}</style>
    </div>
  );
}
