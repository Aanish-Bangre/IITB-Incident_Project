# backend/app/ai/pipeline_with_tracking.py

import os
import re
import cv2
import json
import numpy as np
import subprocess
from collections import defaultdict

from app.ai.plate_detector import detect_plates
from app.ai.preprocessing import preprocess_plate_for_ocr
from app.ai.ocr import run_easyocr
from app.db.models import Plate, Job
from app.ai.vehicle_detector import detect_vehicles
from app.ai.tracker import VehicleTracker, LineCrossCounter
from app.ai.utils import normalize_plate, is_valid_plate

OUTPUT_DIR = "media/outputs"
PROCESSED_DIR = "media/processed"
DEBUG_DIR = "media/debug"

os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(PROCESSED_DIR, exist_ok=True)
os.makedirs(DEBUG_DIR, exist_ok=True)

MIN_OCR_CONF = 0.45  # Lowered to capture plates earlier
DEBUG_OCR = True  # Enable OCR debugging


def is_inside(inner, outer):
    """Check if inner bbox is inside outer bbox"""
    ix1, iy1, ix2, iy2 = inner
    ox1, oy1, ox2, oy2 = outer
    return ix1 >= ox1 and iy1 >= oy1 and ix2 <= ox2 and iy2 <= oy2


def point_in_polygon(point, polygon):
    """Check if point is inside polygon (ROI check)"""
    x, y = point
    polygon = np.array(polygon, dtype=np.int32)
    return cv2.pointPolygonTest(polygon, (float(x), float(y)), False) >= 0


def run_pipeline_with_tracking(job_id: str, video_path: str, db):
    """Pipeline with ROI filtering and line crossing detection"""
    
    # Get job to retrieve ROI and line coords
    job = db.query(Job).filter(Job.job_id == job_id).first()
    if not job:
        raise Exception("Job not found")
    
    # Parse ROI and line coordinates
    roi_polygon = None
    if job.roi_coords:
        try:
            roi_polygon = json.loads(job.roi_coords)
        except:
            print("[WARN] Invalid ROI coordinates")
    
    line_counter = None
    if job.line_coords:
        try:
            line_coords = json.loads(job.line_coords)
            if len(line_coords) == 4:
                line_counter = LineCrossCounter(
                    (line_coords[0], line_coords[1]),
                    (line_coords[2], line_coords[3])
                )
        except:
            print("[WARN] Invalid line coordinates")
    
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise Exception("Error opening video file")

    fps = cap.get(cv2.CAP_PROP_FPS)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    
    # Create ROI mask if available
    roi_mask = None
    if roi_polygon:
        roi_mask = np.zeros((height, width), dtype=np.uint8)
        cv2.fillPoly(roi_mask, [np.array(roi_polygon, dtype=np.int32)], 255)

    print(f"[DEBUG] Video properties - FPS: {fps}, Width: {width}, Height: {height}")
    print(f"[DEBUG] ROI: {roi_polygon is not None}, Line: {line_counter is not None}")

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    output_video_path = f"{PROCESSED_DIR}/{job_id}_processed.mp4"
    out = cv2.VideoWriter(output_video_path, fourcc, fps, (width, height))
    
    if not out.isOpened():
        raise Exception(f"Failed to create VideoWriter")

    # Initialize tracker
    tracker = VehicleTracker(max_disappeared=30, max_distance=80)
    
    # Track which vehicles have had plates detected
    tracked_plates = {}  # {track_id: {plate_text: data}}
    grouped = defaultdict(list)
    
    frame_count = 0
    crossed_track_ids = set()  # Track IDs that crossed the line

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        
        frame_count += 1
        display_frame = frame.copy()
        
        # Draw ROI polygon if exists
        if roi_polygon:
            cv2.polylines(display_frame, [np.array(roi_polygon, dtype=np.int32)], 
                         True, (0, 255, 255), 2)
        
        # Draw counting line if exists
        if line_counter:
            cv2.line(display_frame, 
                    tuple(map(int, line_counter.p1)), 
                    tuple(map(int, line_counter.p2)), 
                    (0, 0, 255), 3)

        # Detect vehicles
        vehicle_detections = detect_vehicles(frame)
        
        # Convert to tracker format
        detections_for_tracking = []
        for v in vehicle_detections:
            vx1, vy1, vx2, vy2 = v["bbox"]
            conf = v["confidence"]
            detections_for_tracking.append([vx1, vy1, vx2, vy2, conf, 0])
        
        # Update tracker
        tracked_vehicles = tracker.update(detections_for_tracking)
        
        # Process tracked vehicles
        for tracked in tracked_vehicles:
            vx1, vy1, vx2, vy2, track_id, _ = tracked
            vx1, vy1, vx2, vy2 = map(int, [vx1, vy1, vx2, vy2])
            
            # Get centroid
            cx, cy = (vx1 + vx2) // 2, (vy1 + vy2) // 2
            
            # Check if in ROI
            in_roi = True
            if roi_mask is not None:
                in_roi = roi_mask[cy, cx] > 0
            
            # Check line crossing
            crossed = False
            if line_counter and in_roi:
                prev_centroid = tracker.get_previous_centroid(track_id)
                crossed = line_counter.check_crossing(track_id, (cx, cy), prev_centroid)
                if crossed:
                    crossed_track_ids.add(track_id)
            
            # Only process vehicles that are in ROI (and crossed if line exists)
            should_process = in_roi
            if line_counter:
                should_process = should_process and track_id in crossed_track_ids
            
            # Draw vehicle box
            color = (0, 255, 0) if should_process else (128, 128, 128)
            thickness = 3 if crossed else 2
            cv2.rectangle(display_frame, (vx1, vy1), (vx2, vy2), color, thickness)
            cv2.circle(display_frame, (cx, cy), 5, color, -1)
            
            # Draw track ID
            cv2.putText(display_frame, f"ID:{track_id}", (vx1, max(vy1 - 10, 0)),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
            
            # Crossing highlight
            if crossed:
                cv2.circle(display_frame, (cx, cy), 30, (0, 255, 255), 3)
            
            # Only detect plates for vehicles that should be processed
            if should_process:
                # Crop vehicle region
                vehicle_crop = frame[vy1:vy2, vx1:vx2]
                
                # Detect plates in vehicle region
                plate_detections = detect_plates(vehicle_crop)
                
                for det in plate_detections:
                    px1, py1, px2, py2 = det["bbox"]
                    # Convert to frame coordinates
                    px1 += vx1
                    py1 += vy1
                    px2 += vx1
                    py2 += vy1
                    
                    det_conf = det.get("confidence", 0.0)
                    
                    # Draw plate box
                    cv2.rectangle(display_frame, (px1, py1), (px2, py2), (255, 0, 255), 2)
                    
                    # Try OCR
                    ocr_ready, raw_crop = preprocess_plate_for_ocr(frame, [px1, py1, px2, py2])
                    
                    display_text = f"Plate-{track_id}"
                    
                    if ocr_ready is not None:
                        debug_filename = f"{DEBUG_DIR}/{job_id}_track{track_id}_frame{frame_count}.jpg"
                        cv2.imwrite(debug_filename, ocr_ready)
                        
                        ocr_results = run_easyocr(ocr_ready)
                        
                        if ocr_results:
                            best = max(ocr_results, key=lambda x: x["confidence"])
                            raw_text = best["text"]
                            conf = best["confidence"]
                            
                            if DEBUG_OCR and conf < MIN_OCR_CONF:
                                print(f"[DEBUG] Track {track_id} Frame {frame_count}: OCR too low - '{raw_text}' (conf={conf:.2f}, need {MIN_OCR_CONF})")
                            
                            if conf >= MIN_OCR_CONF:
                                # Normalize and validate plate format
                                text = normalize_plate(raw_text)
                                
                                if text and is_valid_plate(text) and is_valid_plate(text):
                                    display_text = text
                                    
                                    # Store plate info for this track
                                    if track_id not in tracked_plates:
                                        tracked_plates[track_id] = {}
                                    
                                    if text not in tracked_plates[track_id]:
                                        tracked_plates[track_id][text] = []
                                    
                                    # Get vehicle type from original detection
                                    vehicle_type = None
                                    vehicle_conf = None
                                    for v in vehicle_detections:
                                        if is_inside([vx1, vy1, vx2, vy2], v["bbox"]):
                                            vehicle_type = v["label"]
                                            vehicle_conf = v["confidence"]
                                            break
                                    
                                    tracked_plates[track_id][text].append({
                                        "confidence": conf,
                                        "bbox_confidence": det_conf,
                                        "image": raw_crop,
                                        "vehicle_type": vehicle_type,
                                        "vehicle_conf": vehicle_conf,
                                        "vehicle_crop": vehicle_crop.copy(),
                                        "frame_number": frame_count,
                                        "track_id": track_id
                                    })
                                elif DEBUG_OCR:
                                    print(f"[DEBUG] Track {track_id} Frame {frame_count}: Invalid plate format - '{text}' (raw: '{raw_text}')")
                        else:
                            if DEBUG_OCR:
                                print(f"[DEBUG] Track {track_id} Frame {frame_count}: OCR returned no results")
                    else:
                        if DEBUG_OCR:
                            print(f"[DEBUG] Track {track_id} Frame {frame_count}: Preprocessing failed (ocr_ready is None)")
                    
                    # Draw text
                    cv2.putText(display_frame, display_text, (px1, max(py1 - 10, 0)),
                               cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 0, 255), 2)

        out.write(display_frame)

    cap.release()
    out.release()

    print(f"[DEBUG] Tracked {len(tracked_plates)} vehicles with plates")
    print(f"[DEBUG] Total crossed: {len(crossed_track_ids)}")

    # Save only the best detection for each unique plate per track
    for track_id, plates_dict in tracked_plates.items():
        for plate_text, detections_list in plates_dict.items():
            if not detections_list:
                continue
            
            # Get best detection (highest OCR confidence)
            best = max(detections_list, key=lambda x: x["confidence"])
            
            # Save best plate image
            img_filename = f"{OUTPUT_DIR}/{job_id}_{plate_text}_track{track_id}.jpg"
            cv2.imwrite(img_filename, best["image"])
            
            # Save vehicle image if available
            vehicle_img_path = None
            if best["vehicle_crop"] is not None:
                vehicle_img_path = f"{OUTPUT_DIR}/{job_id}_{plate_text}_track{track_id}_vehicle.jpg"
                cv2.imwrite(vehicle_img_path, best["vehicle_crop"])
            
            # Add to database
            new_plate = Plate(
                job_id=job_id,
                plate_text=plate_text,
                best_confidence=best["confidence"],
                bbox_confidence=best["bbox_confidence"],
                best_image_path=img_filename,
                vehicle_type=best["vehicle_type"],
                vehicle_confidence=best["vehicle_conf"],
                vehicle_image_path=vehicle_img_path,
                track_id=track_id,
                frame_number=best["frame_number"],
                crossed_line=1  # Only saved if crossed
            )
            db.add(new_plate)
    
    db.commit()

    # Convert to H.264 for browser compatibility
    final_output = f"{PROCESSED_DIR}/{job_id}_final.mp4"
    try:
        subprocess.run(
            [
                "ffmpeg", "-y",
                "-i", output_video_path,
                "-c:v", "libx264",
                "-preset", "fast",
                "-crf", "23",
                final_output
            ],
            check=True,
            capture_output=True
        )
        job.processed_video_path = final_output
    except:
        print("[WARN] FFmpeg conversion failed, using original")
        job.processed_video_path = output_video_path
    
    db.commit()
    print(f"[INFO] Pipeline complete - saved {len(tracked_plates)} plates")
