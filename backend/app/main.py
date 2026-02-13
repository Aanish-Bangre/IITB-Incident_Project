# backend/app/main.py

from fastapi import FastAPI
from app.api.routes import router
from app.db.database import engine
from app.db import models
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# Create tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="ANPR Backend")
app.mount("/media", StaticFiles(directory="media"), name="media")
app.include_router(router)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    return {"status": "Backend is running"}
