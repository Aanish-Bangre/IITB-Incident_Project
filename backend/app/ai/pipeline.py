import os
import cv2
from app.ai.video import extract_sampled_frames
from app.ai.plate_detector import detect_plates
from app.ai.preprocessing import preprocess_plate_for_ocr
from app.ai.ocr import run_easyocr
from app.db.models import Plate
from collections import defaultdict
# from app.ai.utils import normalize_plate, is_valid_plate

OUTPUT_DIR = "media/outputs"
os.makedirs(OUTPUT_DIR, exist_ok=True)
MIN_OCR_CONF = 0.6

def run_pipeline(job_id: str, video_path: str, db):

    frames = extract_sampled_frames(video_path, sample_rate=1)

    grouped = defaultdict(list)

    for frame_idx, frame in enumerate(frames):
        detections = detect_plates(frame)

        for det_idx, det in enumerate(detections):
            x1, y1, x2, y2 = det["bbox"]

            ocr_ready, raw_crop = preprocess_plate_for_ocr(
                frame,
                [x1, y1, x2, y2]
            )

            if ocr_ready is None:
                continue

            ocr_results = run_easyocr(ocr_ready)

            if not ocr_results:
                continue

            best = max(ocr_results, key=lambda x: x["confidence"])

            text = best["text"]
            conf = best["confidence"]

            if text:
                grouped[text].append({
                    "confidence": conf,
                    "image": raw_crop
                })

    # 🔥 Now insert only final results
    for plate_text, entries in grouped.items():
        best_entry = max(entries, key=lambda x: x["confidence"])

        output_path = f"media/outputs/{job_id}_{plate_text}.jpg"
        cv2.imwrite(output_path, best_entry["image"])

        final_plate = Plate(
            job_id=job_id,
            plate_text=plate_text,
            best_confidence=best_entry["confidence"],
            best_image_path=output_path
        )

        db.add(final_plate)

    db.commit()