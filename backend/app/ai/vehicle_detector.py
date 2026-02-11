# from ultralytics import YOLO

# # Load model once (important)
# model = YOLO("models/vehical.pt")


# def detect_vehicles(frame):
#     results = model(frame)

#     detections = []

#     for result in results:
#         boxes = result.boxes

#         for box in boxes:
#             x1, y1, x2, y2 = map(int, box.xyxy[0])
#             conf = float(box.conf[0])
#             cls_id = int(box.cls[0])

#             vehicle_type = model.names[cls_id]

#             detections.append({
#                 "bbox": (x1, y1, x2, y2),
#                 "vehicle_type": vehicle_type,
#                 "confidence": conf
#             })

#     return detections
