import cv2
import numpy as np

def preprocess_plate_for_ocr(img, bbox, upscale_factor=4):
    """
    Advanced Multi-Scale Sharpening for '10/10' Unblurring.
    Keeps your existing isolation logic intact.
    """
    x1, y1, x2, y2 = map(int, bbox[:4])
    h_orig, w_orig = img.shape[:2]

    # 1. Precise Crop (0 padding)
    crop = img[max(0, y1):min(h_orig, y2), max(0, x1):min(w_orig, x2)]

    if crop is None or crop.size == 0:
        return None, None

    # 2. High-Quality Upscale (Cubic interpolation is essential for blur recovery)
    scaled = cv2.resize(crop, None, fx=upscale_factor, fy=upscale_factor,
                        interpolation=cv2.INTER_CUBIC)

    # --- START ADVANCED UNBLUR SECTION ---
    # Convert to float for high-precision math to avoid clipping artifacts
    img_float = scaled.astype(np.float32) / 255.0

    # Multi-Scale Laplacian Sharpening
    # This kernel targets the core 'fuzziness' of the characters
    kernel = np.array([
        [-1, -1, -1],
        [-1,  9, -1],
        [-1, -1, -1]
    ], dtype=np.float32)

    # Apply sharpening
    sharpened = cv2.filter2D(img_float, -1, kernel)

    # Blend original and sharpened to prevent "ringing" artifacts (halos)
    # 0.8 weight on sharpened + 0.2 on original keeps it natural but crisp
    unblurred_float = cv2.addWeighted(img_float, 0.2, sharpened, 0.8, 0)

    # Convert back to uint8
    unblurred = np.clip(unblurred_float * 255, 0, 255).astype(np.uint8)
    # --- END ADVANCED UNBLUR SECTION ---

    # 3. Rest of your 10/10 Preprocessing (Grayscale, Denoise, Threshold)
    gray = cv2.cvtColor(unblurred, cv2.COLOR_BGR2GRAY)

    # Bilateral is key here: it protects the sharp edges we just made
    denoised = cv2.bilateralFilter(gray, 9, 75, 75)

    # Standard Adaptive Threshold
    thresh = cv2.adaptiveThreshold(denoised, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                   cv2.THRESH_BINARY_INV, 21, 10)

    # 4. Your existing Contour Filtering (Secret Sauce)
    cnts, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    mask = np.zeros(thresh.shape, dtype="uint8")

    img_h, img_w = thresh.shape
    char_found = False
    for c in cnts:
        x, y, w, h = cv2.boundingRect(c)
        aspect_ratio = w / float(h)
        # Keep your existing logic for height/width/aspect ratio
        if (w < img_w * 0.7) and (img_h * 0.15 < h < img_h * 0.9) and (0.1 < aspect_ratio < 1.1):
            cv2.drawContours(mask, [c], -1, 255, -1)
            char_found = True

    if char_found:
        cleaned = cv2.bitwise_and(thresh, thresh, mask=mask)
    else:
        cleaned = thresh

    ocr_ready = cv2.bitwise_not(cleaned)
    return ocr_ready, crop