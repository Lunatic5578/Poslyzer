import cv2
import mediapipe as mp
import math
import logging
import numpy as np

logger = logging.getLogger(__name__)

# Initialize MediaPipe Pose
mp_pose = mp.solutions.pose
pose = mp_pose.Pose(
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5,
    model_complexity=1
)

def calculate_angle(a, b, c):
    """Calculate the angle at point b between points a, b, and c"""
    try:
        a = np.array([a.x, a.y])
        b = np.array([b.x, b.y])
        c = np.array([c.x, c.y])
        ba = a - b
        bc = c - b
        dot_product = np.dot(ba, bc)
        norm_ba = np.linalg.norm(ba)
        norm_bc = np.linalg.norm(bc)
        if norm_ba < 1e-6 or norm_bc < 1e-6:
            return 0.0
        angle_rad = np.arccos(dot_product / (norm_ba * norm_bc))
        angle_deg = np.degrees(angle_rad)
        return angle_deg
    except Exception as e:
        logger.error(f"Angle calculation error: {str(e)}")
        return 0.0

def calculate_upright_back_angle(shoulder, hip):
    """Calculate how upright the torso is compared to vertical"""
    try:
        vector = np.array([hip.x - shoulder.x, hip.y - shoulder.y])
        vertical = np.array([0, 1])
        norm = np.linalg.norm(vector)
        if norm < 1e-6:
            return 0.0
        dot_product = np.dot(vector, vertical)
        angle_rad = np.arccos(dot_product / norm)
        angle_deg = np.degrees(angle_rad)
        return angle_deg  # 0 = upright
    except Exception as e:
        logger.error(f"Upright back angle error: {str(e)}")
        return 0.0

def get_landmark(landmarks, landmark_id):
    landmark = landmarks[landmark_id]
    return landmark if landmark.visibility > 0.5 else None

def analyze_sitting(frame):
    try:
        if frame is None or frame.size == 0:
            return False, ["Empty frame received"]

        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = pose.process(rgb_frame)
        if not results.pose_landmarks:
            return False, ["No body detected - ensure full visibility"]

        landmarks = results.pose_landmarks.landmark
        feedback = []

        left_shoulder = get_landmark(landmarks, mp_pose.PoseLandmark.LEFT_SHOULDER)
        right_shoulder = get_landmark(landmarks, mp_pose.PoseLandmark.RIGHT_SHOULDER)
        left_hip = get_landmark(landmarks, mp_pose.PoseLandmark.LEFT_HIP)
        right_hip = get_landmark(landmarks, mp_pose.PoseLandmark.RIGHT_HIP)
        left_ear = get_landmark(landmarks, mp_pose.PoseLandmark.LEFT_EAR)
        right_ear = get_landmark(landmarks, mp_pose.PoseLandmark.RIGHT_EAR)
        nose = get_landmark(landmarks, mp_pose.PoseLandmark.NOSE)

        # Midpoints
        shoulder = None
        if left_shoulder and right_shoulder:
            shoulder = type('', (), {})()
            shoulder.x = (left_shoulder.x + right_shoulder.x) / 2
            shoulder.y = (left_shoulder.y + right_shoulder.y) / 2
        elif left_shoulder:
            shoulder = left_shoulder
        elif right_shoulder:
            shoulder = right_shoulder

        hip = None
        if left_hip and right_hip:
            hip = type('', (), {})()
            hip.x = (left_hip.x + right_hip.x) / 2
            hip.y = (left_hip.y + right_hip.y) / 2
        elif left_hip:
            hip = left_hip
        elif right_hip:
            hip = right_hip

        ear = left_ear or right_ear

        if not all([shoulder, hip, ear, nose]):
            return False, ["Key body points not visible - adjust position"]

        # Neck bend - Modified calculation
        try:
            # Vector from ear to shoulder (down the neck)
            neck_vector = np.array([shoulder.x - ear.x, shoulder.y - ear.y])
            # Vector from ear to nose (forward direction)
            head_vector = np.array([nose.x - ear.x, nose.y - ear.y])
            
            # Calculate angle between these vectors
            dot_product = np.dot(neck_vector, head_vector)
            norm_neck = np.linalg.norm(neck_vector)
            norm_head = np.linalg.norm(head_vector)
            
            if norm_neck < 1e-6 or norm_head < 1e-6:
                neck_bend = 0.0
            else:
                angle_rad = np.arccos(dot_product / (norm_neck * norm_head))
                neck_bend = np.degrees(angle_rad)
            
            # Desk sitting rule: Flag if neck bends >30°
            if neck_bend > 30:
                feedback.append(f"Neck bending forward: {int(neck_bend)}° (exceeds 30° threshold)")
        except Exception as e:
            logger.error(f"Neck angle error: {str(e)}")

        # Upright back (unchanged as requested)
        try:
            upright_angle = calculate_upright_back_angle(shoulder, hip)
            if upright_angle > 15:
                feedback.append(f"Back is leaning: {int(upright_angle)}° from vertical")
        except Exception as e:
            logger.error(f"Back angle error: {str(e)}")

        return True, feedback

    except Exception as e:
        logger.exception(f"Sitting analysis failed: {str(e)}")
        return False, [f"Analysis error: {str(e)}"]