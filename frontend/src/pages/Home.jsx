import React from 'react';
import { Link } from 'react-router-dom';

const Home = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-50 flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full mx-auto text-center">
        {/* Header */}
        <h1 className="text-4xl font-bold text-gray-800 mb-6">
          Posture Recorder
        </h1>
        
        {/* Subtitle */}
        <p className="text-lg text-gray-600 mb-8">
          Improve your posture with our easy-to-use recording tool
        </p>
        
        {/* Main Option Card */}
        <Link 
          to="/record" 
          className="block bg-white rounded-xl shadow-lg overflow-hidden transition-all duration-300 hover:shadow-xl hover:transform hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
        >
          <div className="p-8">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-8 w-8 text-blue-600" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" 
                  />
                </svg>
              </div>
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              Start Recording
            </h2>
            <p className="text-gray-600">
              Record or upload your posture video for analysis
            </p>
          </div>
        </Link>

        {/* Features Section */}
        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="font-medium text-gray-800 mb-2">Squat Analysis</h3>
            <p className="text-sm text-gray-600">
              Perfect your squat form with our movement tracking
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="font-medium text-gray-800 mb-2">Desk Posture</h3>
            <p className="text-sm text-gray-600">
              Improve your sitting posture for better spinal health
            </p>
          </div>
        </div>

        {/* Footer Note */}
        <p className="mt-8 text-sm text-gray-500">
          Works best on Chrome or Firefox with a modern webcam
        </p>
      </div>
    </div>
  );
};

export default Home;