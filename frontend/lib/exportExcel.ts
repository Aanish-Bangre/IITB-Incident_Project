// frontend/lib/exportExcel.ts

import * as XLSX from "xlsx";
import type { Plate } from "@/components/PlatesTable"; // reuse the shared type

export function exportResultsToExcel(
  plates: Plate[],
  jobId: string,
  jobStatus: string
) {
  const rows = plates.map((plate) => ({
    "Track ID": plate.track_id ?? "N/A",
    "Vehicle Crop Path": plate.vehicle_image_path ?? "N/A",
    "Plate Crop Path": plate.image_path ?? "N/A",
    "Plate Text": plate.plate_text,
    "Vehicle Type": plate.vehicle_type ?? "N/A",
    "Speed (km/h)": plate.speed_kmh ?? "N/A",
    "Detected At": plate.detected_at ?? "N/A",
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 12 },  // Track ID
    { wch: 45 },  // Vehicle Crop Path
    { wch: 45 },  // Plate Crop Path
    { wch: 18 },  // Plate Text
    { wch: 16 },  // Vehicle Type
    { wch: 14 },  // Speed (km/h)
    { wch: 22 },  // Detected At
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