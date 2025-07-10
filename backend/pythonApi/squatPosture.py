import cv2
import mediapipe as mp
import math

mp_pose = mp.solutions.pose
pose = mp_pose.Pose()
mp_drawing = mp.solutions.drawing_utils

def calculate_angle(a, b, c):
    a = [a.x, a.y]
    b = [b.x, b.y]
    c = [c.x, c.y]
    radians = math.atan2(c[1]-b[1], c[0]-b[0]) - math.atan2(a[1]-b[1], a[0]-b[0])
    angle = abs(radians * 180.0 / math.pi)
    return 360 - angle if angle > 180 else angle

def analyze_squat(frame):
    result = pose.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
    feedback = []

    if result.pose_landmarks:
        landmarks = result.pose_landmarks.landmark
        knee = landmarks[mp_pose.PoseLandmark.LEFT_KNEE]
        ankle = landmarks[mp_pose.PoseLandmark.LEFT_ANKLE]
        hip = landmarks[mp_pose.PoseLandmark.LEFT_HIP]
        shoulder = landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER]

        if knee.x > ankle.x:
            feedback.append("Knee goes beyond toe (incorrect form)")

        back_angle = calculate_angle(shoulder, hip, knee)
        if back_angle < 150:
            feedback.append(f"Back too bent: {int(back_angle)}°")

        mp_drawing.draw_landmarks(frame, result.pose_landmarks, mp_pose.POSE_CONNECTIONS)

    return frame, feedback
