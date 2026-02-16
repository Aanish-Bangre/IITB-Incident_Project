"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Point {
  x: number;
  y: number;
}

interface ROILineSelectorProps {
  jobId: string;
  imageUrl: string;
  onComplete: (roi: Point[], line: Point[]) => void;
  onSkip: () => void;
}

export default function ROILineSelector({ jobId, imageUrl, onComplete, onSkip }: ROILineSelectorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [roiPoints, setRoiPoints] = useState<Point[]>([]);
  const [linePoints, setLinePoints] = useState<Point[]>([]);
  const [mode, setMode] = useState<"roi" | "line">("roi");

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;
    img.onload = () => {
      setImage(img);
      drawCanvas(img, [], []);
    };
  }, [imageUrl]);

  const drawCanvas = (
    img: HTMLImageElement,
    roi: Point[],
    line: Point[]
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size to image size
    canvas.width = img.width;
    canvas.height = img.height;

    // Draw image
    ctx.drawImage(img, 0, 0);

    // Draw ROI polygon
    if (roi.length > 0) {
      ctx.strokeStyle = "#00ff00";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(roi[0].x, roi[0].y);
      for (let i = 1; i < roi.length; i++) {
        ctx.lineTo(roi[i].x, roi[i].y);
      }
      if (roi.length > 2) {
        ctx.closePath();
      }
      ctx.stroke();

      // Draw points
      roi.forEach((pt) => {
        ctx.fillStyle = "#00ff00";
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // Draw counting line
    if (line.length > 0) {
      ctx.strokeStyle = "#ff0000";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(line[0].x, line[0].y);
      if (line.length > 1) {
        ctx.lineTo(line[1].x, line[1].y);
      }
      ctx.stroke();

      // Draw points
      line.forEach((pt) => {
        ctx.fillStyle = "#ff0000";
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 8, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // Draw instructions
    ctx.fillStyle = mode === "roi" ? "#00ff00" : "#ff0000";
    ctx.font = "20px Arial";
    const text = mode === "roi" 
      ? `Click to draw ROI polygon (${roi.length} points)`
      : `Click 2 points for counting line (${line.length}/2)`;
    ctx.fillText(text, 10, 30);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    if (mode === "roi") {
      const newRoi = [...roiPoints, { x, y }];
      setRoiPoints(newRoi);
      drawCanvas(image, newRoi, linePoints);
    } else {
      if (linePoints.length < 2) {
        const newLine = [...linePoints, { x, y }];
        setLinePoints(newLine);
        drawCanvas(image, roiPoints, newLine);
      }
    }
  };

  const handleReset = () => {
    if (mode === "roi") {
      setRoiPoints([]);
      if (image) drawCanvas(image, [], linePoints);
    } else {
      setLinePoints([]);
      if (image) drawCanvas(image, roiPoints, []);
    }
  };

  const handleNext = () => {
    if (mode === "roi") {
      if (roiPoints.length >= 3) {
        setMode("line");
      } else {
        alert("Please select at least 3 points for ROI");
      }
    }
  };

  const handleComplete = () => {
    if (linePoints.length === 2) {
      onComplete(roiPoints, linePoints);
    } else {
      alert("Please select 2 points for the counting line");
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>
          {mode === "roi" ? "Step 1: Select ROI (Region of Interest)" : "Step 2: Select Counting Line"}
        </CardTitle>
        <CardDescription>
          {mode === "roi"
            ? "Click on the video frame to draw a polygon around the area you want to monitor"
            : "Click 2 points to draw the line where vehicles will be counted"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="border rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            className="cursor-crosshair max-w-full h-auto"
            style={{ maxHeight: "600px" }}
          />
        </div>

        <div className="flex gap-2 justify-between">
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleReset}>
              Reset {mode === "roi" ? "ROI" : "Line"}
            </Button>
            <Button variant="outline" onClick={onSkip}>
              Skip Setup
            </Button>
          </div>

          <div className="flex gap-2">
            {mode === "roi" && (
              <Button onClick={handleNext} disabled={roiPoints.length < 3}>
                Next: Set Line
              </Button>
            )}
            {mode === "line" && (
              <>
                <Button variant="outline" onClick={() => setMode("roi")}>
                  Back to ROI
                </Button>
                <Button onClick={handleComplete} disabled={linePoints.length !== 2}>
                  Start Processing
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="text-sm text-gray-600 space-y-1">
          {mode === "roi" ? (
            <>
              <p>• Click points to create a polygon around the area to monitor</p>
              <p>• Minimum 3 points required</p>
              <p>• Vehicles outside this area will be ignored</p>
            </>
          ) : (
            <>
              <p>• Click 2 points to draw the counting line</p>
              <p>• Only vehicles crossing this line will be counted</p>
              <p>• The line should be perpendicular to traffic flow</p>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
