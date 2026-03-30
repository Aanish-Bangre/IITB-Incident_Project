"use client";

import { useEffect, useState } from "react";
import { Camera, History, LayoutDashboard, Moon, Sun } from "lucide-react";
import {
  default as API,
  getJobStatus,
  getJobResults,
  createCameraJob,
  getCameraFirstFrame,
  startCameraJob,
  stopCameraJob,
  getCameraLiveFrameUrl,
} from "@/lib/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import ROILineSelector from "@/components/ROILineSelector";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
} from "@/components/ui/sidebar";

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

type JobStatus = "idle" | "uploading" | "uploaded" | "pending" | "processing" | "completed" | "failed" | "stopped";

const STATUS_PROGRESS: Record<JobStatus, number> = {
  idle: 0,
  uploading: 20,
  uploaded: 30,
  pending: 40,
  processing: 70,
  completed: 100,
  failed: 100,
  stopped: 100,
};

const getCameraLiveWsUrl = (jobId: string) => {
  const base = API.defaults.baseURL ?? "http://localhost:8000";
  const parsed = new URL(base);
  const protocol = parsed.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${parsed.host}/ws/camera-job/${jobId}/live`;
};

export default function HomePage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<JobStatus>("idle");
  const [plates, setPlates] = useState<Plate[]>([]);
  const [message, setMessage] = useState("Upload a video to begin vehicle tracking with ANPR.");
  const [progress, setProgress] = useState(0);
  const [processedVideoPath, setProcessedVideoPath] = useState<string | null>(null);

  // ROI/Line selection
  const [showROISelector, setShowROISelector] = useState(false);
  const [firstFrameUrl, setFirstFrameUrl] = useState<string | null>(null);
  const [liveFrameUrl, setLiveFrameUrl] = useState<string | null>(null);
  const [liveSocketStatus, setLiveSocketStatus] = useState<"idle" | "connecting" | "connected" | "disconnected">("idle");

  // Camera config
  const [cameraUsername, setCameraUsername] = useState("gpatil");
  const [cameraPassword, setCameraPassword] = useState("gpatil@2026");
  const [cameraIp, setCameraIp] = useState("10.162.1.182");
  const [cameraPath, setCameraPath] = useState("/h264");

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("theme");
    if (storedTheme === "dark" || storedTheme === "light") {
      setTheme(storedTheme);
      document.documentElement.classList.toggle("dark", storedTheme === "dark");
    }
  }, []);

  useEffect(() => {
    setProgress(STATUS_PROGRESS[status]);
  }, [status]);

  const handleCreateCameraJob = async () => {
    if (!cameraUsername || !cameraPassword || !cameraIp) {
      setMessage("Please fill username, password, and camera IP.");
      return;
    }

    try {
      setStatus("uploading");
      setMessage("Creating camera job...");
      setPlates([]);
      setProcessedVideoPath(null);
      setLiveFrameUrl(null);

      const createResponse = await createCameraJob({
        username: cameraUsername,
        password: cameraPassword,
        ip_address: cameraIp,
        path: cameraPath,
      });

      const newJobId = createResponse.data.job_id;
      setJobId(newJobId);
      setStatus("uploaded");
      setMessage("Camera connected. Set ROI and counting line...");

      const frameResponse = await getCameraFirstFrame(newJobId);
      const frameBlob = new Blob([frameResponse.data]);
      const frameUrl = URL.createObjectURL(frameBlob);

      setFirstFrameUrl(frameUrl);
      setShowROISelector(true);
    } catch (error) {
      console.error("Camera setup failed:", error);
      setStatus("failed");
      setMessage("Failed to connect camera. Check RTSP details and retry.");
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

      await startCameraJob(jobId, {
        roi_coords: roiCoords,
        line_coords: lineCoords,
        line_distance_meters: null,
      });

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

      await startCameraJob(jobId, {
        roi_coords: null,
        line_coords: null,
        line_distance_meters: null,
      });

    } catch (error) {
      console.error("Failed to start processing:", error);
      setStatus("failed");
      setMessage("Failed to start processing.");
    }
  };

  const handleStopCamera = async () => {
    if (!jobId) return;

    try {
      await stopCameraJob(jobId);
      setMessage("Camera stop signal sent.");
    } catch (error) {
      console.error("Failed to stop camera job:", error);
      setMessage("Failed to stop camera stream.");
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
          setMessage("Live stream processing in progress...");

          const liveResultsResponse = await getJobResults(jobId);
          setPlates(liveResultsResponse.data.plates ?? []);
        } else if (jobStatus === "completed") {
          clearInterval(interval);
          setProgress(100);
          setMessage("Processing complete! Loading results...");

          // Fetch results
          const resultsResponse = await getJobResults(jobId);
          setPlates(resultsResponse.data.plates ?? []);
          setProcessedVideoPath(resultsResponse.data.processed_video ?? null);
          setMessage(`Detection complete. Found ${resultsResponse.data.plates?.length || 0} unique plates.`);
        } else if (jobStatus === "stopped") {
          clearInterval(interval);
          setProgress(100);
          setMessage("Camera stream stopped. Loading captured results...");

          const resultsResponse = await getJobResults(jobId);
          setPlates(resultsResponse.data.plates ?? []);
          setProcessedVideoPath(resultsResponse.data.processed_video ?? null);
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

  useEffect(() => {
    if (!jobId || (status !== "pending" && status !== "processing")) {
      setLiveSocketStatus("idle");
      return;
    }

    const ws = new WebSocket(getCameraLiveWsUrl(jobId));
    setLiveSocketStatus("connecting");

    ws.binaryType = "blob";

    ws.onopen = () => {
      setLiveSocketStatus("connected");
    };

    ws.onmessage = (event) => {
      if (typeof event.data === "string") {
        try {
          const payload = JSON.parse(event.data);
          if (payload?.type === "done") {
            ws.close();
          }
        } catch {
          // Ignore non-JSON text frames
        }
        return;
      }

      const blob = event.data as Blob;
      const nextUrl = URL.createObjectURL(blob);
      setLiveFrameUrl((prev) => {
        if (prev && prev.startsWith("blob:")) {
          URL.revokeObjectURL(prev);
        }
        return nextUrl;
      });
    };

    ws.onclose = () => {
      setLiveSocketStatus("disconnected");
    };

    ws.onerror = () => {
      setLiveSocketStatus("disconnected");
    };

    return () => {
      ws.close();
    };
  }, [jobId, status]);

  useEffect(() => {
    if (!jobId || (status !== "pending" && status !== "processing")) {
      return;
    }

    if (liveSocketStatus === "connected") {
      return;
    }

    const interval = setInterval(() => {
      setLiveFrameUrl(`${getCameraLiveFrameUrl(jobId)}?t=${Date.now()}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [jobId, status, liveSocketStatus]);

  const statusBadgeVariant =
    status === "completed" ? "default" :
      status === "failed" ? "destructive" : "secondary";

  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
    window.localStorage.setItem("theme", nextTheme);
  };

  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <Sidebar
        collapsible="icon"
        onMouseEnter={() => setSidebarOpen(true)}
        onMouseLeave={() => setSidebarOpen(false)}
      >
        <SidebarHeader className="p-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="ANPR" asChild>
                <a href="/">
                  <Camera />
                  <span>ANPR</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="Dashboard" asChild>
                    <a href="/">
                      <LayoutDashboard />
                      <span>Dashboard</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="Results" asChild>
                    <a href="/results">
                      <History />
                      <span>Results</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="Tracker" asChild isActive>
                    <a href="/tracker">
                      <Camera />
                      <span>Tracker</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <main className="min-h-screen bg-muted/30 px-4 py-8 md:px-8">
          <div className="mx-auto mb-4 flex w-full max-w-6xl items-center justify-between">
            <div className="flex items-center gap-3">
              <Camera className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold">Vehicle Tracking & ANPR System</h1>
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={toggleTheme}
              className="rounded-full"
            >
              {theme === "dark" ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </Button>
          </div>

          <div className="mx-auto w-full max-w-6xl">

        {/* Upload Section */}
        {!showROISelector && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Source Selection</CardTitle>
              <CardDescription>
                Configure live RTSP camera feed for ANPR processing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="camera-ip">Camera IP</Label>
                  <Input
                    id="camera-ip"
                    value={cameraIp}
                    onChange={(e) => setCameraIp(e.target.value)}
                    disabled={status !== "idle" && status !== "failed"}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="camera-username">Username</Label>
                    <Input
                      id="camera-username"
                      value={cameraUsername}
                      onChange={(e) => setCameraUsername(e.target.value)}
                      disabled={status !== "idle" && status !== "failed"}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="camera-password">Password</Label>
                    <Input
                      id="camera-password"
                      type="password"
                      value={cameraPassword}
                      onChange={(e) => setCameraPassword(e.target.value)}
                      disabled={status !== "idle" && status !== "failed"}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="camera-path">RTSP Path</Label>
                  <Input
                    id="camera-path"
                    value={cameraPath}
                    onChange={(e) => setCameraPath(e.target.value)}
                    disabled={status !== "idle" && status !== "failed"}
                  />
                </div>
              </div>

              <Button
                onClick={handleCreateCameraJob}
                disabled={status !== "idle" && status !== "failed"}
                className="w-full"
              >
                Connect Camera & Start Setup
              </Button>

              {jobId && (status === "processing" || status === "pending") && (
                <Button
                  variant="destructive"
                  onClick={handleStopCamera}
                  className="w-full"
                >
                  Stop Camera Stream
                </Button>
              )}

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

        {/* Live Camera Frame */}
        {liveFrameUrl && !showROISelector && (status === "processing" || status === "pending") && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Live Processed Frame</CardTitle>
              <CardDescription>
                Real-time annotated frame over WebSocket ({liveSocketStatus})
              </CardDescription>
            </CardHeader>
            <CardContent>
              <img
                src={liveFrameUrl}
                alt="Live stream frame"
                className="w-full rounded-lg border"
              />
            </CardContent>
          </Card>
        )}

        {plates.length > 0 && !showROISelector && (status === "processing" || status === "pending" || status === "stopped" || status === "completed") && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Detected Output</CardTitle>
              <CardDescription>
                Vehicle and plate detections captured after line crossing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vehicle Crop</TableHead>
                    <TableHead>Plate Crop</TableHead>
                    <TableHead>Plate Text</TableHead>
                    <TableHead>Vehicle Type</TableHead>
                    <TableHead>Track ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plates.map((plate, idx) => (
                    <TableRow key={`${plate.plate_text}-${plate.track_id}-${idx}`}>
                      <TableCell>
                        {plate.vehicle_image_path ? (
                          <img
                            src={`${API.defaults.baseURL}/${plate.vehicle_image_path}`}
                            alt={`Vehicle ${plate.track_id ?? ""}`}
                            className="h-10 w-24 rounded border object-cover"
                          />
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {plate.image_path ? (
                          <img
                            src={`${API.defaults.baseURL}/${plate.image_path}`}
                            alt={`Plate ${plate.plate_text}`}
                            className="h-10 w-24 rounded border object-cover"
                          />
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{plate.plate_text || "-"}</TableCell>
                      <TableCell>{plate.vehicle_type ?? "-"}</TableCell>
                      <TableCell>{plate.track_id ?? "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
