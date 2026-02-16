from sqlalchemy.orm import Session
from app.db.models import Job
from app.ai.pipeline_with_tracking import run_pipeline_with_tracking

def process_job(job_id: str, db: Session):
    job = db.query(Job).filter(Job.job_id == job_id).first()

    if not job:
        return

    try:
        job.status = "processing"
        db.commit()

        run_pipeline_with_tracking(job_id, job.video_path, db)

        job.status = "completed"
        db.commit()

    except Exception as e:
        job.status = "failed"
        db.commit()

        print(f"[ERROR] Job {job_id} failed: {e}")
