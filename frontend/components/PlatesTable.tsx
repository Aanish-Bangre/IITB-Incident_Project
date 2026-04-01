// frontend/components/PlatesTable.tsx
"use client";

import { Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import { exportResultsToExcel } from "@/lib/exportExcel";

export interface Plate {
  plate_text: string;
  confidence: number;
  bbox_confidence: number;
  image_path: string;
  vehicle_type?: string;
  vehicle_confidence?: number;
  vehicle_image_path?: string;
  track_id?: number;
  frame_number?: number;
  speed_kmh?: number;
  detected_at?: string;
}

interface PlatesTableProps {
  plates: Plate[];
  baseUrl?: string;         // e.g. "http://localhost:8000"
  jobId?: string;           // needed for export
  jobStatus?: string;       // needed for export
  showExport?: boolean;     // show export button (default true)
}

// Dedup by track_id, keeping highest-confidence plate per vehicle
export function dedupPlates(plates: Plate[]): Plate[] {
  return Object.values(
    plates.reduce((acc, plate) => {
      const key = plate.track_id ?? `no-id-${plate.plate_text}`;
      if (!acc[key] || (plate.confidence ?? 0) > (acc[key].confidence ?? 0)) {
        acc[key] = plate;
      }
      return acc;
    }, {} as Record<string | number, Plate>)
  );
}

export function PlatesTable({
  plates,
  baseUrl = "http://localhost:8000",
  jobId = "unknown",
  jobStatus = "completed",
  showExport = true,
}: PlatesTableProps) {
  const deduped = dedupPlates(plates);

  if (deduped.length === 0) {
    return (
      <Alert>
        <AlertTitle>No plates found</AlertTitle>
        <AlertDescription>
          Processing finished but no valid plates were detected.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header row: count + export */}
      <div className="flex items-center justify-between">
        <Badge variant="secondary">{deduped.length} result(s)</Badge>
        {showExport && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => exportResultsToExcel(deduped, jobId, jobStatus)}
          >
            <Download className="h-4 w-4 mr-2" />
            Export to Excel
          </Button>
        )}
      </div>

      {/* Unified table — fixed column order */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Track ID</TableHead>
            <TableHead>Vehicle Crop</TableHead>
            <TableHead>Plate Crop</TableHead>
            <TableHead>Plate Text</TableHead>
            <TableHead>Vehicle Type</TableHead>
            <TableHead>Detected At</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {deduped.map((plate, index) => (
            <TableRow key={`${plate.track_id ?? plate.plate_text}-${index}`}>
              {/* Track ID */}
              <TableCell>
                {plate.track_id !== undefined ? (
                  <Badge variant="outline">#{plate.track_id}</Badge>
                ) : (
                  <span className="text-muted-foreground text-sm">-</span>
                )}
              </TableCell>

              {/* Vehicle Crop */}
              <TableCell>
                {plate.vehicle_image_path ? (
                  <img
                    src={`${baseUrl}/${plate.vehicle_image_path}`}
                    alt={`Vehicle ${plate.vehicle_type ?? ""}`}
                    className="h-16 w-28 rounded-md border object-cover"
                  />
                ) : (
                  <span className="text-muted-foreground text-sm">N/A</span>
                )}
              </TableCell>

              {/* Plate Crop */}
              <TableCell>
                {plate.image_path ? (
                  <img
                    src={`${baseUrl}/${plate.image_path}`}
                    alt={`Plate ${plate.plate_text}`}
                    className="h-12 rounded-md border"
                  />
                ) : (
                  <span className="text-muted-foreground text-sm">N/A</span>
                )}
              </TableCell>

              {/* Plate Text */}
              <TableCell>
                <Badge variant="outline" className="font-mono text-sm">
                  {plate.plate_text}
                </Badge>
              </TableCell>

              {/* Vehicle Type */}
              <TableCell>
                {plate.vehicle_type ? (
                  <Badge variant="secondary">{plate.vehicle_type}</Badge>
                ) : (
                  <span className="text-muted-foreground text-sm">N/A</span>
                )}
              </TableCell>

              {/* Detected At */}
              <TableCell className="text-sm text-muted-foreground">
                {plate.detected_at ?? (
                  <span className="text-muted-foreground text-sm">N/A</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}