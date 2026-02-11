# backend/app/db/models.py

from sqlalchemy import Column, String, DateTime, Integer, Float
from sqlalchemy.sql import func
from app.db.database import Base
import uuid


class Job(Base):
    __tablename__ = "jobs"

    job_id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    video_path = Column(String, nullable=False)
    status = Column(String, default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

# class Vehicle(Base):
#     __tablename__ = "vehicles"

#     id = Column(Integer, primary_key=True, index=True)
#     job_id = Column(String, nullable=False)
#     vehicle_type = Column(String, nullable=True)
#     vehicle_image_path = Column(String, nullable=True)
#     confidence = Column(Float, nullable=True)

class Plate(Base):
    __tablename__ = "plates"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(String, nullable=False)
    plate_image_path = Column(String, nullable=True)
    confidence = Column(Float, nullable=True)
