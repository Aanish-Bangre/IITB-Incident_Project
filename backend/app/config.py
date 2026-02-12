import os

OCR_ENGINE = os.getenv("OCR_ENGINE", "easyocr")

USE_GPU = os.getenv("OCR_USE_GPU", "true").lower() == "true"
