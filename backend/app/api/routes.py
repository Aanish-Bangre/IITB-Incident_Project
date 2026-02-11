# backend/app/api/routes.py

from fastapi import APIRouter, UploadFile, File, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from app.db.models import Job
from app.db.database import SessionLocal
import os
import shutil
import uuid

from app.services.job_manager import process_job

router = APIRouter()

MEDIA_DIR = "media/videos"
os.makedirs(MEDIA_DIR, exist_ok=True)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/upload-video")
def upload_video(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    job_id = str(uuid.uuid4())
    video_filename = f"{job_id}.mp4"
    video_path = os.path.join(MEDIA_DIR, video_filename)

    # Save video
    with open(video_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Create DB job
    new_job = Job(
        job_id=job_id,
        video_path=video_path,
        status="pending"
    )

    db.add(new_job)
    db.commit()
    db.refresh(new_job)

    # Start background processing
    background_tasks.add_task(process_job, job_id, db)

    return {
        "job_id": new_job.job_id,
        "status": new_job.status
    }
