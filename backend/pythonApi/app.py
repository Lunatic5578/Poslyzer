from flask import Flask, request, jsonify
import cv2
import numpy as np
import os
import tempfile
from werkzeug.utils import secure_filename
from flask_cors import CORS
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
from enum import Enum
import logging
from contextlib import contextmanager
from squatPosture import analyze_squat
from sittingPosture import analyze_sitting

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AnalysisType(Enum):
    """Enum for analysis types"""
    SQUAT = "squat"
    SITTING = "sitting"

class PostureStatus(Enum):
    """Enum for posture status"""
    GOOD = "Good Form"
    GOOD_POSTURE = "Good Posture"
    MINOR_ISSUES = "Minor Issues"
    NEEDS_IMPROVEMENT = "Needs Improvement"
    ERROR = "Error"

@dataclass
class AnalysisResult:
    """Data class for analysis results"""
    status: str
    feedback: List[str]
    details: List[str]
    score: int
    analysis_type: str

@dataclass
class VideoStats:
    """Data class for video statistics"""
    duration: float
    total_frames: int
    analyzed_frames: int
    fps: float
    average_issues_per_frame: float

class PostureAnalyzer:
    """Main class for posture analysis logic"""
    
    ALLOWED_EXTENSIONS = {'mp4', 'avi', 'mov', 'mkv', 'webm'}
    DEFAULT_FRAME_INTERVAL = 30
    
    @classmethod
    def is_allowed_file(cls, filename: str) -> bool:
        """Check if file extension is allowed"""
        return ('.' in filename and 
                filename.rsplit('.', 1)[1].lower() in cls.ALLOWED_EXTENSIONS)
    
    @classmethod
    def format_analysis_response(cls, feedback_list: List[str], 
                               analysis_type: str) -> AnalysisResult:
        """Format analysis response with consistent structure"""
        if not feedback_list:
            status = (PostureStatus.GOOD.value if analysis_type == AnalysisType.SQUAT.value 
                     else PostureStatus.GOOD_POSTURE.value)
            return AnalysisResult(
                status=status,
                feedback=[],
                details=[],
                score=100,
                analysis_type=analysis_type
            )
        
        # Determine status and score based on feedback count
        feedback_count = len(feedback_list)
        if feedback_count == 0:
            status = (PostureStatus.GOOD.value if analysis_type == AnalysisType.SQUAT.value 
                     else PostureStatus.GOOD_POSTURE.value)
            score = 100
        elif feedback_count <= 2:
            status = PostureStatus.MINOR_ISSUES.value
            score = 80 - (feedback_count * 10)
        else:
            status = PostureStatus.NEEDS_IMPROVEMENT.value
            score = max(50, 90 - (feedback_count * 15))
        
        return AnalysisResult(
            status=status,
            feedback=feedback_list,
            details=feedback_list,
            score=score,
            analysis_type=analysis_type
        )
    
    @classmethod
    def analyze_single_frame(cls, frame: np.ndarray, 
                             analysis_type: AnalysisType) -> Tuple[bool, List[str]]:
        """Analyze a single frame based on analysis type"""
        try:
            if frame is None or frame.size == 0:
                logger.error("Empty frame received")
                return False, ["Empty frame - check camera input"]

            if analysis_type == AnalysisType.SITTING:
                return analyze_sitting(frame)
            else:
                return analyze_squat(frame)
        except Exception as e:
            logger.exception(f"Critical error in {analysis_type.value} analysis:")
            return False, [f"Analysis failed: {str(e)}"]
    
    @classmethod
    def analyze_video_frames(cls, video_path: str, mode: str, 
                           frame_interval: int = DEFAULT_FRAME_INTERVAL) -> Dict:
        """Analyze video by extracting frames at specified intervals"""
        analysis_type = AnalysisType(mode)
        
        with VideoCapture(video_path) as cap:
            if not cap.is_opened():
                raise ValueError("Could not open video file")
            
            frame_count = 0
            analyzed_frames = 0
            all_feedback = []
            frame_analyses = []
            
            # Get video properties
            fps = cap.get_fps()
            total_frames = cap.get_frame_count()
            duration = total_frames / fps if fps > 0 else 0
            
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                    
                # Analyze every nth frame to avoid overprocessing
                if frame_count % frame_interval == 0:
                    try:
                        _, feedback = cls.analyze_single_frame(frame, analysis_type)
                        
                        # Store frame analysis with timestamp
                        timestamp = frame_count / fps if fps > 0 else 0
                        frame_analysis = {
                            "timestamp": round(timestamp, 2),
                            "frame_number": frame_count,
                            "feedback": feedback,
                            "issues_count": len(feedback)
                        }
                        frame_analyses.append(frame_analysis)
                        
                        # Collect all feedback for overall analysis
                        all_feedback.extend(feedback)
                        analyzed_frames += 1
                        
                    except Exception as e:
                        logger.error(f"Error analyzing frame {frame_count}: {e}")
                
                frame_count += 1
            
            # Calculate overall statistics
            unique_feedback = list(set(all_feedback))
            average_issues = len(all_feedback) / analyzed_frames if analyzed_frames > 0 else 0
            
            # Find most common issues
            most_common_issues = cls._get_most_common_issues(all_feedback)
            
            # Create response
            analysis_result = cls.format_analysis_response(unique_feedback, mode)
            video_stats = VideoStats(
                duration=round(duration, 2),
                total_frames=total_frames,
                analyzed_frames=analyzed_frames,
                fps=round(fps, 2),
                average_issues_per_frame=round(average_issues, 2)
            )
            
            return {
                "overall_analysis": analysis_result.__dict__,
                "video_stats": video_stats.__dict__,
                "frame_analyses": frame_analyses,
                "most_common_issues": most_common_issues,
                "timeline_data": [
                    {
                        "timestamp": analysis["timestamp"],
                        "issues_count": analysis["issues_count"]
                    }
                    for analysis in frame_analyses
                ]
            }
    
    @staticmethod
    def _get_most_common_issues(all_feedback: List[str], top_n: int = 5) -> List[Dict]:
        """Get most common issues from feedback list"""
        feedback_counts = {}
        for feedback_item in all_feedback:
            feedback_counts[feedback_item] = feedback_counts.get(feedback_item, 0) + 1
        
        most_common = sorted(feedback_counts.items(), key=lambda x: x[1], reverse=True)[:top_n]
        return [{"issue": issue, "count": count} for issue, count in most_common]

class VideoCapture:
    """Context manager for OpenCV VideoCapture"""
    
    def __init__(self, video_path: str):
        self.video_path = video_path
        self.cap = None
    
    def __enter__(self):
        self.cap = cv2.VideoCapture(self.video_path)
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.cap:
            self.cap.release()
    
    def is_opened(self) -> bool:
        return self.cap.isOpened()
    
    def read(self) -> Tuple[bool, np.ndarray]:
        return self.cap.read()
    
    def get_fps(self) -> float:
        return self.cap.get(cv2.CAP_PROP_FPS)
    
    def get_frame_count(self) -> int:
        return int(self.cap.get(cv2.CAP_PROP_FRAME_COUNT))

@contextmanager
def temporary_file(suffix: str = '.mp4'):
    """Context manager for temporary files"""
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_file:
        temp_path = tmp_file.name
    try:
        yield temp_path
    finally:
        if os.path.exists(temp_path):
            os.unlink(temp_path)

class PostureAPI:
    """Main API class"""
    
    def __init__(self):
        self.app = Flask(__name__)
        CORS(self.app)
        self.app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB
        self.analyzer = PostureAnalyzer()
        self._register_routes()
    
    def _register_routes(self):
        """Register all API routes"""
        self.app.route('/api/video/analyze', methods=['POST'])(self.analyze_video)
        self.app.route('/api/video/frame', methods=['POST'])(self.analyze_frame)
        self.app.route('/api/video/analyze-squat', methods=['POST'])(self.analyze_squat)
        self.app.route('/api/video/analyze-sit', methods=['POST'])(self.analyze_sitting)
        self.app.route('/analyze/squat', methods=['POST'])(self.squat_legacy)
        self.app.route('/analyze/sit', methods=['POST'])(self.sit_legacy)
        self.app.route('/health', methods=['GET'])(self.health_check)
    
    def _validate_file_upload(self, file_key: str = 'video') -> tuple:
        """Validate file upload and return file and error response if any"""
        if file_key not in request.files:
            return None, (jsonify({'error': f'No {file_key} file provided'}), 400)
        
        file = request.files[file_key]
        if file.filename == '':
            return None, (jsonify({'error': 'No file selected'}), 400)
        
        if file_key == 'video' and not self.analyzer.is_allowed_file(file.filename):
            return None, (jsonify({
                'error': 'Invalid file type. Allowed: mp4, avi, mov, mkv, webm'
            }), 400)
        
        return file, None
    
    def _decode_image_frame(self, file) -> tuple:
        """Decode image frame from file"""
        try:
            npimg = np.frombuffer(file.read(), np.uint8)
            frame = cv2.imdecode(npimg, cv2.IMREAD_COLOR)
            
            if frame is None:
                return None, (jsonify({'error': 'Invalid image format'}), 400)
            
            return frame, None
        except Exception as e:
            return None, (jsonify({'error': f'Image decoding failed: {str(e)}'}), 500)
    
    def _create_error_response(self, error_msg: str) -> tuple:
        """Create standardized error response"""
        return jsonify({
            'error': error_msg,
            'status': PostureStatus.ERROR.value,
            'feedback': ['Analysis error occurred'],
            'details': ['Unable to process request'],
            'score': 0
        }), 500
    
    def analyze_video(self):
        """Analyze uploaded video file"""
        try:
            file, error = self._validate_file_upload('video')
            if error:
                return error
            
            mode = request.form.get('mode', AnalysisType.SQUAT.value)
            
            with temporary_file() as temp_path:
                file.save(temp_path)
                result = self.analyzer.analyze_video_frames(temp_path, mode)
                return jsonify(result)
                
        except Exception as e:
            logger.error(f"Video analysis failed: {e}")
            return self._create_error_response(f'Video analysis failed: {str(e)}')
    
    def analyze_frame(self):
        """Analyze single frame"""
        try:
            file, error = self._validate_file_upload('frame')
            if error:
                return error
            
            frame, error = self._decode_image_frame(file)
            if error:
                return error
            
            # Add frame validation
            if frame is None or frame.size == 0:
                return jsonify({
                    'error': 'Invalid frame data',
                    'status': 'Analysis Error',
                    'feedback': ['Empty frame received'],
                    'score': 0
                }), 400
            
            mode = request.form.get('mode', AnalysisType.SQUAT.value)
            analysis_type = AnalysisType(mode)
            
            _, feedback = self.analyzer.analyze_single_frame(frame, analysis_type)
            response = self.analyzer.format_analysis_response(feedback, mode)
            
            return jsonify(response.__dict__)
            
        except Exception as e:
            logger.exception("Frame analysis critical error")
            return self._create_error_response(f'Critical error: {str(e)}')
    
    def analyze_squat(self):
        """Analyze squat posture from frame"""
        return self._analyze_posture_frame(AnalysisType.SQUAT)
    
    def analyze_sitting(self):
        """Analyze sitting posture from frame"""
        return self._analyze_posture_frame(AnalysisType.SITTING)
    
    def _analyze_posture_frame(self, analysis_type: AnalysisType):
        """Generic method to analyze posture from frame"""
        try:
            file, error = self._validate_file_upload('frame')
            if error:
                return error
            
            frame, error = self._decode_image_frame(file)
            if error:
                return error
            
            _, feedback = self.analyzer.analyze_single_frame(frame, analysis_type)
            response = self.analyzer.format_analysis_response(feedback, analysis_type.value)
            
            return jsonify(response.__dict__)
            
        except Exception as e:
            logger.error(f"{analysis_type.value} analysis failed: {e}")
            return self._create_error_response(f'{analysis_type.value} analysis failed: {str(e)}')
    
    def squat_legacy(self):
        """Legacy squat analysis endpoint"""
        try:
            file = request.files['frame']
            frame, error = self._decode_image_frame(file)
            if error:
                return error
            
            _, feedback = self.analyzer.analyze_single_frame(frame, AnalysisType.SQUAT)
            return jsonify({'feedback': feedback})
            
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    def sit_legacy(self):
        """Legacy sit analysis endpoint"""
        try:
            file = request.files['frame']
            frame, error = self._decode_image_frame(file)
            if error:
                return error
            
            _, feedback = self.analyzer.analyze_single_frame(frame, AnalysisType.SITTING)
            return jsonify({'feedback': feedback})
            
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    def health_check(self):
        """Health check endpoint"""
        return jsonify({
            'status': 'healthy',
            'message': 'Posture analysis API is running',
            'endpoints': [
                '/api/video/analyze',
                '/api/video/frame',
                '/api/video/analyze-squat',
                '/api/video/analyze-sit',
                '/analyze/squat',
                '/analyze/sit',
                '/health'
            ]
        })
    
    def run(self, host='0.0.0.0', port=5001, debug=True):
        """Run the Flask application"""
        self.app.run(host=host, port=port, debug=debug)

def create_app():
    """Factory function to create the Flask app"""
    api = PostureAPI()
    return api.app

if __name__ == '__main__':
    api = PostureAPI()
    api.run()