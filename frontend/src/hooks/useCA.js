import { useState, useEffect } from "react";
import {
  getCAMensuel, getCACompar, getCACateg,
  getCAKpi, getCATrim, getCASaisonnier, getCAYtd
} from "../services/api";

/**
 * useCA — fetches all CA data for a given year + hotel.
 * Centralises the data-fetching logic that was duplicated in CA.jsx.
 */
export function useCA(annee, hotelId) {
  const [mensuel, setMensuel] = useState([]);
  const [compar,  setCompar]  = useState([]);
  const [categ,   setCateg]   = useState([]);
  const [kpi,     setKpi]     = useState(null);
  const [trim,    setTrim]    = useState([]);
  const [saison,  setSaison]  = useState([]);
  const [ytd,     setYtd]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      getCAMensuel(annee, hotelId),
      getCACompar(annee, hotelId),
      getCACateg(annee, hotelId),
      getCAKpi(annee, hotelId),
      getCATrim(annee, hotelId),
      getCASaisonnier(annee, hotelId),
      getCAYtd(annee, hotelId),
    ])
      .then(([m, c, catRes, kpRes, trRes, saRes, ytRes]) => {
        setMensuel(m.data.data);
        setCompar(c.data.data);
        setCateg(catRes.data.data);
        setKpi(kpRes.data.data);
        setTrim(trRes.data.data);
        setSaison(saRes.data.data);
        setYtd(ytRes.data.data);
      })
      .catch((e) => {
        setError("Erreur de chargement des données : " + (e?.message || "backend inaccessible"));
      })
      .finally(() => setLoading(false));
  }, [annee, hotelId]);

  return { mensuel, compar, categ, kpi, trim, saison, ytd, loading, error };
}
