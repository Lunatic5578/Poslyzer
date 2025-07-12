const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

/**
 * For full video file upload (handled by multer)
 */
const analyzeUploadedVideo = async (req, res) => {
  try {
    const filePath = req.file.path;
    const form = new FormData();

    form.append('video', fs.createReadStream(filePath));
    form.append('mode', req.body.mode || 'squat');

    const pythonurl= process.env.PYTHON_URL || 'http://127.0.0.1:5001/';

    const response = await axios.post(pythonurl+'/analyze', form, {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    // Cleanup
    fs.unlinkSync(filePath);

    res.status(200).json({
      success: true,
      flaskResponse: response.data,
    });

  } catch (error) {
    console.error('Error from Flask (uploaded video):', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * For frame-by-frame analysis (real-time webcam or previewed video)
 */
const analyzeSingleFrame = async (req, res) => {
  try {
    const imageBuffer = req.file.buffer;
    const mode = req.body.mode || 'squat';

    const form = new FormData();
    form.append('image', imageBuffer, {
      filename: 'frame.jpg',
      contentType: 'image/jpeg',
    });
    form.append('mode', mode);

    const response = await axios.post('http://127.0.0.1:5001/frame', form, {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    res.status(200).json({
      success: true,
      feedback: response.data,
    });

  } catch (error) {
    console.error('Error from Flask (frame analysis):', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  analyzeUploadedVideo,
  analyzeSingleFrame,
};
