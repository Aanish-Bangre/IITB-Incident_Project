from ultralytics import YOLO

# Load plate detection model
model = YOLO("models/no_plate.pt")


def detect_plates(frame):
    results = model(frame)

    detections = []

    for result in results:
        boxes = result.boxes

        for box in boxes:
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            conf = float(box.conf[0])

            detections.append({
                "bbox": (x1, y1, x2, y2),
                "confidence": conf
            })

    return detections
