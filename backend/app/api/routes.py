# backend/app/api/routes.py

from datetime import datetime
import asyncio
import time as _time
import queue
import threading
from fastapi import APIRouter, UploadFile, File, Depends, BackgroundTasks, HTTPException, WebSocket, WebSocketDisconnect
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
import urllib.parse

from app.services.job_manager import process_job

router = APIRouter()

MEDIA_DIR = "media/videos"
FRAMES_DIR = "media/frames"
os.makedirs(MEDIA_DIR, exist_ok=True)
os.makedirs(FRAMES_DIR, exist_ok=True)

# Global registry for live camera streams: job_id -> latest-frame queue.
active_frame_queues: dict[str, queue.Queue] = {}


class ROILineRequest(BaseModel):
    job_id: str
    roi_coords: Optional[List[List[int]]] = None  # [[x1,y1], [x2,y2], ...]
    line_coords: Optional[List[int]] = None  # [x1, y1, x2, y2]
    line_distance_meters: Optional[float] = None


class CameraCreateRequest(BaseModel):
    username: str
    password: str
    ip_address: str
    path: str = "/h264"
    name: Optional[str] = None


class CameraStartRequest(BaseModel):
    roi_coords: Optional[List[List[int]]] = None
    line_coords: Optional[List[int]] = None
    line_distance_meters: Optional[float] = None


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _process_camera_job_with_queue(job_id: str, frame_queue: queue.Queue):
    try:
        process_job(job_id, frame_queue=frame_queue)
    finally:
        active_frame_queues.pop(job_id, None)


def _build_rtsp_url(username: str, password: str, ip_address: str, path: str) -> str:
    normalized_path = path if path.startswith("/") else f"/{path}"
    safe_password = urllib.parse.quote(password)
    return f"rtsp://{username}:{safe_password}@{ip_address}{normalized_path}"


def _capture_first_frame(source: str, output_path: str) -> bool:
    if source.startswith("rtsp://"):
        os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = (
            "rtsp_transport;tcp|timeout;5000000|reorder_queue_size;100|buffer_size;1024000"
        )
        cap = cv2.VideoCapture(source, cv2.CAP_FFMPEG)
    else:
        cap = cv2.VideoCapture(source)

    ret, frame = cap.read()
    cap.release()

    if not ret:
        return False

    cv2.imwrite(output_path, frame)
    return True


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
        if not job.video_path:
            return {"error": "No video source found"}

        if not _capture_first_frame(job.video_path, frame_path):
            return {"error": "Could not read video"}
    
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
    if request.line_distance_meters is not None:
        job.line_distance_meters = request.line_distance_meters
    
    job.status = "pending"
    db.commit()
    
    # Start processing in background
    background_tasks.add_task(process_job, request.job_id)
    
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
        "status": job.status,
        "job_type": job.job_type,
        "is_live": job.is_live,
        "live_frame": f"media/frames/{job_id}_live.jpg" if os.path.exists(os.path.join(FRAMES_DIR, f"{job_id}_live.jpg")) else None
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
                "line_coords": job.line_coords,
                "job_type": job.job_type,
                "is_live": job.is_live,
                "camera_rtsp_url": job.camera_rtsp_url
            }
            for job in jobs
        ]
    }


@router.get("/job/{job_id}/results")
def get_job_results(job_id: str, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.job_id == job_id).first()

    if not job:
        return {"error": "Job not found"}

    plates = db.query(Plate).filter(Plate.job_id == job_id).all()

    response = {
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
                "frame_number": plate.frame_number,
                "speed_kmh": plate.speed_kmh,
                "detected_at": plate.detected_at.strftime("%d-%m-%Y %H:%M:%S") if plate.detected_at else None,
            }
            for plate in plates
        ]
    }

    if job.status not in {"completed", "stopped"}:
        response["message"] = "Live partial detections"

    return response


@router.post("/camera-job/create")
def create_camera_job(request: CameraCreateRequest, db: Session = Depends(get_db)):
    rtsp_url = _build_rtsp_url(request.username, request.password, request.ip_address, request.path)
    job_id = str(uuid.uuid4())

    camera_config = {
        "name": request.name or request.ip_address,
        "ip_address": request.ip_address,
        "path": request.path,
        "username": request.username
    }

    new_job = Job(
        job_id=job_id,
        video_path="",
        status="uploaded",
        job_type="camera_stream",
        camera_rtsp_url=rtsp_url,
        camera_config=json.dumps(camera_config),
        is_live="false"
    )

    db.add(new_job)
    db.commit()
    db.refresh(new_job)

    return {
        "job_id": new_job.job_id,
        "status": new_job.status,
        "job_type": new_job.job_type
    }


@router.get("/camera-job/{job_id}/first-frame")
def get_camera_first_frame(job_id: str, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.job_id == job_id).first()

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.job_type != "camera_stream":
        raise HTTPException(status_code=400, detail="Not a camera stream job")
    if not job.camera_rtsp_url:
        raise HTTPException(status_code=400, detail="Camera RTSP URL is missing")

    frame_path = os.path.join(FRAMES_DIR, f"{job_id}_first_frame.jpg")
    if not _capture_first_frame(job.camera_rtsp_url, frame_path):
        raise HTTPException(status_code=500, detail="Could not read camera stream")

    return FileResponse(frame_path, media_type="image/jpeg")


@router.post("/camera-job/{job_id}/start")
def start_camera_job(
    job_id: str,
    request: CameraStartRequest,
    db: Session = Depends(get_db)
):
    job = db.query(Job).filter(Job.job_id == job_id).first()

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.job_type != "camera_stream":
        raise HTTPException(status_code=400, detail="Not a camera stream job")

    if request.roi_coords:
        job.roi_coords = json.dumps(request.roi_coords)
    if request.line_coords:
        job.line_coords = json.dumps(request.line_coords)
    if request.line_distance_meters is not None:
        job.line_distance_meters = request.line_distance_meters

    job.status = "pending"
    job.is_live = "true"
    job.stream_started_at = datetime.utcnow()
    db.commit()

    frame_q = queue.Queue(maxsize=2)
    active_frame_queues[job_id] = frame_q

    thread = threading.Thread(
        target=_process_camera_job_with_queue,
        args=(job_id, frame_q),
        daemon=True,
        name=f"pipeline-{job_id}",
    )
    thread.start()

    return {
        "job_id": job.job_id,
        "status": job.status,
        "is_live": job.is_live,
        "message": "Live camera processing started"
    }


@router.post("/camera-job/{job_id}/stop")
def stop_camera_job(job_id: str, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.job_id == job_id).first()

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.job_type != "camera_stream":
        raise HTTPException(status_code=400, detail="Not a camera stream job")

    job.is_live = "false"
    if job.status in {"processing", "pending"}:
        job.status = "stopped"
    db.commit()
    active_frame_queues.pop(job_id, None)

    _time.sleep(1.5)

    plates = db.query(Plate).filter(Plate.job_id == job_id).all()

    return {
        "job_id": job.job_id,
        "status": job.status,
        "is_live": job.is_live,
        "message": "Stop signal sent",
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
                "frame_number": plate.frame_number,
            }
            for plate in plates
        ],
    }


@router.get("/camera-job/{job_id}/live-frame")
def get_camera_live_frame(job_id: str):
    live_frame_path = os.path.join(FRAMES_DIR, f"{job_id}_live.jpg")
    if not os.path.exists(live_frame_path):
        raise HTTPException(status_code=404, detail="Live frame not available yet")
    return FileResponse(live_frame_path, media_type="image/jpeg")


@router.websocket("/ws/camera-job/{job_id}/live")
async def camera_live_ws(websocket: WebSocket, job_id: str):
    await websocket.accept()

    db = SessionLocal()
    frame_queue = active_frame_queues.get(job_id)
    status_check_counter = 0

    if frame_queue is None:
        await websocket.send_json({"type": "error", "message": "Live stream queue not available"})
        await websocket.close()
        db.close()
        return

    try:
        while True:
            status_check_counter += 1
            if status_check_counter >= 25:
                status_check_counter = 0
                db.expire_all()
                job = db.query(Job).filter(Job.job_id == job_id).first()
                if not job:
                    await websocket.send_json({"type": "done", "status": "unknown"})
                    break
                if job.job_type != "camera_stream":
                    await websocket.send_json({"type": "error", "message": "Not a camera stream job"})
                    break
                if job.status in {"completed", "failed", "stopped"}:
                    await websocket.send_json({"type": "done", "status": job.status})
                    break

            try:
                frame = frame_queue.get_nowait()
                ok, encoded = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
                if ok:
                    await websocket.send_bytes(encoded.tobytes())
            except queue.Empty:
                await asyncio.sleep(0.04)
                continue
            await asyncio.sleep(0.01)

    except WebSocketDisconnect:
        pass
    finally:
        db.close()
