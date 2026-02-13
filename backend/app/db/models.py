# backend/app/db/models.py

from sqlalchemy import Column, String, DateTime, Integer, Float
from sqlalchemy.sql import func
from app.db.database import Base
import uuid


class Job(Base):
    __tablename__ = "jobs"

    job_id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    video_path = Column(String, nullable=False)
    processed_video_path = Column(String, nullable=True)
    status = Column(String, default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Plate(Base):
    __tablename__ = "plates"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(String, nullable=False)

    plate_text = Column(String, nullable=False)
    best_confidence = Column(Float, nullable=True)
    bbox_confidence = Column(Float, nullable=True)

    best_image_path = Column(String, nullable=True)
    vehicle_type = Column(String, nullable=True)
    vehicle_confidence = Column(Float, nullable=True)
    vehicle_image_path = Column(String, nullable=True)



