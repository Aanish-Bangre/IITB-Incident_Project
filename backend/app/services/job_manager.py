from sqlalchemy.orm import Session
from app.db.models import Job
from app.ai.pipeline import run_pipeline


def process_job(job_id: str, db: Session):
    job = db.query(Job).filter(Job.job_id == job_id).first()
    if not job:
        return

    job.status = "processing"
    db.commit()

    # Run AI pipeline
    run_pipeline(job_id, job.video_path, db)

    job.status = "completed"
    db.commit()
