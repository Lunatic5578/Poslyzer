import React, { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';

const VideoRecorder = ({ onUpload, isAnalyzing, mode }) => {
  const webcamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const [capturing, setCapturing] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [videoUrl, setVideoUrl] = useState('');
  const [recordingTime, setRecordingTime] = useState(0);
  const [maxDuration] = useState(30);
  const timerRef = useRef(null);
  const [isWebcamReady, setIsWebcamReady] = useState(false);

  // Clean up resources
  useEffect(() => {
    return () => {
      stopRecording();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startTimer = () => {
    setRecordingTime(0);
    timerRef.current = setInterval(() => {
      setRecordingTime(prev => {
        if (prev >= maxDuration) {
          stopRecording();
          return maxDuration;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const handleDataAvailable = useCallback(({ data }) => {
    if (data.size > 0) {
      setRecordedChunks(prev => [...prev, data]);
    }
  }, []);

  const startRecording = useCallback(() => {
    try {
      const stream = webcamRef.current.video.srcObject;
      if (!stream) throw new Error('No video stream available');

      setCapturing(true);
      setRecordedChunks([]);
      
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'video/webm'
      });
      
      mediaRecorderRef.current.addEventListener(
        'dataavailable',
        handleDataAvailable
      );
      mediaRecorderRef.current.start(1000);
      startTimer();
    } catch (error) {
      console.error('Error starting recording:', error);
      setCapturing(false);
    }
  }, [handleDataAvailable]);

  const stopRecording = useCallback(() => {
    try {
      if (mediaRecorderRef.current?.state !== 'inactive') {
        mediaRecorderRef.current?.stop();
      }
      setCapturing(false);
      if (timerRef.current) clearInterval(timerRef.current);
    } catch (error) {
      console.error('Error stopping recording:', error);
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (recordedChunks.length === 0) return;

    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    setVideoUrl(url);

    const file = new File([blob], `${mode}_recording_${Date.now()}.webm`, {
      type: 'video/webm'
    });

    if (onUpload) {
      try {
        await onUpload(file);
      } finally {
        setRecordedChunks([]);
      }
    }
  }, [recordedChunks, onUpload, mode]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full">
      <div className="relative w-full mb-4 rounded-lg overflow-hidden">
        <Webcam
          audio={true}
          ref={webcamRef}
          onUserMedia={() => setIsWebcamReady(true)}
          videoConstraints={{
            width: 640,
            height: 480,
            facingMode: 'user'
          }}
          className="w-full h-auto"
        />
        {capturing && (
          <div className="absolute top-3 left-3 flex items-center bg-black bg-opacity-70 text-white px-3 py-1 rounded-full">
            <span className="w-3 h-3 bg-red-500 rounded-full mr-2 animate-pulse"></span>
            <span className="font-mono font-bold mr-2">REC</span>
            <span className="font-mono">
              {formatTime(recordingTime)} / {formatTime(maxDuration)}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 w-full">
        {!capturing ? (
          <button
            onClick={startRecording}
            disabled={!isWebcamReady || isAnalyzing}
            className={`flex-1 py-3 px-6 rounded-lg font-medium text-white shadow-md transition-all ${
              isWebcamReady && !isAnalyzing
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-gray-400 cursor-not-allowed'
            }`}
          >
            {isAnalyzing ? 'Processing...' : 
             isWebcamReady ? 'Start Recording' : 'Initializing Camera...'}
          </button>
        ) : (
          <button
            onClick={() => {
              stopRecording();
              // Small delay to ensure all chunks are collected
              setTimeout(handleSave, 500);
            }}
            className="flex-1 py-3 px-6 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium shadow-md transition-all"
          >
            Stop & Analyze
          </button>
        )}
      </div>

      {videoUrl && (
        <div className="mt-4 w-full bg-white p-4 rounded-lg shadow-sm border">
          <h3 className="text-md font-medium text-gray-800 mb-2">Your Recording</h3>
          <video 
            src={videoUrl} 
            controls 
            className="w-full h-auto rounded-lg"
          />
        </div>
      )}
    </div>
  );
};

export default VideoRecorder;