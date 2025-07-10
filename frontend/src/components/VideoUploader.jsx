// src/components/VideoUploader/VideoUploader.jsx
import React, { useState } from 'react';

const VideoUploader = () => {
  const [videoUrl, setVideoUrl] = useState('');

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
    }
  };

  return (
    <div className="video-uploader">
      <input
        type="file"
        accept="video/*"
        onChange={handleFileChange}
      />
      {videoUrl && (
        <div className="uploaded-video">
          <video src={videoUrl} controls width="640" height="480" />
        </div>
      )}
    </div>
  );
};

export default VideoUploader;  