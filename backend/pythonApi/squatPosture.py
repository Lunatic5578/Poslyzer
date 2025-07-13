import cv2
import mediapipe as mp
import math
import os

# Suppress TensorFlow/MediaPipe warnings
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

# Initialize MediaPipe modules
mp_pose = mp.solutions.pose
mp_drawing = mp.solutions.drawing_utils

# Helper function to calculate angle between three points
def calculate_angle(a, b, c):
    a = [a.x, a.y]
    b = [b.x, b.y]
    c = [c.x, c.y]
    radians = math.atan2(c[1] - b[1], c[0] - b[0]) - math.atan2(a[1] - b[1], a[0] - b[0])
    angle = abs(radians * 180.0 / math.pi)
    return 360 - angle if angle > 180 else angle

# Helper function to check visibility confidence
def is_visible(landmark, threshold=0.5):
    return landmark.visibility > threshold

# Main squat analysis function
def analyze_squat(frame):
    feedback = []

    if frame is None or frame.size == 0:
        return frame, ["Invalid or empty frame received"]

    try:
        # Recreate Pose object inside the function to reset internal state
        with mp_pose.Pose(static_image_mode=False,
                          model_complexity=1,
                          enable_segmentation=False,
                          min_detection_confidence=0.5,
                          min_tracking_confidence=0.5) as pose:

            # Run pose estimation
            result = pose.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))

            if result.pose_landmarks:
                landmarks = result.pose_landmarks.landmark

                # Required landmarks
                left_knee = landmarks[mp_pose.PoseLandmark.LEFT_KNEE]
                left_ankle = landmarks[mp_pose.PoseLandmark.LEFT_ANKLE]
                left_hip = landmarks[mp_pose.PoseLandmark.LEFT_HIP]
                left_shoulder = landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER]
                left_foot = landmarks[mp_pose.PoseLandmark.LEFT_FOOT_INDEX]

                # Visibility check
                keypoints = [left_knee, left_ankle, left_hip, left_shoulder, left_foot]
                if not all(is_visible(kp) for kp in keypoints):
                    feedback.append("Ensure full body is visible in frame")
                    return frame, feedback

                # 1. Knee beyond toe check
                knee_toe_angle = calculate_angle(left_ankle, left_knee, left_foot)
                if knee_toe_angle < 150:
                    feedback.append(f"Knee goes beyond toe: {int(knee_toe_angle)}°")

                # 2. Back angle check
                back_angle = calculate_angle(left_shoulder, left_hip, left_knee)
                if back_angle < 150:
                    feedback.append(f"Back too bent: {int(back_angle)}°")

                # Draw pose landmarks
                mp_drawing.draw_landmarks(frame, result.pose_landmarks, mp_pose.POSE_CONNECTIONS)

            else:
                feedback.append("Pose landmarks not detected")

    except Exception as e:
        feedback.append(f"Analysis failed: {str(e)}")

    return frame, feedback
