# backend/app/ai/pipeline.py

import os
import re
import cv2
import subprocess
from collections import defaultdict

from app.ai.plate_detector import detect_plates
from app.ai.preprocessing import preprocess_plate_for_ocr
from app.ai.ocr import run_easyocr
from app.db.models import Plate, Job


OUTPUT_DIR = "media/outputs"
PROCESSED_DIR = "media/processed"
DEBUG_DIR = "media/debug"

os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(PROCESSED_DIR, exist_ok=True)
os.makedirs(DEBUG_DIR, exist_ok=True)

MIN_OCR_CONF = 0.6


def run_pipeline(job_id: str, video_path: str, db):

    cap = cv2.VideoCapture(video_path)

    if not cap.isOpened():
        raise Exception("Error opening video file")

    fps = cap.get(cv2.CAP_PROP_FPS)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    print(f"[DEBUG] Video properties - FPS: {fps}, Width: {width}, Height: {height}")

    # Use mp4v codec (reliable, will be converted by FFmpeg later)
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    output_video_path = f"{PROCESSED_DIR}/{job_id}_processed.mp4"

    out = cv2.VideoWriter(output_video_path, fourcc, fps, (width, height))
    
    if not out.isOpened():
        raise Exception(f"Failed to create VideoWriter with codec mp4v")

    grouped = defaultdict(list)
    frame_count = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        
        frame_count += 1

        detections = detect_plates(frame)

        for det in detections:
            x1, y1, x2, y2 = det["bbox"]
            det_conf = det.get("confidence", 0.0)

            # Always draw detection box (like the test script)
            cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 3)

            # Try OCR
            ocr_ready, raw_crop = preprocess_plate_for_ocr(
                frame,
                [x1, y1, x2, y2]
            )

            display_text = "Plate"  # Default fallback
            ocr_success = False

            if ocr_ready is not None:
                # Save OCR ready image to debug folder
                debug_filename = f"{DEBUG_DIR}/{job_id}_frame{frame_count}_det{det_conf:.2f}.jpg"
                cv2.imwrite(debug_filename, ocr_ready)
                
                ocr_results = run_easyocr(ocr_ready)
                
                if ocr_results:
                    best = max(ocr_results, key=lambda x: x["confidence"])
                    raw_text = best["text"]
                    conf = best["confidence"]

                    if conf >= MIN_OCR_CONF:
                        # Normalize text (safe DB value)
                        text = re.sub(r'[^A-Z0-9]', '', raw_text.upper())
                        
                        if text:
                            display_text = text
                            ocr_success = True

                            grouped[text].append({
                                "confidence": conf,
                                "bbox_confidence": det_conf,
                                "image": raw_crop
                            })

            # Draw text overlay (OCR result or "Plate")
            cv2.putText(
                frame,
                display_text,
                (x1, max(y1 - 10, 0)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (0, 255, 0),
                2
            )

        out.write(frame)

    cap.release()
    out.release()

    print(f"[DEBUG] Video written to: {output_video_path}")
    print(f"[DEBUG] File size: {os.path.getsize(output_video_path) if os.path.exists(output_video_path) else 'FILE NOT FOUND'}")

    # Re-encode with FFmpeg for browser compatibility (if available)
    final_output_path = output_video_path
    
    if not os.path.exists(output_video_path) or os.path.getsize(output_video_path) == 0:
        raise Exception(f"VideoWriter failed to create output file: {output_video_path}")
    
    try:
        temp_path = f"{PROCESSED_DIR}/{job_id}_temp.mp4"
        os.rename(output_video_path, temp_path)
        
        # Hardcoded FFmpeg path (WinGet installation)
        FFMPEG_PATH = r"C:\Users\aanis\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.0.1-full_build\bin\ffmpeg.exe"
        
        # Use FFmpeg to convert to H.264
        result = subprocess.run([
            FFMPEG_PATH, "-i", temp_path,
            "-c:v", "libx264", "-preset", "fast",
            "-crf", "23", "-pix_fmt", "yuv420p",
            final_output_path, "-y"
        ], capture_output=True, text=True)
        
        if result.returncode != 0:
            print(f"[ERROR] FFmpeg failed: {result.stderr}")
            # Restore original file
            if os.path.exists(temp_path):
                os.rename(temp_path, output_video_path)
            print("Warning: FFmpeg conversion failed. Using original video.")
        else:
            if os.path.exists(temp_path):
                os.remove(temp_path)
            print(f"[SUCCESS] FFmpeg conversion complete: {final_output_path}")
            
    except FileNotFoundError as e:
        # FFmpeg not available, restore temp file if it exists
        if 'temp_path' in locals() and os.path.exists(temp_path):
            os.rename(temp_path, output_video_path)
        print(f"Warning: FFmpeg not available: {e}. Using original video.")
    except Exception as e:
        # Any other error, restore original if temp exists
        if 'temp_path' in locals() and os.path.exists(temp_path):
            os.rename(temp_path, output_video_path)
        print(f"Warning: FFmpeg error: {e}. Using original video.")

    # 🔥 Save processed video path in DB (without 'media/' prefix for /media mount)
    job = db.query(Job).filter(Job.job_id == job_id).first()
    if job:
        # Store path relative to media directory
        job.processed_video_path = final_output_path.replace("media/", "", 1)
        db.commit()

    # 🔥 Insert final unique plates
    for plate_text, entries in grouped.items():
        best_entry = max(entries, key=lambda x: x["confidence"])

        # Safe filename
        safe_text = re.sub(r'[^A-Z0-9]', '', plate_text)

        output_path = f"{OUTPUT_DIR}/{job_id}_{safe_text}.jpg"
        cv2.imwrite(output_path, best_entry["image"])

        final_plate = Plate(
            job_id=job_id,
            plate_text=plate_text,
            best_confidence=best_entry["confidence"],
            bbox_confidence=best_entry.get("bbox_confidence", 0.0),
            # Store path relative to media directory
            best_image_path=output_path.replace("media/", "", 1)
        )

        db.add(final_plate)

    db.commit()
