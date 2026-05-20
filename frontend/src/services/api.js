import axios from "axios";

const API = axios.create({ baseURL: import.meta.env.VITE_API_URL || "/api" });

API.interceptors.request.use(config => {
  const token = localStorage.getItem("bi_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Token expiré ou invalide
      localStorage.removeItem("bi_token");
      localStorage.removeItem("bi_user");
      window.location.href = "/"; // Force le rechargement vers la page de login
    }
    return Promise.reject(error);
  }
);

// ── Chiffre d'Affaires ────────────────────────────────────────────────────────
export const getCAMensuel    = (annee, hotel_id=1) => API.get("/ca/mensuel",       {params:{annee,hotel_id}});
export const getCACompar     = (annee, hotel_id=1) => API.get("/ca/comparaison",   {params:{annee,hotel_id}});
export const getCACateg      = (annee, hotel_id=1) => API.get("/ca/categories",    {params:{annee,hotel_id}});
export const getCACumul      = (annee, hotel_id=1) => API.get("/ca/cumul",         {params:{annee,hotel_id}});
export const getCAannuel     = (hotel_id=1)        => API.get("/ca/annuel",        {params:{hotel_id}});
export const getCAKpi        = (annee, hotel_id=1) => API.get("/ca/kpi",           {params:{annee,hotel_id}});
export const getCATrim       = (annee, hotel_id=1) => API.get("/ca/trimestriel",   {params:{annee,hotel_id}});
export const getCASaisonnier = (annee, hotel_id=1) => API.get("/ca/saisonnier",    {params:{annee,hotel_id}});
export const getCAYtd        = (annee, hotel_id=1, mois=new Date().getMonth()+1) => API.get("/ca/ytd",           {params:{annee,hotel_id,mois}});

// ── Statistiques ──────────────────────────────────────────────────────────────
export const getStatsMensuel = (annee, hotel_id=1) => API.get("/stats/mensuel",      {params:{annee,hotel_id}});
export const getStatsKpi     = (annee, hotel_id=1) => API.get("/stats/kpi",          {params:{annee,hotel_id}});
export const getStatsCompar  = (annee, hotel_id=1) => API.get("/stats/comparaison",  {params:{annee,hotel_id}});
export const getArrivees     = (annee, hotel_id=1) => API.get("/stats/arrivees",     {params:{annee,hotel_id}});
export const getNationalites = (annee, hotel_id=1) => API.get("/stats/nationalites", {params:{annee,hotel_id}});
export const getAgences      = (annee, hotel_id=1) => API.get("/stats/agences",      {params:{annee,hotel_id}});
export const getStatsYtd     = (annee, hotel_id=1) => API.get("/stats/ytd",          {params:{annee,hotel_id}});

// ── Charges ───────────────────────────────────────────────────────────────────
export const getChargesAnnuel  = (hotel_id=1)        => API.get("/charges/annuel",      {params:{hotel_id}});
export const getChargesCompar  = (annee, hotel_id=1) => API.get("/charges/comparaison", {params:{annee,hotel_id}});
export const getChargesKpi     = (annee, hotel_id=1) => API.get("/charges/kpi",         {params:{annee,hotel_id}});
export const getChargesMensuel = (annee, hotel_id=1) => API.get("/charges/mensuel",     {params:{annee,hotel_id}});

// ── Résultat ──────────────────────────────────────────────────────────────────
export const getResultatAnnuel = (annee, hotel_id=1) => API.get("/resultat/annuel", {params:{hotel_id, ...(annee ? {annee} : {})}});
export const getResultatMensuel = (annee, mois, hotel_id=1) => API.get("/resultat/mensuel", {params:{annee, mois, hotel_id}});

// ── Utilitaires ───────────────────────────────────────────────────────────────
export const getHotels = ()              => API.get("/hotels");
export const getAnnees = (hotel_id=1)   => API.get("/annees", {params:{hotel_id}});

export default API;
