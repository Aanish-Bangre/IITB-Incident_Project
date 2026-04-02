"use client";

import { useEffect, useState } from "react";
import { Play } from "lucide-react";
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
import { PlatesTable, type Plate } from "@/components/PlatesTable";
import AppShell from "@/components/AppShell";

interface Job {
  job_id: string;
  status: string;
  video_path: string;
  processed_video_path: string | null;
  created_at: number;
  roi_coords: string | null;
  line_coords: string | null;
}

interface JobResults {
  job_id: string;
  status: string;
  processed_video: string | null;
  total_plates: number;
  plates: Plate[];
}

export default function ResultsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [jobResults, setJobResults] = useState<JobResults | null>(null);
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);
  const [isLoadingResults, setIsLoadingResults] = useState(false);

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

  const getStatusBadgeVariant = (status: string) => {
    if (status === "completed") return "default" as const;
    if (status === "failed") return "destructive" as const;
    if (status === "stopped") return "outline" as const;
    return "secondary" as const;
  };

  return (
    <AppShell activeRoute="/results">
      <h1 className="mx-auto mb-4 w-full max-w-6xl text-2xl font-bold">All Jobs & Results</h1>

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
                                disabled={job.status !== "completed" && job.status !== "stopped"}
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
                  ) : jobResults ? (
                    <>
                      {jobResults.processed_video && (
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
                        </>
                      )}

                      <Card>
                        <CardHeader>
                          <CardTitle>Detected Plates</CardTitle>
                          <CardDescription>
                            Best-confidence result grouped by Track ID.
                            {jobResults.status === "stopped" && (
                              <span className="ml-2 text-yellow-600 font-medium">
                                (Stream was stopped — showing partial results)
                              </span>
                            )}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <PlatesTable
                            plates={jobResults.plates}
                            jobId={selectedJob!}
                            jobStatus={jobResults.status}
                            showExport={true}
                          />
                        </CardContent>
                      </Card>
                    </>
                  ) : null}
                </>
              )}
            </CardContent>
      </Card>
    </AppShell>
  );
}
