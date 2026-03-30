# 🚗 ANRP - Automatic Number Plate Recognition System

> Professional-grade vehicle tracking and license plate recognition system with **ROI filtering**, **line crossing detection**, and **Indian plate validation** powered by YOLOv8, EasyOCR, and advanced tracking algorithms.

[![Python](https://img.shields.io/badge/Python-3.12-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688.svg)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js-16.1-black.svg)](https://nextjs.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 📋 Table of Contents

- [Features](#-features)
- [System Architecture](#-system-architecture)
- [Tech Stack](#-tech-stack)
- [Installation](#-installation)
- [Usage](#-usage)
- [API Documentation](#-api-documentation)
- [Project Structure](#-project-structure)
- [Advanced Features](#-advanced-features)
- [Configuration](#-configuration)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)

---

## ✨ Features

### Core Capabilities
- 🎯 **Multi-Stage Detection Pipeline**
  - YOLOv8 vehicle detection (car, bus, truck, motorcycle)
  - YOLOv8 license plate detection
  - EasyOCR text extraction with GPU acceleration
  
- 🔍 **Advanced Tracking System**
  - Hungarian algorithm-based vehicle tracking
  - Persistent track IDs across frames
  - Occlusion handling (30-frame buffer)
  - ROI (Region of Interest) filtering
  - Line crossing detection and counting
  
- ✅ **Indian Number Plate Validation**
  - Format: `MH12AB1234` (State code + District + Series + Number)
  - Automatic text normalization
  - Regex-based validation
  
- 🎨 **Professional Web Interface**
  - Dark/Light mode support
  - Real-time job status tracking
  - ROI polygon selection (interactive canvas)
  - Counting line placement
  - Processed video playback
  - Comprehensive results table with track IDs
  - Historical results viewer

### Processing Features
- 📹 Video processing with frame-by-frame analysis
- 🖼️ Advanced preprocessing (sharpening, denoising, thresholding)
- 📊 Confidence-based best-image selection
- 🎬 H.264 video encoding for browser compatibility
- 🗃️ Database persistence with PostgreSQL
- 📁 Organized media storage (videos, crops, debug images)

---

## 🏗️ System Architecture

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   Frontend  │─────▶│   FastAPI    │─────▶│  PostgreSQL │
│  (Next.js)  │      │   Backend    │      │  (Docker)   │
└─────────────┘      └──────────────┘      └─────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  AI Pipeline    │
                    ├─────────────────┤
                    │ • YOLOv8 Vehicle│
                    │ • YOLOv8 Plate  │
                    │ • EasyOCR       │
                    │ • Tracker       │
                    │ • ROI Filter    │
                    │ • Line Counter  │
                    └─────────────────┘
```

### Processing Workflow

```
1. Upload Video → 2. ROI Selection → 3. Line Placement
        ↓                                      ↓
4. Vehicle Detection → 5. Tracking → 6. ROI Filtering
        ↓                                      ↓
7. Line Crossing Check → 8. Plate Detection (crossed only)
        ↓                                      ↓
9. OCR + Validation → 10. Database Storage → 11. Results Display
```

---

## 🛠️ Tech Stack

### Backend
| Technology | Purpose | Version |
|------------|---------|---------|
| **FastAPI** | REST API framework | Latest |
| **SQLAlchemy** | ORM & database management | Latest |
| **PostgreSQL** | Relational database | 15 |
| **YOLOv11** (Ultralytics) | Object detection | Latest |
| **EasyOCR** | Text recognition | Latest |
| **OpenCV** | Image processing | Latest |
| **FFmpeg** | Video encoding | System |
| **NumPy + SciPy** | Numerical computing | Latest |

### Frontend
| Technology | Purpose | Version |
|------------|---------|---------|
| **Next.js** | React framework | 16.1.6 |
| **React** | UI library | 19.2.3 |
| **TypeScript** | Type safety | Latest |
| **shadcn/ui** | Component library | Latest |
| **Tailwind CSS** | Styling framework | v4 |
| **Axios** | HTTP client | Latest |
| **Lucide Icons** | Icon library | Latest |

### Infrastructure
- **Docker** - PostgreSQL containerization
- **Docker Compose** - Multi-container orchestration

---

## 📦 Installation

### Prerequisites

```bash
# Required
- Python 3.10+ (with pip/uv)
- Node.js 18+ (with npm)
- Docker & Docker Compose
- FFmpeg (for video encoding)
- CUDA (optional, for GPU acceleration)

# Verify installations
python --version
node --version
docker --version
ffmpeg -version
```

### Quick Start

```bash
# 1. Clone repository
git clone <repository-url>
cd "IIT Bombay/ANRP Project"

# 2. Start PostgreSQL database
docker compose up -d

# 3. Backend setup
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
# or using uv (faster)
uv pip install -r requirements.txt

# 4. Frontend setup
cd ../frontend
npm install

# 5. Place YOLO models
# Place your trained models in backend/models/
# - vehicle.pt (vehicle detection model)
# - no_plate.pt (number plate detection model)
```

---

## 🚀 Usage

### Starting the Application

**Terminal 1 - Backend:**
```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

**Terminal 3 - Database (if not using Docker):**
```bash
docker compose up
```

### Access Points

| Service | URL | Purpose |
|---------|-----|---------|
| **Frontend** | http://localhost:3000 | Main application UI |
| **API Docs** | http://localhost:8000/docs | Interactive API documentation |
| **ReDoc** | http://localhost:8000/redoc | Alternative API docs |
| **Health Check** | http://localhost:8000/health | Backend status |

### Using the Application

1. **Upload Video**
   - Navigate to Dashboard (http://localhost:3000)
   - Click "Choose File" and select a video
   - Click "Upload and Process"

1. **Or Use RTSP Camera (Real-Time)**
  - Open Tracker page (http://localhost:3000/tracker)
  - Switch source to **RTSP Camera**
  - Enter camera IP, username, password, and path (e.g. `/h264`)
  - Click **Connect Camera & Start Setup**
  - Select ROI + line and start live processing

2. **Configure ROI & Line** (Optional)
   - After upload, click on video frame to draw ROI polygon
   - Complete polygon, then draw counting line
   - Or click "Skip" to process entire frame

3. **Monitor Progress**
   - Watch real-time status updates
   - Status: uploading → uploaded → pending → processing → completed

4. **View Results**
   - Processed video with annotations
   - Detection table with:
     - Vehicle & plate crops
     - OCR text with confidence scores
     - Vehicle type classification
     - Track IDs
     - Confidence percentages

5. **Access History**
   - Click "Results" in sidebar
   - View all past jobs
   - Click "View Results" on completed jobs

---

## 📡 API Documentation

### Endpoints

#### Create Camera Job
```http
POST /camera-job/create
Content-Type: application/json

{
  "username": "gpatil",
  "password": "gpatil@2026",
  "ip_address": "10.162.1.182",
  "path": "/h264"
}
```

#### Camera First Frame
```http
GET /camera-job/{job_id}/first-frame
```

#### Start Camera Processing
```http
POST /camera-job/{job_id}/start
Content-Type: application/json

{
  "roi_coords": [[100, 100], [800, 100], [800, 600], [100, 600]],
  "line_coords": [200, 350, 900, 350],
  "line_distance_meters": 8.0
}
```

#### Stop Camera Processing
```http
POST /camera-job/{job_id}/stop
```

#### Get Live Annotated Frame
```http
GET /camera-job/{job_id}/live-frame
```

#### Upload Video
```http
POST /upload-video
Content-Type: multipart/form-data

file: <video_file>

Response:
{
  "job_id": "uuid",
  "status": "uploaded"
}
```

#### Get First Frame (for ROI selection)
```http
GET /job/{job_id}/first-frame

Response: JPEG image (binary)
```

#### Set ROI & Line Coordinates
```http
POST /job/set-roi-line
Content-Type: application/json

{
  "job_id": "uuid",
  "roi_coords": [[x1,y1], [x2,y2], ...],  // polygon points (optional)
  "line_coords": [x1, y1, x2, y2]         // line endpoints (optional)
}

Response:
{
  "job_id": "uuid",
  "status": "pending"
}
```

#### Check Job Status
```http
GET /job/{job_id}

Response:
{
  "job_id": "uuid",
  "status": "processing",
  "video_path": "media/videos/uuid.mp4"
}
```

#### Get Results
```http
GET /job/{job_id}/results

Response:
{
  "job_id": "uuid",
  "status": "completed",
  "processed_video": "media/processed/uuid_final.mp4",
  "total_plates": 5,
  "plates": [
    {
      "plate_text": "MH12AB1234",
      "confidence": 0.92,
      "bbox_confidence": 0.87,
      "image_path": "media/outputs/...",
      "vehicle_type": "car",
      "vehicle_confidence": 0.95,
      "vehicle_image_path": "media/outputs/...",
      "track_id": 3,
      "frame_number": 145
    }
  ]
}
```

#### List All Jobs
```http
GET /jobs

Response:
{
  "total": 10,
  "jobs": [
    {
      "job_id": "uuid",
      "status": "completed",
      "video_path": "media/videos/uuid.mp4",
      "processed_video_path": "media/processed/uuid_final.mp4",
      "created_at": "2026-02-16T10:30:00",
      "roi_coords": "[[x1,y1],...]",
      "line_coords": "[x1,y1,x2,y2]"
    }
  ]
}
```

---

## 📁 Project Structure

```
ANRP-Project/
│
├── backend/                      # FastAPI backend
│   ├── app/
│   │   ├── main.py              # Application entry point
│   │   ├── config.py            # Configuration (GPU settings)
│   │   │
│   │   ├── api/                 # API layer
│   │   │   └── routes.py        # REST endpoints
│   │   │
│   │   ├── db/                  # Database layer
│   │   │   ├── database.py      # SQLAlchemy setup
│   │   │   └── models.py        # Job & Plate models
│   │   │
│   │   ├── ai/                  # AI/ML pipeline
│   │   │   ├── vehicle_detector.py      # YOLOv8 vehicle detection
│   │   │   ├── plate_detector.py        # YOLOv8 plate detection
│   │   │   ├── ocr.py                   # EasyOCR integration
│   │   │   ├── preprocessing.py         # Image preprocessing
│   │   │   ├── tracker.py               # Vehicle tracking (Hungarian)
│   │   │   ├── pipeline_with_tracking.py # Main processing pipeline
│   │   │   ├── pipeline.py              # Basic pipeline (no tracking)
│   │   │   ├── utils.py                 # Plate validation
│   │   │   └── video.py                 # Video utilities
│   │   │
│   │   └── services/            # Business logic
│   │       ├── job_manager.py   # Job orchestration
│   │       └── storage.py       # File storage
│   │
│   ├── media/                   # Runtime storage (gitignored)
│   │   ├── videos/              # Uploaded videos
│   │   ├── frames/              # Extracted frames
│   │   ├── outputs/             # Cropped images (vehicles & plates)
│   │   ├── processed/           # Annotated videos
│   │   └── debug/               # OCR preprocessing outputs
│   │
│   ├── models/                  # YOLO model weights
│   │   ├── vehicle.pt           # Vehicle detection model
│   │   └── no_plate.pt          # Plate detection model
│   │
│   └── requirements.txt         # Python dependencies
│
├── frontend/                    # Next.js frontend
│   ├── app/
│   │   ├── layout.tsx           # Root layout
│   │   ├── page.tsx             # Dashboard page
│   │   ├── results/
│   │   │   └── page.tsx         # Results history page
│   │   └── globals.css          # Global styles
│   │
│   ├── components/
│   │   ├── ROILineSelector.tsx # Canvas-based ROI/line selector
│   │   └── ui/                  # shadcn/ui components
│   │       ├── alert.tsx
│   │       ├── badge.tsx
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── input.tsx
│   │       ├── progress.tsx
│   │       ├── sidebar.tsx
│   │       ├── table.tsx
│   │       └── ...
│   │
│   ├── lib/
│   │   ├── api.ts               # Axios API client
│   │   └── utils.ts             # Utility functions (cn helper)
│   │
│   ├── hooks/
│   │   └── use-mobile.ts        # Responsive hook
│   │
│   ├── package.json             # Node dependencies
│   └── next.config.ts           # Next.js configuration
│
├── docker-compose.yml           # PostgreSQL setup
├── .gitignore                   # Git ignore rules
└── README.md                    # This file
```

---

## 🚀 Advanced Features

### 1. Vehicle Tracking

**Algorithm:** Hungarian Algorithm (scipy.optimize.linear_sum_assignment)

- Assigns unique Track IDs to vehicles across frames
- Maintains ID even if vehicle temporarily disappears (30 frames)
- Matches detections based on centroid distance (threshold: 80 pixels)
- Stores track history for line crossing detection

**Classes:**
- `VehicleTracker` - Main tracking logic
- `TrackState` - Individual vehicle state
- `LineCrossCounter` - Line crossing detection using cross products

### 2. ROI (Region of Interest) Filtering

- User draws polygon on first frame
- `cv2.pointPolygonTest` for point-in-polygon checking
- Only vehicles with centroids inside ROI are processed
- Reduces false positives from background

### 3. Line Crossing Detection

- User draws counting line across traffic flow
- Uses cross product to determine which side of line
- Detects when vehicle crosses from one side to other
- Prevents double counting with `counted_ids` set
- Filters database to only include crossed vehicles

### 4. OCR Preprocessing Pipeline

**Multi-stage enhancement for blurry plates:**

1. **Crop** - Extract plate region with zero padding
2. **Upscale 4x** - Cubic interpolation for detail recovery
3. **Laplacian Sharpening** - Unblur characters (80% sharp + 20% original)
4. **Grayscale Conversion**
5. **Bilateral Filtering** - Denoise while preserving edges
6. **Adaptive Thresholding** - Binarization for OCR
7. **Contour Filtering** - Remove noise based on aspect ratio
8. **Inversion** - Black text on white background for EasyOCR

### 5. Indian Plate Validation

**Format:** `^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$`

Examples:
- ✅ `MH12AB1234` (Maharashtra, Mumbai)
- ✅ `DL01CA9999` (Delhi)
- ✅ `KA03MH1234` (Karnataka, Bangalore)
- ❌ `12MH1234` (invalid - starts with number)
- ❌ `MH121234` (invalid - missing letters)

Functions:
- `normalize_plate(text)` - Clean and uppercase
- `is_valid_plate(text)` - Regex validation

---

## ⚙️ Configuration

### Backend Configuration

**Environment Variables** (optional - defaults provided):
```bash
# backend/.env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/anpr_db
USE_GPU=true                    # Enable GPU for YOLOv8 & EasyOCR
MIN_OCR_CONF=0.45              # Minimum OCR confidence threshold
DEBUG_OCR=true                  # Enable OCR debug logging
```

**app/config.py:**
```python
USE_GPU = True  # Set to False for CPU-only mode
```

### Frontend Configuration

**API Base URL:**
```typescript
// lib/api.ts
const API = axios.create({
  baseURL: "http://localhost:8000",
});
```

### Database Configuration

**docker-compose.yml:**
```yaml
environment:
  POSTGRES_USER: postgres
  POSTGRES_PASSWORD: postgres
  POSTGRES_DB: anpr_db
ports:
  - "5432:5432"
```

### Model Configuration

**Place custom models:**
```bash
backend/models/
├── vehicle.pt    # Your trained vehicle detection model
└── no_plate.pt   # Your trained plate detection model
```

---

## 🐛 Troubleshooting

### Common Issues

#### 1. **Video won't play in browser**
```bash
# Ensure FFmpeg is installed
ffmpeg -version

# Windows (Chocolatey)
choco install ffmpeg

# macOS (Homebrew)
brew install ffmpeg

# Ubuntu/Debian
sudo apt install ffmpeg
```

#### 2. **No detections appearing**
- Check `backend/media/debug/` for OCR preprocessing outputs
- Lower `MIN_OCR_CONF` threshold (default: 0.45)
- Verify YOLO models are in `backend/models/`
- Check console for "[DEBUG] Track X Frame Y: OCR too low" messages

#### 3. **Database connection failed**
```bash
# Check if PostgreSQL container is running
docker compose ps

# View logs
docker compose logs db

# Restart database
docker compose down
docker compose up -d
```

#### 4. **GPU not being used**
```bash
# Check CUDA installation
nvidia-smi

# Verify PyTorch CUDA
python -c "import torch; print(torch.cuda.is_available())"

# Backend will print on startup:
# "OCR running on: GPU" or "OCR running on: CPU"
```

#### 5. **Frontend can't connect to backend**
- Verify backend is running on port 8000
- Check CORS settings in `backend/app/main.py`
- Ensure `http://localhost:3000` is in allowed origins

#### 6. **Module not found errors**
```bash
# Reinstall backend dependencies
cd backend
pip install -r requirements.txt --force-reinstall

# Reinstall frontend dependencies
cd frontend
rm -rf node_modules package-lock.json
npm install
```

---

## 📊 Performance Tips

### For Better Tracking
- Keep vehicles in frame for at least 2-3 seconds
- Avoid sudden camera movements
- Ensure good lighting conditions
- Place counting line perpendicular to traffic flow

### For Better OCR
- Upload high-resolution videos (720p minimum)
- Ensure plates are clearly visible
- Avoid extreme angles or motion blur
- Good contrast between plate and background

### System Optimization
- Use GPU for 10-20x faster processing
- Process shorter videos in chunks
- Clean up `media/` folders periodically
- Use SSD for faster I/O

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **YOLOv8** by Ultralytics
- **EasyOCR** by JaidedAI
- **shadcn/ui** components
- **FastAPI** framework
- **Next.js** team

---

## 📞 Support

For issues, questions, or contributions:
- Open an issue on GitHub
- Contact: [Your Email]
- Project Link: [Repository URL]

---

**Built with ❤️ for IIT Bombay ANRP Project**