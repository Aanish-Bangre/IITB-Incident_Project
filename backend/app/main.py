# backend/app/main.py

from fastapi import FastAPI
from app.api.routes import router
from app.db.database import engine
from app.db import models

# Create tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="ANPR Backend")

app.include_router(router)


@app.get("/health")
def health_check():
    return {"status": "Backend is running"}
