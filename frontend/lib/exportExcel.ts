import * as XLSX from "xlsx";

interface Plate {
  plate_text: string;
  confidence: number;
  bbox_confidence: number;
  image_path: string;
  vehicle_type?: string;
  vehicle_confidence?: number;
  vehicle_image_path?: string;
  track_id?: number;
  speed_kmh?: number;
  frame_number?: number;
  detected_at?: string;
}

export function exportResultsToExcel(
  plates: Plate[],
  jobId: string,
  jobStatus: string
) {
  const rows = plates.map((plate, index) => ({
    "#": index + 1,
    "Plate Text": plate.plate_text,
    "Track ID": plate.track_id ?? "N/A",
    "Vehicle Type": plate.vehicle_type ?? "N/A",
    "OCR Confidence (%)": plate.confidence != null
      ? (plate.confidence * 100).toFixed(2)
      : "N/A",
    "BBox Confidence (%)": plate.bbox_confidence != null
      ? (plate.bbox_confidence * 100).toFixed(2)
      : "N/A",
    "Vehicle Confidence (%)": plate.vehicle_confidence != null
      ? (plate.vehicle_confidence * 100).toFixed(2)
      : "N/A",
    "Frame Number": plate.frame_number ?? "N/A",
    "Detected At": plate.detected_at ?? "N/A",
    "Plate Image Path": plate.image_path ?? "",
    "Vehicle Image Path": plate.vehicle_image_path ?? "",
  }));

  const ws = XLSX.utils.json_to_sheet(rows);

  ws["!cols"] = [
    { wch: 5 },
    { wch: 18 },
    { wch: 10 },
    { wch: 14 },
    { wch: 20 },
    { wch: 22 },
    { wch: 24 },
    { wch: 14 },
    { wch: 22 },
    { wch: 40 },
    { wch: 40 },
  ];

  const metaRows = [
    { Key: "Job ID", Value: jobId },
    { Key: "Status", Value: jobStatus },
    { Key: "Export Time", Value: new Date().toLocaleString() },
    { Key: "Total Plates", Value: plates.length },
  ];
  const metaWs = XLSX.utils.json_to_sheet(metaRows);
  metaWs["!cols"] = [{ wch: 16 }, { wch: 40 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Detected Plates");
  XLSX.utils.book_append_sheet(wb, metaWs, "Job Info");

  const filename = `ANPR_Results_${jobId.substring(0, 8)}_${new Date()
    .toISOString()
    .slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}
