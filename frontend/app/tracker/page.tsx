"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { Camera } from "lucide-react";
import { uploadVideo, getFirstFrame, setROILine, getJobStatus, getJobResults } from "@/lib/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import ROILineSelector from "@/components/ROILineSelector";

interface Point {
  x: number;
  y: number;
}

interface Plate {
  plate_text: string;
  confidence: number;
  bbox_confidence: number;
  image_path: string;
  vehicle_type?: string;
  vehicle_confidence?: number;
  vehicle_image_path?: string;
  track_id?: number;
  frame_number?: number;
}

type JobStatus = "idle" | "uploading" | "uploaded" | "pending" | "processing" | "completed" | "failed";

const STATUS_PROGRESS: Record<JobStatus, number> = {
  idle: 0,
  uploading: 20,
  uploaded: 30,
  pending: 40,
  processing: 70,
  completed: 100,
  failed: 100,
};

export default function HomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<JobStatus>("idle");
  const [plates, setPlates] = useState<Plate[]>([]);
  const [message, setMessage] = useState("Upload a video to begin vehicle tracking with ANPR.");
  const [progress, setProgress] = useState(0);
  const [processedVideoPath, setProcessedVideoPath] = useState<string | null>(null);
  
  // ROI/Line selection
  const [showROISelector, setShowROISelector] = useState(false);
  const [firstFrameUrl, setFirstFrameUrl] = useState<string | null>(null);

  useEffect(() => {
    setProgress(STATUS_PROGRESS[status]);
  }, [status]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    if (selected) {
      setMessage(`Selected: ${selected.name}`);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage("Please select a video file first.");
      return;
    }

    try {
      setStatus("uploading");
      setMessage("Uploading video...");
      setPlates([]);

      const response = await uploadVideo(file);
      const newJobId = response.data.job_id;
      
      setJobId(newJobId);
      setStatus("uploaded");
      setMessage("Upload complete. Setting up ROI and counting line...");
      
      // Get first frame for ROI selection
      const frameResponse = await getFirstFrame(newJobId);
      const frameBlob = new Blob([frameResponse.data]);
      const frameUrl = URL.createObjectURL(frameBlob);
      
      setFirstFrameUrl(frameUrl);
      setShowROISelector(true);
      
    } catch (error) {
      console.error("Upload failed:", error);
      setStatus("failed");
      setMessage("Upload failed. Check backend connection.");
    }
  };

  const handleROILineComplete = async (roi: Point[], line: Point[]) => {
    if (!jobId) return;

    try {
      setShowROISelector(false);
      setMessage("Starting processing with tracking...");
      setStatus("pending");

      // Convert points to backend format
      const roiCoords = roi.map(p => [Math.round(p.x), Math.round(p.y)]);
      const lineCoords = [
        Math.round(line[0].x),
        Math.round(line[0].y),
        Math.round(line[1].x),
        Math.round(line[1].y)
      ];

      await setROILine(jobId, roiCoords, lineCoords);
      
    } catch (error) {
      console.error("Failed to set ROI/Line:", error);
      setStatus("failed");
      setMessage("Failed to start processing.");
    }
  };

  const handleSkipROILine = async () => {
    if (!jobId) return;

    try {
      setShowROISelector(false);
      setMessage("Starting processing without ROI/Line filtering...");
      setStatus("pending");

      await setROILine(jobId, null, null);
      
    } catch (error) {
      console.error("Failed to start processing:", error);
      setStatus("failed");
      setMessage("Failed to start processing.");
    }
  };

  useEffect(() => {
    if (!jobId || status === "idle" || status === "uploaded") return;

    const interval = setInterval(async () => {
      try {
        const response = await getJobStatus(jobId);
        const jobStatus = response.data.status as JobStatus;

        setStatus(jobStatus);

        if (jobStatus === "pending") {
          setMessage("Job queued for processing...");
        } else if (jobStatus === "processing") {
          setMessage("Tracking vehicles and detecting plates...");
        } else if (jobStatus === "completed") {
          clearInterval(interval);
          setProgress(100);
          setMessage("Processing complete! Loading results...");
          
          // Fetch results
          const resultsResponse = await getJobResults(jobId);
          setPlates(resultsResponse.data.plates ?? []);
          setProcessedVideoPath(resultsResponse.data.processed_video ?? null);
          setMessage(`Detection complete. Found ${resultsResponse.data.plates?.length || 0} unique plates.`);
        } else if (jobStatus === "failed") {
          clearInterval(interval);
          setMessage("Processing failed. Please try again.");
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [jobId, status]);

  const statusBadgeVariant = 
    status === "completed" ? "default" :
    status === "failed" ? "destructive" : "secondary";

  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Camera className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Vehicle Tracking & ANPR System</h1>
        </div>

        {/* Upload Section */}
        {!showROISelector && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Upload Video</CardTitle>
              <CardDescription>
                Upload a traffic video for vehicle tracking and number plate detection
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="video">Video File</Label>
                <Input
                  id="video"
                  type="file"
                  accept="video/*"
                  onChange={handleFileChange}
                  disabled={status !== "idle" && status !== "failed"}
                />
              </div>

              <Button
                onClick={handleUpload}
                disabled={!file || (status !== "idle" && status !== "failed")}
                className="w-full"
              >
                Upload & Start Setup
              </Button>

              {/* Status */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Status:</span>
                  <Badge variant={statusBadgeVariant}>{statusLabel}</Badge>
                </div>
                <Progress value={progress} className="h-2" />
                <p className="text-sm text-muted-foreground">{message}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ROI/Line Selector */}
        {showROISelector && firstFrameUrl && jobId && (
          <ROILineSelector
            jobId={jobId}
            imageUrl={firstFrameUrl}
            onComplete={handleROILineComplete}
            onSkip={handleSkipROILine}
          />
        )}

        {/* Processed Video */}
        {status === "completed" && processedVideoPath && !showROISelector && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Processed Video with Tracking</CardTitle>
              <CardDescription>
                Annotated video showing tracked vehicles, ROI polygon, and counting line
              </CardDescription>
            </CardHeader>
            <CardContent>
              <video
                src={`http://localhost:8000/${processedVideoPath}`}
                controls
                className="w-full rounded-lg border"
                preload="metadata"
              >
                Your browser does not support the video tag.
              </video>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {status === "completed" && plates.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Detected Plates ({plates.length})</CardTitle>
              <CardDescription>
                Number plates detected from tracked vehicles that crossed the counting line
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {plates.map((plate, idx) => (
                  <Card key={idx} className="overflow-hidden">
                    <CardContent className="p-4 space-y-2">
                      <div className="text-2xl font-bold text-center bg-yellow-100 dark:bg-yellow-900 p-2 rounded">
                        {plate.plate_text}
                      </div>
                      {plate.image_path && (
                        <img
                          src={`http://localhost:8000/${plate.image_path}`}
                          alt={plate.plate_text}
                          className="w-full rounded border"
                        />
                      )}
                      <div className="text-sm space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">OCR Confidence:</span>
                          <span className="font-medium">{(plate.confidence * 100).toFixed(1)}%</span>
                        </div>
                        {plate.vehicle_type && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Vehicle:</span>
                            <span className="font-medium">{plate.vehicle_type}</span>
                          </div>
                        )}
                        {plate.track_id !== undefined && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Track ID:</span>
                            <span className="font-medium">#{plate.track_id}</span>
                          </div>
                        )}
                        {plate.frame_number && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Frame:</span>
                            <span className="font-medium">{plate.frame_number}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* No Results */}
        {status === "completed" && plates.length === 0 && (
          <Alert>
            <AlertTitle>No Plates Detected</AlertTitle>
            <AlertDescription>
              No number plates were detected in tracked vehicles that crossed the counting line.
              Try adjusting the ROI or counting line position.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}
