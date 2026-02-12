import easyocr
import torch
from app.config import USE_GPU

# Detect GPU availability
gpu_available = torch.cuda.is_available()

reader = easyocr.Reader(
    ['en'],
    gpu=(USE_GPU and gpu_available)
)

print("OCR running on:", "GPU" if (USE_GPU and gpu_available) else "CPU")


def run_easyocr(ocr_img):
    results = reader.readtext(ocr_img, detail=1, paragraph=False)

    outputs = []

    for _, text, conf in results:
        clean_text = text.strip().replace(" ", "").replace("\n", "")

        outputs.append({
            "text": clean_text,
            "confidence": float(conf)
        })

    return outputs
