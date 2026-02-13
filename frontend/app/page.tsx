"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { Camera, LayoutDashboard, Moon, Sun } from "lucide-react";
import API from "@/lib/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

interface Plate {
  plate_text: string;
  confidence: number;
  bbox_confidence: number;
  image_path: string;
}

type JobStatus = "idle" | "uploading" | "pending" | "processing" | "completed" | "failed";

const STATUS_PROGRESS: Record<JobStatus, number> = {
  idle: 0,
  uploading: 18,
  pending: 34,
  processing: 70,
  completed: 100,
  failed: 100,
};

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<JobStatus>("idle");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [plates, setPlates] = useState<Plate[]>([]);
  const [processedVideoPath, setProcessedVideoPath] = useState<string | null>(null);
  const [message, setMessage] = useState("Upload a video to begin ANPR processing.");
  const [progress, setProgress] = useState(0);
  const [isFetchingResults, setIsFetchingResults] = useState(false);

  const statusBadgeVariant = useMemo(() => {
    if (status === "completed") return "default" as const;
    if (status === "failed") return "destructive" as const;
    return "secondary" as const;
  }, [status]);

  const statusLabel = useMemo(() => status.charAt(0).toUpperCase() + status.slice(1), [status]);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("theme");
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

    const nextTheme: "light" | "dark" =
      storedTheme === "dark" || storedTheme === "light"
        ? storedTheme
        : systemPrefersDark
          ? "dark"
          : "light";

    document.documentElement.classList.toggle("dark", nextTheme === "dark");
    setTheme(nextTheme);
  }, []);

  useEffect(() => {
    setProgress((current) => {
      const target = STATUS_PROGRESS[status];
      return target > current ? target : current;
    });
  }, [status]);

  useEffect(() => {
    if (status !== "processing") return;

    const timer = setInterval(() => {
      setProgress((current) => (current < 92 ? current + 1 : current));
    }, 400);

    return () => clearInterval(timer);
  }, [status]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);

    if (selected) {
      setMessage(`Selected: ${selected.name}`);
    } else {
      setMessage("Upload a video to begin ANPR processing.");
    }
  };

  const fetchResults = async (id: string) => {
    try {
      setIsFetchingResults(true);
      const response = await API.get(`/job/${id}/results`);
      setPlates(response.data.plates ?? []);
      setProcessedVideoPath(response.data.processed_video ?? null);
      setMessage("Detection finished. Review recognized plates below.");
    } catch (error) {
      console.error("Failed to fetch results:", error);
      setMessage("Job completed, but fetching results failed. Try again.");
    } finally {
      setIsFetchingResults(false);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage("Please select a video file first.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      setStatus("uploading");
      setProgress(STATUS_PROGRESS.uploading);
      setMessage("Uploading video to backend...");
      setPlates([]);
      setProcessedVideoPath(null);

      const response = await API.post("/upload-video", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setJobId(response.data.job_id);
      setStatus("pending");
      setMessage("Upload complete. Job queued for processing.");
    } catch (error) {
      console.error("Upload failed:", error);
      setStatus("failed");
      setMessage("Upload failed. Verify backend connection and retry.");
    }
  };

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
    window.localStorage.setItem("theme", nextTheme);
  };

  useEffect(() => {
    if (!jobId) return;

    const interval = setInterval(async () => {
      try {
        const response = await API.get(`/job/${jobId}`);
        const jobStatus = response.data.status as JobStatus;

        setStatus(jobStatus);

        if (jobStatus === "pending") {
          setMessage("Job is waiting in queue.");
        }

        if (jobStatus === "processing") {
          setMessage("ANPR pipeline is running on sampled video frames.");
        }

        if (jobStatus === "completed") {
          clearInterval(interval);
          setProgress(100);
          await fetchResults(jobId);
        }

        if (jobStatus === "failed") {
          clearInterval(interval);
          setMessage("Processing failed. Check backend logs for details.");
        }
      } catch (error) {
        console.error("Status check failed:", error);
        setMessage("Unable to fetch live job status.");
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [jobId]);

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
              <SidebarMenuButton tooltip="ANPR" asChild isActive>
                <a href="#">
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
                  <SidebarMenuButton tooltip="Dashboard" asChild isActive>
                    <a href="#">
                      <LayoutDashboard />
                      <span>Dashboard</span>
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
          <div className="mx-auto mb-4 flex w-full max-w-6xl items-center justify-end">
            <Button
              variant="outline"
              size="icon"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              title={theme === "dark" ? "White Mode" : "Dark Mode"}
            >
              {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
          </div>

          <Card className="mx-auto w-full max-w-6xl">
            <CardHeader>
              <CardTitle className="text-2xl md:text-3xl">Offline ANPR Dashboard</CardTitle>
              <CardDescription>
                Upload a road video and extract the most confident license plate predictions.
              </CardDescription>
              <CardAction className="flex items-center gap-2">
                <Badge variant={statusBadgeVariant}>{statusLabel}</Badge>
                {jobId ? <Badge variant="outline">Job {jobId.slice(0, 8)}</Badge> : null}
              </CardAction>
            </CardHeader>

            <CardContent className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Upload & Monitor</CardTitle>
                  <CardDescription>Supports video files compatible with your backend pipeline.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="video-upload">Video file</Label>
                    <Input id="video-upload" type="file" accept="video/*" onChange={handleFileChange} />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={handleUpload}
                      disabled={!file || status === "uploading" || status === "processing" || status === "pending"}
                    >
                      {status === "uploading" ? "Uploading..." : "Start Detection"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setFile(null);
                        setJobId(null);
                        setPlates([]);
                        setProcessedVideoPath(null);
                        setStatus("idle");
                        setProgress(0);
                        setMessage("Reset complete. Upload a new video.");
                      }}
                    >
                      Reset
                    </Button>
                  </div>

                  <Progress value={progress} />

                  <Alert variant={status === "failed" ? "destructive" : "default"}>
                    <AlertTitle>Pipeline status</AlertTitle>
                    <AlertDescription>{message}</AlertDescription>
                  </Alert>
                </CardContent>
              </Card>

              <Separator />

              {processedVideoPath ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Processed Video</CardTitle>
                    <CardDescription>Annotated output generated by the ANPR pipeline.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <video
                      src={`http://localhost:8000/media/${processedVideoPath}`}
                      controls
                      className="w-full rounded-lg border"
                    />
                  </CardContent>
                </Card>
              ) : null}

              <Separator />

              <Card id="results-section">
                <CardHeader>
                  <CardTitle>Detected Plates</CardTitle>
                  <CardDescription>
                    Best-confidence image and OCR text grouped by plate string.
                  </CardDescription>
                  <CardAction>
                    <Badge variant="secondary">{plates.length} result(s)</Badge>
                  </CardAction>
                </CardHeader>
                <CardContent>
                  {isFetchingResults ? (
                    <div className="space-y-3">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : null}

                  {!isFetchingResults && status === "completed" && plates.length === 0 ? (
                    <Alert>
                      <AlertTitle>No plates found</AlertTitle>
                      <AlertDescription>
                        Processing finished but no valid plates were detected with current thresholds.
                      </AlertDescription>
                    </Alert>
                  ) : null}

                  {!isFetchingResults && plates.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Plate Crop</TableHead>
                          <TableHead>Plate Text</TableHead>
                          <TableHead className="text-right">BBox Confidence</TableHead>
                          <TableHead className="text-right">OCR Confidence</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {plates.map((plate, index) => (
                          <TableRow key={`${plate.plate_text}-${index}`}>
                            <TableCell>
                              <img
                                src={`http://localhost:8000/media/${plate.image_path}`}
                                alt={`Detected plate ${plate.plate_text}`}
                                className="h-16 rounded-md border"
                              />
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{plate.plate_text}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium">                            {(plate.bbox_confidence * 100).toFixed(2)}%
                          </TableCell>
                          <TableCell className="text-right font-medium">                              {(plate.confidence * 100).toFixed(2)}%
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : null}
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
