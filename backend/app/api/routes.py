# backend/app/api/routes.py

from fastapi import APIRouter, UploadFile, File, Depends, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.db.models import Job, Plate
from app.db.database import SessionLocal
from pydantic import BaseModel
from typing import List, Optional
import os
import shutil
import uuid
import cv2
import json

from app.services.job_manager import process_job

router = APIRouter()

MEDIA_DIR = "media/videos"
FRAMES_DIR = "media/frames"
os.makedirs(MEDIA_DIR, exist_ok=True)
os.makedirs(FRAMES_DIR, exist_ok=True)


class ROILineRequest(BaseModel):
    job_id: str
    roi_coords: Optional[List[List[int]]] = None  # [[x1,y1], [x2,y2], ...]
    line_coords: Optional[List[int]] = None  # [x1, y1, x2, y2]


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/upload-video")
def upload_video(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    job_id = str(uuid.uuid4())
    video_filename = f"{job_id}.mp4"
    video_path = os.path.join(MEDIA_DIR, video_filename)

    with open(video_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    new_job = Job(
        job_id=job_id,
        video_path=video_path,
        status="uploaded"  # Changed to uploaded, waiting for ROI/line
    )

    db.add(new_job)
    db.commit()
    db.refresh(new_job)

    return {
        "job_id": new_job.job_id,
        "status": new_job.status
    }


@router.get("/job/{job_id}/first-frame")
def get_first_frame(job_id: str, db: Session = Depends(get_db)):
    """Get first frame of video for ROI/line selection"""
    job = db.query(Job).filter(Job.job_id == job_id).first()
    
    if not job:
        return {"error": "Job not found"}
    
    frame_path = os.path.join(FRAMES_DIR, f"{job_id}_first_frame.jpg")
    
    # Extract first frame if not exists
    if not os.path.exists(frame_path):
        cap = cv2.VideoCapture(job.video_path)
        ret, frame = cap.read()
        cap.release()
        
        if not ret:
            return {"error": "Could not read video"}
        
        cv2.imwrite(frame_path, frame)
    
    return FileResponse(frame_path, media_type="image/jpeg")


@router.post("/job/set-roi-line")
def set_roi_line(
    request: ROILineRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Set ROI and counting line coordinates and start processing"""
    job = db.query(Job).filter(Job.job_id == request.job_id).first()
    
    if not job:
        return {"error": "Job not found"}
    
    # Store coordinates as JSON
    if request.roi_coords:
        job.roi_coords = json.dumps(request.roi_coords)
    if request.line_coords:
        job.line_coords = json.dumps(request.line_coords)
    
    job.status = "pending"
    db.commit()
    
    # Start processing in background
    background_tasks.add_task(process_job, request.job_id, db)
    
    return {
        "job_id": job.job_id,
        "status": job.status,
        "message": "Processing started with ROI and line"
    }


@router.get("/job/{job_id}")
def get_job_status(job_id: str, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.job_id == job_id).first()

    if not job:
        return {"error": "Job not found"}

    return {
        "job_id": job.job_id,
        "status": job.status
    }


@router.get("/jobs")
def list_all_jobs(db: Session = Depends(get_db)):
    """List all jobs with their status"""
    jobs = db.query(Job).order_by(Job.created_at.desc()).all()
    
    return {
        "total": len(jobs),
        "jobs": [
            {
                "job_id": job.job_id,
                "status": job.status,
                "video_path": job.video_path,
                "processed_video_path": job.processed_video_path,
                "created_at": job.created_at.isoformat() if job.created_at else None,
                "roi_coords": job.roi_coords,
                "line_coords": job.line_coords
            }
            for job in jobs
        ]
    }


@router.get("/job/{job_id}/results")
def get_job_results(job_id: str, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.job_id == job_id).first()

    if not job:
        return {"error": "Job not found"}

    if job.status != "completed":
        return {
            "job_id": job_id,
            "status": job.status,
            "message": "Job not completed yet"
        }

    plates = db.query(Plate).filter(Plate.job_id == job_id).all()

    return {
        "job_id": job_id,
        "status": job.status,
        "processed_video": job.processed_video_path,
        "total_plates": len(plates),
        "plates": [
            {
                "plate_text": plate.plate_text,
                "confidence": plate.best_confidence,
                "bbox_confidence": plate.bbox_confidence,
                "image_path": plate.best_image_path,
                "vehicle_type": plate.vehicle_type,
                "vehicle_confidence": plate.vehicle_confidence,
                "vehicle_image_path": plate.vehicle_image_path,
                "track_id": plate.track_id,
                "frame_number": plate.frame_number
            }
            for plate in plates
        ]
    }
