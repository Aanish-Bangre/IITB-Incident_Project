// frontend/lib/exportExcel.ts

import * as XLSX from "xlsx";
import type { Plate } from "@/components/PlatesTable"; // reuse the shared type

export function exportResultsToExcel(
  plates: Plate[],
  jobId: string,
  jobStatus: string
) {
  const rows = plates.map((plate, index) => ({
    "#":              index + 1,
    "Track ID":       plate.track_id ?? "N/A",        // ← matches table col 1
    "Plate Text":     plate.plate_text,               // ← col 4
    "Vehicle Type":   plate.vehicle_type ?? "N/A",    // ← col 5
    "Detected At":    plate.detected_at ?? "N/A",     // ← col 6
    // Extra data (not in table but useful in Excel)
    "OCR Confidence (%)": plate.confidence != null
      ? (plate.confidence * 100).toFixed(2) : "N/A",
    "BBox Confidence (%)": plate.bbox_confidence != null
      ? (plate.bbox_confidence * 100).toFixed(2) : "N/A",
    "Vehicle Confidence (%)": plate.vehicle_confidence != null
      ? (plate.vehicle_confidence * 100).toFixed(2) : "N/A",
    "Frame Number":   plate.frame_number ?? "N/A",
    "Plate Image Path":   plate.image_path ?? "",
    "Vehicle Image Path": plate.vehicle_image_path ?? "",
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 5 },   // #
    { wch: 10 },  // Track ID
    { wch: 18 },  // Plate Text
    { wch: 14 },  // Vehicle Type
    { wch: 22 },  // Detected At
    { wch: 20 },  // OCR Confidence
    { wch: 22 },  // BBox Confidence
    { wch: 24 },  // Vehicle Confidence
    { wch: 14 },  // Frame Number
    { wch: 40 },  // Plate Image Path
    { wch: 40 },  // Vehicle Image Path
  ];

  const metaRows = [
    { Key: "Job ID",       Value: jobId },
    { Key: "Status",       Value: jobStatus },
    { Key: "Export Time",  Value: new Date().toLocaleString() },
    { Key: "Total Plates", Value: plates.length },
  ];
  const metaWs = XLSX.utils.json_to_sheet(metaRows);
  metaWs["!cols"] = [{ wch: 16 }, { wch: 40 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Detected Plates");
  XLSX.utils.book_append_sheet(wb, metaWs, "Job Info");

  const filename = `ANPR_Results_${jobId.substring(0, 8)}_${new Date()
    .toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}