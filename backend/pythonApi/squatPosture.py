import cv2
import mediapipe as mp
import math

# Initialize MediaPipe
mp_pose = mp.solutions.pose
pose = mp_pose.Pose(min_detection_confidence=0.5, min_tracking_confidence=0.5)
mp_drawing = mp.solutions.drawing_utils

# Helper function to calculate angle
def calculate_angle(a, b, c):
    a = [a.x, a.y]
    b = [b.x, b.y]
    c = [c.x, c.y]
    radians = math.atan2(c[1]-b[1], c[0]-b[0]) - math.atan2(a[1]-b[1], a[0]-b[0])
    angle = abs(radians * 180.0 / math.pi)
    return 360 - angle if angle > 180 else angle

# Helper to check visibility
def is_visible(landmark, threshold=0.5):
    return landmark.visibility > threshold

# Main squat analysis function
def analyze_squat(frame):
    result = pose.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
    feedback = []

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
        feedback.append("Key body parts not detected")

    return frame, feedback
