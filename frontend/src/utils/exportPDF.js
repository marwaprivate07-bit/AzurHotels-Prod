/**
 * exportPDF.js — Azur Hotels BI
 * Usage: import { exportPageToPDF } from "../utils/exportPDF";
 *        exportPageToPDF("ca", 2024);
 *
 * Requires: npm install html2canvas jspdf
 */

import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const HEADER_H = 40; // px height of the PDF header bar
const FOOTER_H = 28;
const PAGE_W   = 297; // A4 landscape mm
const PAGE_H   = 210;
const MARGIN   = 10;  // mm

const PAGE_LABELS = {
  ca:      "Chiffre d'Affaires — Revenus & Performance",
  stats:   "Statistiques Hôtelières — Indicateurs Opérationnels",
  charges: "Charges — Structure des Coûts",
  resultat:"Résultat Net — Performance Financière",
};

/**
 * Main export function.
 * @param {string} pageKey  — "ca" | "stats" | "charges" | "resultat"
 * @param {number} annee    — e.g. 2024
 * @param {string} containerId — id of the scrollable content div (default "main-content")
 */
export async function exportPageToPDF(pageKey = "ca", annee = 2024, containerId = "main-content") {

  // ── 1. Find the target element ──────────────────────────────────────────
  const el = document.getElementById(containerId) || document.querySelector("main") || document.body;

  // Show a loading toast if you have one, or just a cursor
  document.body.style.cursor = "wait";

  try {
    // ── 2. Capture with html2canvas ────────────────────────────────────────
    // Scale=2 for retina quality; useCORS for any external images
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#f3f4f6", // match the app bg
      logging: false,
      // Make sure full scroll height is captured
      windowWidth: el.scrollWidth,
      windowHeight: el.scrollHeight,
      scrollX: 0,
      scrollY: 0,
      x: 0,
      y: 0,
      width: el.scrollWidth,
      height: el.scrollHeight,
    });

    const imgData  = canvas.toDataURL("image/jpeg", 0.92);
    const imgW_px  = canvas.width;
    const imgH_px  = canvas.height;

    // ── 3. Create PDF (A4 landscape) ───────────────────────────────────────
    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    const usableW  = PAGE_W - MARGIN * 2;           // mm available for content
    const usableH  = PAGE_H - MARGIN * 2 - HEADER_H / 3 - FOOTER_H / 3;

    // Scale image to fit usable width
    const ratio    = imgW_px / imgH_px;
    const imgW_mm  = usableW;
    const imgH_mm  = imgW_mm / ratio;

    // How many mm of image fit on one page
    const pageContentH = usableH;
    const totalPages   = Math.ceil(imgH_mm / pageContentH);

    const dateStr = new Date().toLocaleDateString("fr-TN", {
      day: "2-digit", month: "2-digit", year: "numeric",
    });
    const pageLabel = PAGE_LABELS[pageKey] || "Dashboard";

    for (let page = 0; page < totalPages; page++) {
      if (page > 0) pdf.addPage();

      // ── Header bar ──────────────────────────────────────────────────────
      pdf.setFillColor(30, 58, 95);          // #1E3A5F
      pdf.rect(0, 0, PAGE_W, 12, "F");

      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");
      pdf.text("Azur Hotels BI — Dashboard", MARGIN, 8);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      const rightText = `Exercice ${annee} — Exporté le ${dateStr}`;
      const rightX = PAGE_W - MARGIN - pdf.getTextWidth(rightText);
      pdf.text(rightText, rightX, 8);

      // ── Clip and draw the slice of the image for this page ──────────────
      const srcY_mm = page * pageContentH;   // mm offset into the full image
      // Convert back to pixels for clipping
      const srcY_px = (srcY_mm / imgH_mm) * imgH_px;
      const srcH_px = Math.min(
        (pageContentH / imgH_mm) * imgH_px,
        imgH_px - srcY_px
      );

      if (srcH_px <= 0) break;

      // Create a slice canvas
      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width  = imgW_px;
      sliceCanvas.height = Math.ceil(srcH_px);
      const ctx = sliceCanvas.getContext("2d");
      ctx.drawImage(canvas, 0, -srcY_px);

      const sliceData   = sliceCanvas.toDataURL("image/jpeg", 0.92);
      const sliceH_mm   = (srcH_px / imgH_px) * imgH_mm;
      const contentTopY = 14;  // just below header

      pdf.addImage(sliceData, "JPEG", MARGIN, contentTopY, imgW_mm, sliceH_mm);

      // ── Footer ──────────────────────────────────────────────────────────
      pdf.setDrawColor(200, 200, 200);
      pdf.line(MARGIN, PAGE_H - 8, PAGE_W - MARGIN, PAGE_H - 8);

      pdf.setTextColor(150, 150, 150);
      pdf.setFontSize(7);
      pdf.setFont("helvetica", "normal");
      pdf.text("STE BEL AZUR — Usage interne uniquement", MARGIN, PAGE_H - 4);

      const pageNumText = `Page ${page + 1} / ${totalPages}`;
      const pnX = PAGE_W - MARGIN - pdf.getTextWidth(pageNumText);
      pdf.text(pageNumText, pnX, PAGE_H - 4);
    }

    // ── 4. Save ────────────────────────────────────────────────────────────
    const filename = `AzurHotels_BI_${pageKey.toUpperCase()}_${annee}.pdf`;
    pdf.save(filename);

  } finally {
    document.body.style.cursor = "";
  }
}
