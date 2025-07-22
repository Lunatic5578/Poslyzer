import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { Pose } from '@mediapipe/pose';
import { Camera } from '@mediapipe/camera_utils';

const RecordPage = () => {
  const [activeTab, setActiveTab] = useState("webcam");
  const [recordingMode, setRecordingMode] = useState("squat");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [liveFeedback, setLiveFeedback] = useState(null);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [uploadedVideoURL, setUploadedVideoURL] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [liveVideoStream, setLiveVideoStream] = useState(null);
  const [isLiveAnalysisActive, setIsLiveAnalysisActive] = useState(false);
  const [poses, setPoses] = useState([]);
  const [isMediaPipeLoaded, setIsMediaPipeLoaded] = useState(false);
  const [showPoseOverlay, setShowPoseOverlay] = useState(true);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const poseCanvasRef = useRef(null);
  const frameAnalysisInterval = useRef(null);
  const poseDetector = useRef(null);
  const cameraRef = useRef(null);
  const navigate = useNavigate();

  // Initialize MediaPipe Pose
  useEffect(() => {
    const pose = new Pose({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    });

    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      smoothSegmentation: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    pose.onResults(onPoseResults);
    poseDetector.current = pose;
    setIsMediaPipeLoaded(true);

    return () => {
      pose.close();
    };
  }, []);

  const onPoseResults = (results) => {
    if (results.poseLandmarks) {
      setPoses(results.poseLandmarks);
      if (showPoseOverlay) {
        drawPoseOnCanvas(results.poseLandmarks);
      } else {
        // Clear canvas when overlay is hidden
        const canvas = poseCanvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
    } else {
      setPoses([]);
    }
  };

  const drawPoseOnCanvas = (landmarks) => {
    const canvas = poseCanvasRef.current;
    const video = videoRef.current;
    
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (landmarks && landmarks.length > 0) {
      // Define the 15 points we want to detect
      const keyPoints = {
        0: 'HEAD', // Nose
        'NECK': 'NECK', // Midpoint between shoulders (11, 12)
        11: 'L_SHOULDER',
        12: 'R_SHOULDER',
        13: 'L_ELBOW',
        14: 'R_ELBOW',
        15: 'L_WRIST',
        16: 'R_WRIST',
        'MID_HIP': 'MID_HIP', // Midpoint between hips (23, 24)
        23: 'L_HIP',
        24: 'R_HIP',
        25: 'L_KNEE',
        26: 'R_KNEE',
        27: 'L_ANKLE',
        28: 'R_ANKLE'
      };

      // Calculate midpoints for Neck and Mid-Hip
      const neck = landmarks[11] && landmarks[12] ? {
        x: (landmarks[11].x + landmarks[12].x) / 2,
        y: (landmarks[11].y + landmarks[12].y) / 2
      } : null;

      const midHip = landmarks[23] && landmarks[24] ? {
        x: (landmarks[23].x + landmarks[24].x) / 2,
        y: (landmarks[23].y + landmarks[24].y) / 2
      } : null;

      // Define connections between the 15 points
      const connections = [
        ['NECK', 11], ['NECK', 12], // Neck to shoulders
        [11, 13], [13, 15], // Left arm
        [12, 14], [14, 16], // Right arm
        ['NECK', 'MID_HIP'], // Neck to mid-hip (torso)
        ['MID_HIP', 23], ['MID_HIP', 24], // Mid-hip to hips
        [23, 25], [25, 27], // Left leg
        [24, 26], [26, 28], // Right leg
        [0, 'NECK'] // Head to neck
      ];

      // Draw connections
      ctx.strokeStyle = '#e5ff00ff';
      ctx.lineWidth = 8;
      connections.forEach(([start, end]) => {
        let startPos, endPos;
        if (start === 'NECK' && neck) startPos = neck;
        else if (start === 'MID_HIP' && midHip) startPos = midHip;
        else if (landmarks[start]) startPos = landmarks[start];

        if (end === 'NECK' && neck) endPos = neck;
        else if (end === 'MID_HIP' && midHip) endPos = midHip;
        else if (landmarks[end]) endPos = landmarks[end];

        if (startPos && endPos) {
          ctx.beginPath();
          ctx.moveTo(startPos.x * canvas.width, startPos.y * canvas.height);
          ctx.lineTo(endPos.x * canvas.width, endPos.y * canvas.height);
          ctx.stroke();
        }
      });

      // Draw points
      ctx.fillStyle = '#FF0000';
      Object.keys(keyPoints).forEach((key) => {
        let point;
        if (key === 'NECK' && neck) point = neck;
        else if (key === 'MID_HIP' && midHip) point = midHip;
        else if (landmarks[key]) point = landmarks[key];

        if (point) {
          ctx.beginPath();
          ctx.arc(
            point.x * canvas.width,
            point.y * canvas.height,
            7,
            0,
            2 * Math.PI
          );
          ctx.fill();

          ctx.fillStyle = '#FFFFFF';
          ctx.font = '12px Arial';
          ctx.fillText(
            keyPoints[key],
            point.x * canvas.width + 8,
            point.y * canvas.height - 8
          );
          ctx.fillStyle = '#FF0000';
        }
      });
    }
  };

  const detectPoseFromVideo = async () => {
    if (!poseDetector.current || !videoRef.current || videoRef.current.readyState < 2) return;
    
    await poseDetector.current.send({ image: videoRef.current });
  };

  // Handle webcam stream with MediaPipe Camera
  useEffect(() => {
    if (isRecording && liveVideoStream && videoRef.current && isMediaPipeLoaded) {
      videoRef.current.srcObject = liveVideoStream;
      videoRef.current.play().catch((err) => console.error("Webcam video play error:", err));

      cameraRef.current = new Camera(videoRef.current, {
        onFrame: async () => {
          if (videoRef.current && isLiveAnalysisActive) {
            await detectPoseFromVideo();
          }
        },
        width: 640,
        height: 480,
      });

      cameraRef.current.start();

      return () => {
        if (cameraRef.current) {
          cameraRef.current.stop();
        }
      };
    }
  }, [isRecording, liveVideoStream, isLiveAnalysisActive, isMediaPipeLoaded]);

  // Live frame analysis effect
  useEffect(() => {
    if (isLiveAnalysisActive && videoRef.current && canvasRef.current && liveVideoStream && isMediaPipeLoaded) {
      frameAnalysisInterval.current = setInterval(() => {
        const canvas = canvasRef.current;
        const video = videoRef.current;

        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          const ctx = canvas.getContext("2d");
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          canvas.toBlob(async (blob) => {
            if (!blob) return;

            const formData = new FormData();
            formData.append("frame", blob);
            formData.append("mode", recordingMode);
            if (poses && poses.length > 0) {
              formData.append("poses", JSON.stringify(poses));
            }

            const backendURL = import.meta.env.VITE_BACKEND_URL || `http://localhost:5001`;

            try {
              const res = await axios.post(backendURL + "/api/video/frame", formData);

              setLiveFeedback({
                status: res.data.status || "Analyzing...",
                details: res.data.feedback || res.data.details || [],
                score: res.data.score || null
              });
            } catch (err) {
              console.error("Live analysis error:", err);
              let errorMsg = "Unable to analyze current frame";

              if (err.response && err.response.data) {
                if (err.response.data.error) {
                  errorMsg = err.response.data.error;
                } else if (err.response.data.details) {
                  errorMsg = err.response.data.details.join(", ");
                }
              } else if (err.message) {
                errorMsg = err.message;
              }

              setLiveFeedback({
                status: "Analysis Error",
                details: [errorMsg],
                score: null
              });
            }
          }, "image/jpeg", 0.8);
        }
      }, 600);

      return () => {
        if (frameAnalysisInterval.current) {
          clearInterval(frameAnalysisInterval.current);
        }
      };
    }
  }, [isLiveAnalysisActive, liveVideoStream, recordingMode, poses, isMediaPipeLoaded]);

  // Pose detection for uploaded video
  useEffect(() => {
    if (activeTab === "upload" && uploadedVideoURL && videoRef.current && isMediaPipeLoaded) {
      const video = videoRef.current;

      const handleTimeUpdate = async () => {
        if (!video.paused && !video.ended) {
          await detectPoseFromVideo();
        }
      };

      video.addEventListener('timeupdate', handleTimeUpdate);

      return () => {
        video.removeEventListener('timeupdate', handleTimeUpdate);
      };
    }
  }, [uploadedVideoURL, isMediaPipeLoaded, activeTab]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (frameAnalysisInterval.current) {
        clearInterval(frameAnalysisInterval.current);
      }
      if (liveVideoStream) {
        liveVideoStream.getTracks().forEach((track) => track.stop());
      }
      if (cameraRef.current) {
        cameraRef.current.stop();
      }
      if (uploadedVideoURL) {
        URL.revokeObjectURL(uploadedVideoURL);
      }
    };
  }, [liveVideoStream, uploadedVideoURL]);

  const handleVideoUpload = async (file) => {
    const localURL = URL.createObjectURL(file);
    setUploadedVideoURL(localURL);
    setIsAnalyzing(true);
    setLiveFeedback(null);
    setAnalysisResults(null);
    setPoses([]);

    try {
      if (videoRef.current) {
        videoRef.current.src = localURL;
        videoRef.current.onloadeddata = () => {
          videoRef.current.play().catch((err) => console.error("Uploaded video play error:", err));
        };
      }

      const formData = new FormData();
      formData.append("video", file);
      formData.append("mode", recordingMode);

      const backendURL = import.meta.env.VITE_BACKEND_URL || `http://localhost:5001`;

       const response = await fetch(backendURL+"/api/video/analyze",{
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Analysis failed");

      const result = await response.json();
      setAnalysisResults(result);

      if (result.overall_analysis) {
        setLiveFeedback({
          status: result.overall_analysis.status,
          details: result.overall_analysis.details,
          score: result.overall_analysis.score
        });
      }

      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play();
      }
    } catch (error) {
      console.error("Error:", error);
      setLiveFeedback({
        status: "Analysis Error",
        details: [error.message || "Analysis failed. Please try again."],
        score: 0
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleStartStopRecording = async () => {
    if (!isRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        setLiveVideoStream(stream);
        setIsRecording(true);
        setIsLiveAnalysisActive(true);
      } catch (err) {
        console.error("Webcam access error:", err);
        alert("Could not access webcam.");
      }
    } else {
      setIsLiveAnalysisActive(false);
      if (liveVideoStream) {
        liveVideoStream.getTracks().forEach((track) => track.stop());
      }
      setLiveVideoStream(null);
      setIsRecording(false);
      setLiveFeedback(null);
      setPoses([]);
    }
  };

  const toggleLiveAnalysis = () => {
    setIsLiveAnalysisActive(!isLiveAnalysisActive);
    if (!isLiveAnalysisActive) {
      setLiveFeedback(null);
    }
  };

  const togglePoseOverlay = () => {
    setShowPoseOverlay(!showPoseOverlay);
    // Clear canvas when hiding overlay
    if (!showPoseOverlay === false) {
      const canvas = poseCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column */}
        <div className="bg-white rounded-xl shadow-md p-6 flex flex-col">
          <h1 className="text-2xl font-bold text-gray-800 mb-6">
            Posture Analysis
          </h1>

          {/* Mode Selector */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Analysis Mode
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setRecordingMode("squat")}
                className={`py-3 px-4 rounded-lg border-2 transition-all ${
                  recordingMode === "squat"
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 hover:border-gray-300 text-gray-700"
                }`}
              >
                Squatting Posture Analysis
              </button>
              <button
                onClick={() => setRecordingMode("sitting")}
                className={`py-3 px-4 rounded-lg border-2 transition-all ${
                  recordingMode === "sitting"
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 hover:border-gray-300 text-gray-700"
                }`}
              >
                Sitting Posture Analysis
              </button>
            </div>
          </div>

          {/* Recording Method Selector */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Recording Method
            </label>
            <div className="flex border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setActiveTab("webcam")}
                className={`flex-1 py-2 px-4 text-center transition-all ${
                  activeTab === "webcam"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                }`}
              >
                Webcam
              </button>
              <button
                onClick={() => setActiveTab("upload")}
                className={`flex-1 py-2 px-4 text-center transition-all ${
                  activeTab === "upload"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                }`}
              >
                Upload
              </button>
              <label className="flex-none flex items-center px-4 py-2 bg-gray-100">
                <span className="text-sm text-gray-700 mr-2">Pose Overlay</span>
                <div className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPoseOverlay}
                    onChange={togglePoseOverlay}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                </div>
              </label>
            </div>
          </div>

          {/* Input Area */}
          <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-8 bg-gray-50">
            <p className="text-gray-600 mb-4 text-center">
              {isAnalyzing
                ? "Analyzing your input..."
                : activeTab === "upload"
                ? "Upload a video for analysis"
                : "Start your webcam for real-time analysis"}
            </p>

            {activeTab === "upload" ? (
              <>
                <label className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg cursor-pointer transition-colors">
                  {isAnalyzing ? "Processing..." : "Select Video"}
                  <input
                    type="file"
                    className="hidden"
                    accept="video/*"
                    disabled={isAnalyzing}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleVideoUpload(file);
                    }}
                  />
                </label>
                <p className="mt-2 text-xs text-gray-500">
                  MP4, WebM, or MOV. Max 100MB.
                </p>
              </>
            ) : (
              <>
                <div className="space-y-4">
                  <button
                    onClick={handleStartStopRecording}
                    className={`px-6 py-2 rounded-lg transition-colors ${
                      isRecording
                        ? "bg-red-500 hover:bg-red-600 text-white"
                        : "bg-blue-500 hover:bg-blue-600 text-white"
                    }`}
                  >
                    {isRecording ? "Stop Recording" : "Start Recording"}
                  </button>

                  {isRecording && (
                    <button
                      onClick={toggleLiveAnalysis}
                      className={`px-6 py-2 rounded-lg transition-colors ml-4 ${
                        isLiveAnalysisActive
                          ? "bg-yellow-500 hover:bg-yellow-600 text-white"
                          : "bg-green-500 hover:bg-green-600 text-white"
                      }`}
                    >
                      {isLiveAnalysisActive ? "Pause Analysis" : "Start Analysis"}
                    </button>
                  )}
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  {isLiveAnalysisActive
                    ? "Live analysis active - feedback updating every 600ms"
                    : "Webcam feed will appear on the right"}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Right Column - Video Feed + Analysis */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden flex flex-col">
          {/* Video Display */}
          <div className="bg-black flex-1 flex items-center justify-center relative">
            {activeTab === "webcam" && liveVideoStream ? (
              <div className="relative w-full h-full">
                <video
                  ref={videoRef}
                  className="w-full h-full object-contain"
                  autoPlay
                  muted
                />
                <canvas
                  ref={poseCanvasRef}
                  className="absolute top-0 left-0 w-full h-full object-contain"
                  style={{ pointerEvents: 'none', display: showPoseOverlay ? 'block' : 'none' }}
                />
              </div>
            ) : uploadedVideoURL ? (
              <div className="w-full h-full relative">
                <video
                  ref={videoRef}
                  src={uploadedVideoURL}
                  className="w-full h-full object-contain"
                  controls
                  autoPlay
                  muted
                />
                <canvas
                  ref={poseCanvasRef}
                  className="absolute top-0 left-0 w-full h-full object-contain"
                  style={{ pointerEvents: 'none', display: showPoseOverlay ? 'block' : 'none' }}
                />
                <div className="absolute top-4 right-4">
                  <button
                    onClick={() => {
                      if (videoRef.current) {
                        videoRef.current.pause();
                        videoRef.current.src = "";
                      }
                      URL.revokeObjectURL(uploadedVideoURL);
                      setUploadedVideoURL(null);
                      setAnalysisResults(null);
                      setPoses([]);
                    }}
                    className="bg-red-500 hover:bg-red-600 text-white text-sm px-3 py-1 rounded"
                  >
                    Remove Video
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-white text-center p-4">
                <p className="text-lg">Video Preview</p>
                <p className="text-sm text-gray-300 mt-2">
                  Feed will appear here
                </p>
              </div>
            )}

            {isLiveAnalysisActive && (
              <div className="absolute top-4 left-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium animate-pulse">
                ● LIVE ANALYSIS
              </div>
            )}
          </div>

          {/* Analysis Results */}
          <div className="border-t border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Analysis Results
            </h3>

            {analysisResults ? (
              <div className="space-y-6">
                {/* Overall Analysis */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-md font-medium text-gray-700">
                      Overall Analysis
                    </h4>
                    {analysisResults.overall_analysis?.score && (
                      <div className="text-sm text-gray-600">
                        Score: {analysisResults.overall_analysis.score}/100
                      </div>
                    )}
                  </div>
                  <div
                    className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium mb-3 ${
                      analysisResults.overall_analysis.status === "Good Form" ||
                      analysisResults.overall_analysis.status === "Good Posture"
                        ? "bg-green-100 text-green-800"
                        : analysisResults.overall_analysis.status === "Analysis Error"
                        ? "bg-red-100 text-red-800"
                        : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {analysisResults.overall_analysis.status}
                  </div>
                  {analysisResults.overall_analysis.details?.length > 0 && (
                    <ul className="space-y-2">
                      {analysisResults.overall_analysis.details.map((detail, index) => (
                        <li key={index} className="flex items-start">
                          <span
                            className={`inline-block w-2 h-2 rounded-full mt-2 mr-2 ${
                              analysisResults.overall_analysis.status === "Good Form" ||
                              analysisResults.overall_analysis.status === "Good Posture"
                                ? "bg-green-500"
                                : analysisResults.overall_analysis.status === "Analysis Error"
                                ? "bg-red-500"
                                : "bg-yellow-500"
                            }`}
                          />
                          <span className="text-gray-700">{detail}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Video Statistics */}
                {analysisResults.video_stats && (
                  <div>
                    <h4 className="text-md font-medium text-gray-700 mb-3">
                      Video Statistics
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                      <div>Duration: {analysisResults.video_stats.duration}s</div>
                      <div>Total Frames: {analysisResults.video_stats.total_frames}</div>
                      <div>Analyzed Frames: {analysisResults.video_stats.analyzed_frames}</div>
                      <div>FPS: {analysisResults.video_stats.fps}</div>
                      <div>Average Issues/Frame: {analysisResults.video_stats.average_issues_per_frame}</div>
                    </div>
                  </div>
                )}

                {/* Most Common Issues */}
                {analysisResults.most_common_issues?.length > 0 && (
                  <div>
                    <h4 className="text-md font-medium text-gray-700 mb-3">
                      Most Common Issues
                    </h4>
                    <ul className="space-y-2">
                      {analysisResults.most_common_issues.map((issue, index) => (
                        <li key={index} className="flex items-start">
                          <span className="inline-block w-2 h-2 rounded-full mt-2 mr-2 bg-yellow-500" />
                          <span className="text-gray-700">{issue.issue} ({issue.count} occurrences)</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">
                    Live Analysis
                  </h3>
                  {liveFeedback?.score && (
                    <div className="text-sm text-gray-600">
                      Score: {liveFeedback.score}/100
                    </div>
                  )}
                </div>

                {liveFeedback ? (
                  <div>
                    <div
                      className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium mb-3 ${
                        liveFeedback.status === "Good Form" || liveFeedback.status === "Good Posture"
                          ? "bg-green-100 text-green-800"
                          : liveFeedback.status === "Analysis Error"
                          ? "bg-red-100 text-red-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {liveFeedback.status}
                    </div>

                    {liveFeedback.details && liveFeedback.details.length > 0 && (
                      <ul className="space-y-2">
                        {liveFeedback.details.map((detail, index) => (
                          <li key={index} className="flex items-start">
                            <span
                              className={`inline-block w-2 h-2 rounded-full mt-2 mr-2 ${
                                liveFeedback.status === "Good Form" || liveFeedback.status === "Good Posture"
                                  ? "bg-green-500"
                                  : liveFeedback.status === "Analysis Error"
                                  ? "bg-red-500"
                                  : "bg-yellow-500"
                              }`}
                            />
                            <span className="text-gray-700">{detail}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : (
                  <div className="text-gray-500 italic">
                    {activeTab === "webcam"
                      ? isRecording
                        ? isLiveAnalysisActive
                          ? "Analyzing your posture..."
                          : "Click 'Start Analysis' to begin live feedback"
                        : "Start recording to enable live analysis"
                      : "Analysis will appear here after video upload"}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width="640"
        height="480"
        style={{ display: "none" }}
      />

      <div className="flex justify-end mt-6 max-w-7xl mx-auto">
        <button
          onClick={() => navigate("/")}
          className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-6 rounded-md transition-colors"
        >
          ← Back to Home
        </button>
      </div>
    </div>
  );
};

export default RecordPage;