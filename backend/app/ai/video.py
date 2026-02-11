import cv2


def extract_sampled_frames(video_path: str, sample_rate: int = 1):
    """
    sample_rate = 1 → 1 frame per second
    """

    cap = cv2.VideoCapture(video_path)

    fps = int(cap.get(cv2.CAP_PROP_FPS))
    frame_interval = fps * sample_rate

    frames = []
    frame_count = 0
    success = True

    while success:
        success, frame = cap.read()

        if not success:
            break

        if frame_count % frame_interval == 0:
            frames.append(frame)

        frame_count += 1

    cap.release()

    return frames
