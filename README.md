# 📐 Poslyzer

**Poslyzer** is a fullstack posture analysis web-application that allows users to upload or record videos of themselves performing movements (like squats) and get real-time feedback on their posture. Built using modern web technologies and AI pose estimation models, Poslyzer aims to assist users in improving their form and preventing injuries—especially useful for fitness and physiotherapy use cases.

---

## 🚀 Tech Stack

### Frontend
- **React.js**
- **Tailwind CSS**
- **React Webcam** for live camera input
- **Axios** for API communication

### Backend
- **Flask + MediaPipe + OpenCV** for frame-by-frame posture analysis
- **Python** for landmark extraction and pose logic

---

## 🧩 Features

- Record videos using webcam or upload video files (`.webm`)
- Analyze user posture frame-by-frame
- Classify posture correctness using rule-based logic
- Support for exercises like squats with custom threshold angles
- Real-time angle calculation and alerts for improper form
- Frontend UI that mimics professional workout tracking tools

---

## 💻 Local Setup Instructions

Follow these steps to run the project locally on your machine:

### 1. Clone the repository

```bash
git clone https://github.com/Lunatic5578/Poslyzer.git
cd Poslyzer
```
## 2. Setup frontend and its dependencies

```bash
cd frontend
npm install
npm run dev
```

## 3. Set Up Flask API for Pose Analysis

```bash
cd ../backend/pythonApi
pip install -r requirements.txt
python app.py
```

## Live Link - <a href="https://poslyzer.vercel.app/"> Click to see </a>

NOTE: Currently the project only analyzes two postures, 
i) Squatting Posture
ii) Sitting Posture
