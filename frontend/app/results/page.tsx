"use client";

import { useEffect, useState } from "react";
import { Camera, LayoutDashboard, Moon, Sun, History, Play } from "lucide-react";
import { getAllJobs, getJobResults } from "@/lib/api";
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

interface Job {
  job_id: string;
  status: string;
  video_path: string;
  processed_video_path: string | null;
  created_at: number;
  roi_coords: string | null;
  line_coords: string | null;
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

interface JobResults {
  job_id: string;
  status: string;
  processed_video: string | null;
  total_plates: number;
  plates: Plate[];
}

export default function ResultsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [jobResults, setJobResults] = useState<JobResults | null>(null);
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);
  const [isLoadingResults, setIsLoadingResults] = useState(false);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("theme");
    if (storedTheme === "dark" || storedTheme === "light") {
      setTheme(storedTheme);
      document.documentElement.classList.toggle("dark", storedTheme === "dark");
    }
  }, []);

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    try {
      setIsLoadingJobs(true);
      const response = await getAllJobs();
      setJobs(response.data.jobs);
    } catch (error) {
      console.error("Failed to load jobs:", error);
    } finally {
      setIsLoadingJobs(false);
    }
  };

  const loadJobResults = async (jobId: string) => {
    try {
      setIsLoadingResults(true);
      setSelectedJob(jobId);
      const response = await getJobResults(jobId);
      setJobResults(response.data);
    } catch (error) {
      console.error("Failed to load job results:", error);
      setJobResults(null);
    } finally {
      setIsLoadingResults(false);
    }
  };

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
    window.localStorage.setItem("theme", nextTheme);
  };

  const getStatusBadgeVariant = (status: string) => {
    if (status === "completed") return "default" as const;
    if (status === "failed") return "destructive" as const;
    return "secondary" as const;
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
                  <SidebarMenuButton tooltip="Results" asChild isActive>
                    <a href="/results">
                      <History />
                      <span>Results</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="Tracker" asChild>
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
            <h1 className="text-2xl font-bold">All Jobs & Results</h1>
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

          <Card className="mx-auto w-full max-w-6xl">
            <CardContent className="p-6 space-y-6">
              {/* Jobs List */}
              <Card>
                <CardHeader>
                  <CardTitle>All Jobs</CardTitle>
                  <CardDescription>
                    Click on a completed job to view its results
                  </CardDescription>
                  <CardAction>
                    <Badge variant="secondary">{jobs.length} job(s)</Badge>
                  </CardAction>
                </CardHeader>
                <CardContent>
                  {isLoadingJobs ? (
                    <div className="space-y-3">
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                    </div>
                  ) : jobs.length === 0 ? (
                    <Alert>
                      <AlertTitle>No jobs found</AlertTitle>
                      <AlertDescription>
                        Upload a video from the dashboard to get started.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Job ID</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Video Path</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {jobs.map((job) => (
                          <TableRow 
                            key={job.job_id}
                            className={selectedJob === job.job_id ? "bg-muted" : ""}
                          >
                            <TableCell className="font-mono text-sm">
                              {job.job_id.substring(0, 8)}...
                            </TableCell>
                            <TableCell>
                              <Badge variant={getStatusBadgeVariant(job.status)}>
                                {job.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {job.video_path.split('/').pop()}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={job.status !== "completed"}
                                onClick={() => loadJobResults(job.job_id)}
                              >
                                <Play className="h-4 w-4 mr-2" />
                                View Results
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Selected Job Results */}
              {selectedJob && (
                <>
                  <Separator />

                  {isLoadingResults ? (
                    <Card>
                      <CardContent className="p-6">
                        <div className="space-y-3">
                          <Skeleton className="h-8 w-64" />
                          <Skeleton className="h-64 w-full" />
                        </div>
                      </CardContent>
                    </Card>
                  ) : jobResults && jobResults.processed_video ? (
                    <>
                      <Card>
                        <CardHeader>
                          <CardTitle>Processed Video</CardTitle>
                          <CardDescription>
                            Job ID: {selectedJob}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <video
                            src={`http://localhost:8000/${jobResults.processed_video}`}
                            controls
                            className="w-full rounded-lg border"
                            preload="metadata"
                          >
                            Your browser does not support the video tag.
                          </video>
                        </CardContent>
                      </Card>

                      <Separator />

                      <Card>
                        <CardHeader>
                          <CardTitle>Detected Plates</CardTitle>
                          <CardDescription>
                            Best-confidence image and OCR text grouped by plate string.
                          </CardDescription>
                          <CardAction>
                            <Badge variant="secondary">
                              {jobResults.total_plates} result(s)
                            </Badge>
                          </CardAction>
                        </CardHeader>
                        <CardContent>
                          {jobResults.plates.length === 0 ? (
                            <Alert>
                              <AlertTitle>No plates found</AlertTitle>
                              <AlertDescription>
                                Processing finished but no valid plates were detected.
                              </AlertDescription>
                            </Alert>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Vehicle Crop</TableHead>
                                  <TableHead>Plate Crop</TableHead>
                                  <TableHead>Plate Text</TableHead>
                                  <TableHead>Vehicle Type</TableHead>
                                  <TableHead>Track ID</TableHead>
                                  <TableHead className="text-right">BBox Confidence</TableHead>
                                  <TableHead className="text-right">OCR Confidence</TableHead>
                                  <TableHead className="text-right">Vehicle Confidence</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {jobResults.plates.map((plate, index) => (
                                  <TableRow key={`${plate.plate_text}-${index}`}>
                                    <TableCell>
                                      {plate.vehicle_image_path ? (
                                        <img
                                          src={`http://localhost:8000/${plate.vehicle_image_path}`}
                                          alt={`Vehicle ${plate.vehicle_type}`}
                                          className="h-20 rounded-md border"
                                        />
                                      ) : (
                                        <span className="text-muted-foreground text-sm">N/A</span>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      <img
                                        src={`http://localhost:8000/${plate.image_path}`}
                                        alt={`Detected plate ${plate.plate_text}`}
                                        className="h-16 rounded-md border"
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="outline">{plate.plate_text}</Badge>
                                    </TableCell>
                                    <TableCell>
                                      {plate.vehicle_type ? (
                                        <Badge variant="secondary">{plate.vehicle_type}</Badge>
                                      ) : (
                                        <span className="text-muted-foreground text-sm">N/A</span>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      {plate.track_id !== undefined ? (
                                        <Badge variant="outline">#{plate.track_id}</Badge>
                                      ) : (
                                        <span className="text-muted-foreground text-sm">-</span>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                      {(plate.bbox_confidence * 100).toFixed(2)}%
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                      {(plate.confidence * 100).toFixed(2)}%
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                      {plate.vehicle_confidence
                                        ? `${(plate.vehicle_confidence * 100).toFixed(2)}%`
                                        : 'N/A'}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </CardContent>
                      </Card>
                    </>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
