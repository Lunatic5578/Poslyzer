import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

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

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const frameAnalysisInterval = useRef(null);
  const [feedback, setFeedback] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (videoRef.current && liveVideoStream) {
      videoRef.current.srcObject = liveVideoStream;
      videoRef.current.play();
    }
  }, [liveVideoStream]);

  // Live frame analysis effect
  useEffect(() => {
    if (isLiveAnalysisActive && videoRef.current && canvasRef.current && liveVideoStream) {
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

            const backendURL= import.meta.env.VITE_BACKEND_URL

            try {
              const res = await axios.post(backendURL+"/api/video/frame", formData);

              setLiveFeedback({
                status: res.data.status || "Analyzing...",
                details: res.data.feedback || res.data.details || [],
                score: res.data.score || null
              });

              setFeedback(res.data.feedback || []);

            } catch (err) {
              console.error("Live analysis error:", err);
              let errorMsg = "Unable to analyze current frame";

              // Extract error message from backend response
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
  }, [isLiveAnalysisActive, liveVideoStream, recordingMode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (frameAnalysisInterval.current) {
        clearInterval(frameAnalysisInterval.current);
      }
      if (liveVideoStream) {
        liveVideoStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const handleVideoUpload = async (file) => {
    const localURL = URL.createObjectURL(file);
    setUploadedVideoURL(localURL);
    setIsAnalyzing(true);
    setLiveFeedback(null);
    setAnalysisResults(null);

    try {
      if (videoRef.current) {
        videoRef.current.load();
        videoRef.current.play();
      }

      const formData = new FormData();
      formData.append("video", file);
      formData.append("mode", recordingMode);

      const response = await fetch("http://localhost:5001/api/video/analyze", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Analysis failed");

      const result = await response.json();
      setAnalysisResults(result);

      // Show quick preview of results
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
        console.error("Webcam access denied", err);
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
      setFeedback([]);
    }
  };

  const toggleLiveAnalysis = () => {
    setIsLiveAnalysisActive(!isLiveAnalysisActive);
    if (!isLiveAnalysisActive) {
      setLiveFeedback(null);
      setFeedback([]);
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
                  MP4, WebM or MOV. Max 100MB.
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
              <video
                ref={videoRef}
                className="w-full h-full object-contain"
                autoPlay
                muted
              />
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
                <div className="absolute top-4 right-4">
                  <button
                    onClick={() => {
                      if (videoRef.current) {
                        videoRef.current.pause();
                        videoRef.current.src = "";
                      }
                      setUploadedVideoURL(null);
                      setAnalysisResults(null);
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