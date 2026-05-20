import { useState, useEffect } from "react";
import axios from "axios";
import { IconUsers, IconCheckCircle } from "../components/KpiIcons";

const API = axios.create({ baseURL: "/api" });
API.interceptors.request.use(cfg => {
  const t = localStorage.getItem("bi_token");
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

const HOTELS = [
  { id: 1, name: "Royal Azur Thalassa", color: "#B8860B" },
  { id: 2, name: "Bel Azur", color: "#003366" },
  { id: 3, name: "Sol Azur", color: "#D2691E" },
];

const DASHBOARDS = [
  { id: "ca", label: "Chiffre d'Affaires", color: "#4B0082" },
  { id: "stats", label: "Statistiques", color: "#006400" },
  { id: "charges", label: "Charges", color: "#8B0000" },
  { id: "resultat", label: "Résultat", color: "#008080" },
];

const ROLE_SUGGESTIONS = ["admin", "viewer", "manager", "directeur", "contrôleur"];

// Composants de base
const Input = ({ label, type = "text", value, onChange, placeholder, error, hint }) => (
  <div style={{ marginBottom: "1rem" }}>
    {label && <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", fontWeight: "600", color: "#333" }}>{label}</label>}
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={{
        width: "100%",
        padding: "0.75rem",
        border: `1px solid ${error ? "#ef4444" : "#cbd5e1"}`,
        borderRadius: "6px",
        fontSize: "0.875rem",
        boxSizing: "border-box",
        outline: "none",
        fontFamily: "inherit"
      }}
    />
    {hint && <span style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem", display: "block" }}>{hint}</span>}
    {error && <span style={{ fontSize: "0.75rem", color: "#ef4444", marginTop: "0.25rem", display: "block" }}>{error}</span>}
  </div>
);

function ModalShell({ title, onClose, children, footer }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      backgroundColor: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem"
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        backgroundColor: "#fff",
        borderRadius: "12px",
        width: "100%", maxWidth: "800px",
        maxHeight: "90vh", display: "flex", flexDirection: "column",
        boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
      }}>
        <div style={{ padding: "1.5rem 2rem", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: "700", color: "#0f172a" }}>{title}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer", color: "#64748b", lineHeight: 1 }}>&times;</button>
        </div>
        <div style={{ padding: "2rem", overflowY: "auto", flexGrow: 1 }}>
          {children}
        </div>
        <div style={{ padding: "1.25rem 2rem", borderTop: "1px solid #e2e8f0", backgroundColor: "#f8fafc", borderBottomLeftRadius: "12px", borderBottomRightRadius: "12px" }}>
          {footer}
        </div>
      </div>
    </div>
  );
}

function UserForm({ form, setForm, errors }) {
  const toggle = (field, id) => setForm(f => ({ ...f, [field]: f[field].includes(id) ? f[field].filter(x => x !== id) : [...f[field], id] }));

  useEffect(() => {
    if (form.role.trim().toLowerCase() === "admin") {
      setForm(f => ({ ...f, hotels: HOTELS.map(h => h.id), dashboards: DASHBOARDS.map(d => d.id) }));
    }
  }, [form.role]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2.5rem" }}>
      <div>
        <h3 style={{ fontSize: "1.05rem", fontWeight: "700", marginBottom: "1.25rem", color: "#1e293b", borderBottom: "2px solid #f1f5f9", paddingBottom: "0.5rem" }}>Informations Générales</h3>
        {form.isNew && <Input label="Identifiant *" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} error={errors.username} />}
        {!form.isNew && <Input label="Identifiant" value={form.username} onChange={() => {}} placeholder="Non modifiable" />}
        <Input label="Nom complet *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} error={errors.name} />
        <Input label="Adresse e-mail" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} error={errors.email} hint="Optionnel pour notifications." />
        
        {form.isNew ? (
          <Input label="Mot de passe *" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} error={errors.password} />
        ) : (
          <Input label="Nouveau mot de passe" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} hint="Laisser vide pour ne pas changer" />
        )}
        
        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", fontWeight: "600", color: "#333" }}>Rôle *</label>
          <select 
            value={form.role} 
            onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
            style={{ width: "100%", padding: "0.75rem", border: `1px solid ${errors.role ? "#ef4444" : "#cbd5e1"}`, borderRadius: "6px", fontSize: "0.875rem", backgroundColor: "#fff", fontFamily: "inherit", outline: "none" }}
          >
            <option value="">Sélectionner un rôle...</option>
            {ROLE_SUGGESTIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          {errors.role && <span style={{ fontSize: "0.75rem", color: "#ef4444", marginTop: "0.25rem", display: "block" }}>{errors.role}</span>}
        </div>
      </div>
      
      <div>
         <h3 style={{ fontSize: "1.05rem", fontWeight: "700", marginBottom: "1.25rem", color: "#1e293b", borderBottom: "2px solid #f1f5f9", paddingBottom: "0.5rem" }}>Autorisations d'accès</h3>
        
        <div style={{ marginBottom: "1.75rem" }}>
          <label style={{ display: "block", marginBottom: "0.75rem", fontSize: "0.875rem", fontWeight: "600", color: "#333" }}>Hôtels accessibles *</label>
          <div style={{ border: `1px solid ${errors.hotels ? "#ef4444" : "#e2e8f0"}`, borderRadius: "8px", padding: "0.75rem", backgroundColor: "#f8fafc" }}>
            {HOTELS.map(h => (
              <label key={h.id} style={{ display: "flex", alignItems: "center", marginBottom: "0.5rem", cursor: "pointer", padding: "0.25rem 0" }}>
                <input type="checkbox" checked={form.hotels.includes(h.id)} onChange={() => toggle("hotels", h.id)} style={{ marginRight: "0.75rem", width: "16px", height: "16px", accentColor: "#0f172a" }} />
                <span style={{ fontSize: "0.9rem", color: "#334155", fontWeight: "500" }}>{h.name}</span>
              </label>
            ))}
          </div>
          {errors.hotels && <span style={{ fontSize: "0.75rem", color: "#ef4444", marginTop: "0.25rem", display: "block" }}>{errors.hotels}</span>}
        </div>

        <div>
          <label style={{ display: "block", marginBottom: "0.75rem", fontSize: "0.875rem", fontWeight: "600", color: "#333" }}>Tableaux de bord accessibles *</label>
          <div style={{ border: `1px solid ${errors.dashboards ? "#ef4444" : "#e2e8f0"}`, borderRadius: "8px", padding: "0.75rem", backgroundColor: "#f8fafc" }}>
             {DASHBOARDS.map(d => (
              <label key={d.id} style={{ display: "flex", alignItems: "center", marginBottom: "0.5rem", cursor: "pointer", padding: "0.25rem 0" }}>
                <input type="checkbox" checked={form.dashboards.includes(d.id)} onChange={() => toggle("dashboards", d.id)} style={{ marginRight: "0.75rem", width: "16px", height: "16px", accentColor: "#0f172a" }} />
                <span style={{ fontSize: "0.9rem", color: "#334155", fontWeight: "500" }}>{d.label}</span>
              </label>
            ))}
          </div>
          {errors.dashboards && <span style={{ fontSize: "0.75rem", color: "#ef4444", marginTop: "0.25rem", display: "block" }}>{errors.dashboards}</span>}
        </div>
      </div>
    </div>
  );
}

function CreateUserModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ isNew: true, username: "", password: "", name: "", email: "", role: "", hotels: [], dashboards: [] });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const e = {};
    if (!form.username.trim()) e.username = "Requis";
    if (!form.password || form.password.length < 4) e.password = "Min. 4 caractères";
    if (!form.name.trim()) e.name = "Requis";
    if (!form.role.trim()) e.role = "Requis";
    if (form.hotels.length === 0) e.hotels = "Sélectionnez au moins un hôtel";
    if (form.dashboards.length === 0) e.dashboards = "Sélectionnez au moins un dashboard";
    setErrors(e); return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await API.post("/auth/users", { ...form, username: form.username.trim(), name: form.name.trim() });
      onCreated();
      onClose();
    } catch (err) {
      alert(err.response?.data?.error || "Erreur lors de la création");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell title="Ajouter un utilisateur" onClose={onClose}
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem" }}>
          <button onClick={onClose} style={{ padding: "0.6rem 1.25rem", border: "1px solid #cbd5e1", backgroundColor: "#fff", borderRadius: "6px", cursor: "pointer", fontWeight: "600", color: "#475569" }}>Annuler</button>
          <button onClick={handleSubmit} disabled={loading} style={{ padding: "0.6rem 1.5rem", border: "none", backgroundColor: "#0f172a", color: "#fff", borderRadius: "6px", cursor: "pointer", fontWeight: "600", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            {loading ? "Enregistrement..." : "Créer l'utilisateur"}
          </button>
        </div>
      }
    >
      <UserForm form={form} setForm={setForm} errors={errors} />
    </ModalShell>
  );
}

function EditUserModal({ user, onClose, onUpdated }) {
  const safeJson = val => { try { const p = typeof val === "string" ? JSON.parse(val) : val; return Array.isArray(p) ? p : []; } catch { return []; } };
  const [form, setForm] = useState({ isNew: false, username: user.username, name: user.name, email: user.email || "", password: "", role: user.role, hotels: safeJson(user.allowed_hotels), dashboards: safeJson(user.allowed_dashboards) });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Requis";
    if (!form.role.trim()) e.role = "Requis";
    if (form.hotels.length === 0) e.hotels = "Sélectionnez au moins un hôtel";
    if (form.dashboards.length === 0) e.dashboards = "Sélectionnez au moins un dashboard";
    setErrors(e); return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const payload = { name: form.name.trim(), email: form.email.trim() || null, role: form.role.trim(), hotels: form.hotels, dashboards: form.dashboards };
      if (form.password) payload.password = form.password;
      await API.put(`/auth/users/${user.id}`, payload);
      onUpdated();
      onClose();
    } catch (err) {
      alert(err.response?.data?.error || "Erreur lors de la modification");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell title={`Modifier le profil : ${user.name}`} onClose={onClose}
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem" }}>
          <button onClick={onClose} style={{ padding: "0.6rem 1.25rem", border: "1px solid #cbd5e1", backgroundColor: "#fff", borderRadius: "6px", cursor: "pointer", fontWeight: "600", color: "#475569" }}>Annuler</button>
          <button onClick={handleSubmit} disabled={loading} style={{ padding: "0.6rem 1.5rem", border: "none", backgroundColor: "#0f172a", color: "#fff", borderRadius: "6px", cursor: "pointer", fontWeight: "600", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            {loading ? "Enregistrement..." : "Enregistrer les modifications"}
          </button>
        </div>
      }
    >
      <UserForm form={form} setForm={setForm} errors={errors} />
    </ModalShell>
  );
}

export default function UserManagement({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [search, setSearch] = useState("");

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await API.get("/auth/users");
      setUsers(res.data.users || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleDelete = async (id) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer définitivement cet utilisateur ?")) {
      try {
        await API.delete(`/auth/users/${id}`);
        fetchUsers();
      } catch (e) {
        alert("Erreur lors de la suppression.");
      }
    }
  };

  const guestUsers = users.filter(u => u.username !== currentUser?.username);
  const filteredUsers = guestUsers.filter(u => {
    const term = search.toLowerCase();
    return u.username.toLowerCase().includes(term) || u.name.toLowerCase().includes(term) || (u.email && u.email.toLowerCase().includes(term)) || u.role.toLowerCase().includes(term);
  });

  const safeJson = val => { try { const p = typeof val === "string" ? JSON.parse(val) : val; return Array.isArray(p) ? p : []; } catch { return []; } };

  return (
    <div style={{ padding: "2.5rem 3rem", fontFamily: "Inter, system-ui, sans-serif", color: "#0f172a", maxWidth: "1400px", margin: "0 auto", backgroundColor: "#f8fafc", minHeight: "100vh" }}>
      {showCreateModal && <CreateUserModal onClose={() => setShowCreateModal(false)} onCreated={fetchUsers} />}
      {editUser && <EditUserModal user={editUser} onClose={() => setEditUser(null)} onUpdated={fetchUsers} />}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "2.5rem" }}>
        <div>
          <h1 style={{ margin: "0 0 0.5rem 0", fontSize: "2.5rem", fontWeight: "800", color: "#0f172a", letterSpacing: "-0.02em" }}>Gestion des utilisateurs</h1>
          <p style={{ margin: 0, color: "#475569", fontSize: "1.2rem", fontWeight: "500" }}>Gérez les accès, les rôles et les permissions de vos collaborateurs.</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} style={{ padding: "0.85rem 1.75rem", fontSize: "1.1rem", backgroundColor: "#0f172a", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "700", display: "flex", alignItems: "center", gap: "0.5rem", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)", transition: "all 0.2s" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Nouvel utilisateur
        </button>
      </div>

      <div style={{ backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)", overflow: "hidden" }}>
        <div style={{ padding: "1.5rem", borderBottom: "1px solid #e2e8f0", backgroundColor: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ position: "relative", width: "400px" }}>
            <svg style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#64748b" }} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input 
              type="text" 
              placeholder="Rechercher par nom, email, rôle..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ padding: "0.8rem 1.25rem 0.8rem 2.8rem", width: "100%", border: "1px solid #cbd5e1", borderRadius: "8px", outline: "none", fontSize: "1.1rem", color: "#334155", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ fontSize: "1.05rem", color: "#475569", fontWeight: "600" }}>
            {filteredUsers.length} utilisateur{filteredUsers.length !== 1 ? 's' : ''} trouvé{filteredUsers.length !== 1 ? 's' : ''}
          </div>
        </div>
        
        {loading ? (
          <div style={{ padding: "4rem", textAlign: "center", color: "#64748b", fontSize: "1.1rem", fontWeight: "500" }}>Chargement des données...</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", whiteSpace: "nowrap" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e2e8f0", backgroundColor: "#f8fafc", color: "#475569", fontSize: "0.95rem", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: "800" }}>
                  <th style={{ padding: "1rem 1.5rem" }}>Utilisateur</th>
                  <th style={{ padding: "1rem 1.5rem" }}>Rôle</th>
                  <th style={{ padding: "1rem 1.5rem" }}>Accès Hôtels & Dashboards</th>
                  <th style={{ padding: "1rem 1.5rem", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ padding: "4rem", textAlign: "center", color: "#94a3b8", fontSize: "1.05rem" }}>Aucun utilisateur correspondant à votre recherche.</td>
                  </tr>
                ) : (
                  filteredUsers.map(u => {
                    const allowedHotels = safeJson(u.allowed_hotels);
                    const allowedDash = safeJson(u.allowed_dashboards);
                    return (
                      <tr key={u.id} style={{ borderBottom: "1px solid #f1f5f9", backgroundColor: "#fff", transition: "background-color 0.15s" }} onMouseEnter={e => e.currentTarget.style.backgroundColor = "#f8fafc"} onMouseLeave={e => e.currentTarget.style.backgroundColor = "#fff"}>
                        <td style={{ padding: "1.25rem 1.5rem" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                            <div style={{ width: "40px", height: "40px", borderRadius: "50%", backgroundColor: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", color: "#475569", fontSize: "1.1rem" }}>
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: "700", color: "#0f172a", fontSize: "1.1rem" }}>{u.name}</div>
                              <div style={{ fontSize: "0.95rem", color: "#475569", marginTop: "0.2rem", fontWeight: "500" }}>{u.email || `@${u.username}`}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "1.25rem 1.5rem" }}>
                          <span style={{ padding: "0.4rem 0.8rem", backgroundColor: u.role === 'admin' ? "#fef3c7" : "#e0e7ff", color: u.role === 'admin' ? "#92400e" : "#3730a3", borderRadius: "8px", fontSize: "1rem", fontWeight: "700", textTransform: "capitalize", display: "inline-block" }}>
                            {u.role}
                          </span>
                        </td>
                        <td style={{ padding: "1.25rem 1.5rem", fontSize: "1rem", color: "#334155" }}>
                          <div style={{ marginBottom: "0.6rem", display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                            <span style={{ fontWeight: "700", color: "#1e293b", width: "85px" }}>Hôtels:</span>
                            {allowedHotels.length === 0 ? <span style={{ color: "#94a3b8", fontStyle: "italic" }}>Aucun</span> : allowedHotels.map(hid => {
                              const hotel = HOTELS.find(h => h.id === hid);
                              return hotel ? <span key={hid} style={{ padding: "0.25rem 0.6rem", backgroundColor: "#f1f5f9", borderRadius: "6px", border: "1px solid #e2e8f0", fontWeight: "500" }}>{hotel.name}</span> : null;
                            })}
                          </div>
                          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                            <span style={{ fontWeight: "700", color: "#1e293b", width: "85px" }}>Tableaux:</span>
                            {allowedDash.length === 0 ? <span style={{ color: "#94a3b8", fontStyle: "italic" }}>Aucun</span> : allowedDash.map(did => {
                              const dash = DASHBOARDS.find(d => d.id === did);
                              return dash ? <span key={did} style={{ padding: "0.25rem 0.6rem", backgroundColor: "#f1f5f9", borderRadius: "6px", border: "1px solid #e2e8f0", fontWeight: "500" }}>{dash.label}</span> : null;
                            })}
                          </div>
                        </td>
                        <td style={{ padding: "1.25rem 1.5rem", textAlign: "right" }}>
                          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                            <button onClick={() => setEditUser(u)} style={{ background: "none", border: "1px solid #cbd5e1", backgroundColor: "#fff", color: "#1e293b", cursor: "pointer", padding: "0.5rem 1rem", borderRadius: "6px", fontWeight: "700", fontSize: "1rem", transition: "all 0.15s" }} onMouseEnter={e => e.currentTarget.style.backgroundColor = "#f8fafc"} onMouseLeave={e => e.currentTarget.style.backgroundColor = "#fff"}>Éditer</button>
                            <button onClick={() => handleDelete(u.id)} style={{ background: "none", border: "1px solid #fca5a5", backgroundColor: "#fef2f2", color: "#dc2626", cursor: "pointer", padding: "0.5rem 1rem", borderRadius: "6px", fontWeight: "700", fontSize: "1rem", transition: "all 0.15s" }} onMouseEnter={e => e.currentTarget.style.backgroundColor = "#fee2e2"} onMouseLeave={e => e.currentTarget.style.backgroundColor = "#fef2f2"}>Supprimer</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
