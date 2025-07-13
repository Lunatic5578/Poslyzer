import cv2
import mediapipe as mp
import math
import os

# Suppress warnings from TensorFlow/MediaPipe
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

# Setup MediaPipe Pose model
mp_pose = mp.solutions.pose
mp_drawing = mp.solutions.drawing_utils
pose = mp_pose.Pose(
    static_image_mode=True,
    model_complexity=1,
    enable_segmentation=False,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)

def calculate_angle(a, b, c):
    """Calculate angle at point b formed by segments ab and bc."""
    if not all([a, b, c]):
        return None
    try:
        a = [a.x, a.y]
        b = [b.x, b.y]
        c = [c.x, c.y]
        angle = math.degrees(
            math.atan2(c[1] - b[1], c[0] - b[0]) -
            math.atan2(a[1] - b[1], a[0] - b[0])
        )
        angle = abs(angle)
        return angle if angle <= 180 else 360 - angle
    except Exception:
        return None

def is_visible(landmark, threshold=0.5):
    """Check if a landmark is reliably visible."""
    return landmark and hasattr(landmark, 'visibility') and landmark.visibility > threshold

def analyze_squat(frame):
    feedback = []

    if frame is None or not hasattr(frame, 'size') or frame.size == 0:
        return frame, ["Invalid or empty frame received"]

    try:
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        result = pose.process(rgb_frame)

        if not result.pose_landmarks:
            return frame, ["Pose landmarks not detected"]

        landmarks = result.pose_landmarks.landmark

        try:
            lk = landmarks[mp_pose.PoseLandmark.LEFT_KNEE]
            la = landmarks[mp_pose.PoseLandmark.LEFT_ANKLE]
            lh = landmarks[mp_pose.PoseLandmark.LEFT_HIP]
            ls = landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER]
            lf = landmarks[mp_pose.PoseLandmark.LEFT_FOOT_INDEX]
        except IndexError:
            return frame, ["Incomplete landmark data received"]

        keypoints = [lk, la, lh, ls, lf]
        if not all(is_visible(kp) for kp in keypoints):
            return frame, ["Ensure full body is visible in frame"]

        knee_toe_angle = calculate_angle(la, lk, lf)
        if knee_toe_angle and knee_toe_angle < 150:
            feedback.append(f"Knee goes beyond toe: {int(knee_toe_angle)}°")

        back_angle = calculate_angle(ls, lh, lk)
        if back_angle and back_angle < 150:
            feedback.append(f"Back too bent: {int(back_angle)}°")

        mp_drawing.draw_landmarks(frame, result.pose_landmarks, mp_pose.POSE_CONNECTIONS)

    except Exception as e:
        feedback.append(f"Analysis failed: {str(e)}")

    return frame, feedback