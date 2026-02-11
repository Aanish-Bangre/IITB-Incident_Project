import os
import cv2
from app.ai.video import extract_sampled_frames
from app.ai.plate_detector import detect_plates
from app.db.models import Plate


OUTPUT_DIR = "media/outputs"
os.makedirs(OUTPUT_DIR, exist_ok=True)


def run_pipeline(job_id: str, video_path: str, db):
    frames = extract_sampled_frames(video_path, sample_rate=1)

    for frame_idx, frame in enumerate(frames):
        detections = detect_plates(frame)

        for det_idx, det in enumerate(detections):
            x1, y1, x2, y2 = det["bbox"]
            crop = frame[y1:y2, x1:x2]

            output_path = os.path.join(
                OUTPUT_DIR,
                f"{job_id}_frame{frame_idx}_plate{det_idx}.jpg"
            )

            cv2.imwrite(output_path, crop)

            plate_entry = Plate(
                job_id=job_id,
                plate_image_path=output_path,
                confidence=det["confidence"]
            )

            db.add(plate_entry)

    db.commit()
