// Global context — hotel selector + year shared across all pages
import { createContext, useContext, useState, useEffect, useRef } from "react";

export const DASHBOARDS_ALL = [
  { id: 'stats',    route: '/stats',    label: 'Statistiques' },
  { id: 'ca',       route: '/ca',       label: "Chiffre d'Affaires" },
  { id: 'charges',  route: '/charges',  label: 'Charges' },
  { id: 'resultats',route: '/resultat', label: 'Résultat' },
];
import { getHotels } from "../services/api";

const Ctx = createContext({ hotels:[], hotelId:1, setHotelId:()=>{}, annee:2024, setAnnee:()=>{}, mois:0, setMois:()=>{}, hotel:null, printRef:{ current:null }, editMode:false, setEditMode:()=>{}, customTexts:{}, setCustomTexts:()=>{}, user:null, hotelsVisibles:[], isAdmin:false, dashboardsVisibles:[] });
export const useDashboard = () => useContext(Ctx);

export default function DashboardProvider({ children }) {
  const [hotels,   setHotels]   = useState([]);
  const [hotelId,  setHotelId]  = useState(1);
  const [annee,    setAnnee]    = useState(2024);
  const [mois,     setMois]     = useState(0); // 0 = Année entière
  const [editMode, setEditMode] = useState(false);
  const [customTexts, setCustomTexts] = useState({});
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('bi_user') || 'null'); } catch { return null; }
  });
  const printRef = useRef(null);

  const isAdmin = user?.role === "admin";
  const dashboards = DASHBOARDS_ALL;
  const parsedAllowed = (() => {
    if (!user?.allowed_dashboards) return null;
    if (Array.isArray(user.allowed_dashboards)) return user.allowed_dashboards;
    try { return JSON.parse(user.allowed_dashboards); } catch { return null; }
  })();
  const dashboardsVisibles = isAdmin ? dashboards : (parsedAllowed ? dashboards.filter(d => parsedAllowed.includes(d.id)) : dashboards);

  useEffect(() => {
    getHotels()
      .then(r => setHotels(r.data.data || []))
      .catch(() => setHotels([
        { hotel_id: 1, nom_hotel: "Royal Azur Thalassa", categorie: "5*" },
        { hotel_id: 2, nom_hotel: "Bel Azur",            categorie: "4*" },
      ]));
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("bi_custom_texts");
    if (saved) {
      try {
        setCustomTexts(JSON.parse(saved));
      } catch (e) {
        console.warn("Failed to parse custom texts:", e);
      }
    }
  }, []);

  const hotel = hotels.find(h => h.hotel_id === hotelId) || null;

  return (
    <Ctx.Provider value={{ hotels, hotelId, setHotelId, annee, setAnnee, mois, setMois, hotel, printRef, editMode, setEditMode, customTexts, setCustomTexts, user, setUser, hotelsVisibles: hotels, isAdmin, dashboardsVisibles }}>
      {children}
    </Ctx.Provider>
  );
}
