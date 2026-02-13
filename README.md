# 🚗 ANPR System - Multi-Model Vehicle & License Plate Recognition

Professional-grade **Automatic Number Plate Recognition** system with **dual YOLO models** for vehicle classification and plate detection, powered by **EasyOCR** for text extraction.

---

## 🎯 Features

- **Multi-Model Detection**: Vehicle type classification + License plate detection
- **Professional Dashboard**: shadcn/ui components with dark/light mode
- **Confidence Tracking**: Separate metrics for bbox, OCR, and vehicle detection
- **Debug Tools**: OCR-ready image exports for pipeline inspection

---

## 🛠️ Tech Stack

### Backend
- **FastAPI** - High-performance async API
- **YOLOv8** - Vehicle & plate detection models
- **EasyOCR** - Text recognition with GPU support
- **PostgreSQL** - Relational database
- **OpenCV + FFmpeg** - Video processing & H.264 encoding

### Frontend
- **Next.js 16** + **React 19**
- **TypeScript** - Type-safe development
- **shadcn/ui** - Modern component library
- **Tailwind CSS v4** - Utility-first styling

---

## 📦 Installation

### Prerequisites
- Python 3.10+
- Node.js 18+
- Docker & Docker Compose
- FFmpeg (for video encoding)

### Setup

```bash
# 1. Clone repository
git clone <your-repo-url>
cd "IIT Bombay/ANRP Project"

# 2. Start PostgreSQL
docker compose up -d

# 3. Backend setup
cd backend
python -m venv venv
./venv/bin/activate  # Windows/Mac
pip install -r requirements.txt

# 4. Frontend setup
cd ../frontend
npm install
```

---

## 🚀 Usage

### Start Backend
```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Start Frontend
```bash
cd frontend
npm run dev
```

### Access Application
- **Frontend**: http://localhost:3000
- **API Docs**: http://localhost:8000/docs

---

## 📊 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/upload-video` | Upload video for processing |
| `GET` | `/job/{job_id}` | Check job status |
| `GET` | `/job/{job_id}/results` | Retrieve detection results |

---

## 🎨 Features Breakdown

### Video Processing Pipeline
1. **Vehicle Detection** (Blue bounding boxes)
2. **Plate Detection** (Green bounding boxes)
3. **OCR Extraction** (EasyOCR with preprocessing)
4. **Spatial Matching** (Plate-to-vehicle association)
5. **H.264 Encoding** (Browser-compatible video output)

### Results Display
- Vehicle crop images
- Plate crop images
- OCR text with confidence scores
- Vehicle type classification
- Annotated video playback

---

## 📁 Project Structure

```
.
├── backend/
│   ├── app/
│   │   ├── ai/              # ML models & pipeline
│   │   ├── api/             # FastAPI routes
│   │   ├── db/              # Database models
│   │   └── main.py          # App entry point
│   ├── media/               # Runtime storage
│   │   ├── videos/          # Uploaded videos
│   │   ├── outputs/         # Cropped images
│   │   ├── processed/       # Annotated videos
│   │   └── debug/           # OCR preprocessing
│   └── models/              # YOLO weights
├── frontend/
│   ├── app/                 # Next.js pages
│   ├── components/ui/       # shadcn components
│   └── lib/                 # API client
└── docker-compose.yml       # PostgreSQL setup
```

---

## 🔧 Configuration

### Environment Variables (Optional)
```env
# Backend
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/anpr_db
MIN_OCR_CONFIDENCE=0.6

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## 🎯 Key Algorithms

- **Vehicle-Plate Matching**: Spatial containment (bbox intersection)
- **OCR Preprocessing**: Grayscale + adaptive thresholding + morphological ops
- **Plate Grouping**: Confidence-based best image selection per unique text
- **Video Encoding**: mp4v → H.264/libx264 conversion for browser compatibility

---

## 🐛 Troubleshooting

**Video won't play in browser?**  
Ensure FFmpeg is installed and accessible in PATH for H.264 conversion.

**No detections appearing?**  
Check `media/debug/` folder for OCR preprocessing outputs.

**Database connection failed?**  
Verify PostgreSQL container is running: `docker compose ps`

