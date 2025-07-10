const express = require('express');
const router = express.Router();
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const {
  analyzeUploadedVideo,
  analyzeSingleFrame
} = require('../controllers/videoController');

// Multer setup for full video uploads
const uploadVideo = multer({ dest: 'uploads/' });

// Multer setup for in-memory single frame (no disk save)
const uploadFrame = multer({ storage: multer.memoryStorage() });

// Multer setup for exercise analysis (saves to disk temporarily)
const uploadExercise = multer({ dest: 'temp/' });

/**
 * @route POST /api/video/analyze
 * @desc Analyze full uploaded video file
 */
router.post('/analyze', uploadVideo.single('video'), analyzeUploadedVideo);

/**
 * @route POST /api/video/frame
 * @desc Analyze a single image frame (from webcam or canvas snapshot)
 */
router.post('/frame', uploadFrame.single('image'), analyzeSingleFrame);

/**
 * @route POST /api/video/analyze-squat
 * @desc Analyze squat form from uploaded image/frame
 */
router.post('/analyze-squat', uploadExercise.single('frame'), async (req, res) => {
    try {
        // Handle both file upload and imagePath from body
        let imagePath;
        
        if (req.file) {
            // If file was uploaded via multer
            imagePath = req.file.path;
        } else if (req.body.imagePath) {
            // If imagePath was provided in body
            imagePath = req.body.imagePath;
        } else {
            return res.status(400).json({ error: 'No image provided' });
        }

        const form = new FormData();
        form.append('frame', fs.createReadStream(imagePath));
        
        const response = await axios.post('http://localhost:5001/analyze/squat', form, {
            headers: form.getHeaders()
        });
        
        // Clean up temp file if it was uploaded
        if (req.file) {
            fs.unlinkSync(imagePath);
        }
        
        res.json(response.data);
    } catch (error) {
        // Clean up temp file on error
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route POST /api/video/analyze-sit
 * @desc Analyze sit-up form from uploaded image/frame
 */
router.post('/analyze-sit', uploadExercise.single('frame'), async (req, res) => {
    try {
        // Handle both file upload and imagePath from body
        let imagePath;
        
        if (req.file) {
            // If file was uploaded via multer
            imagePath = req.file.path;
        } else if (req.body.imagePath) {
            // If imagePath was provided in body
            imagePath = req.body.imagePath;
        } else {
            return res.status(400).json({ error: 'No image provided' });
        }

        const form = new FormData();
        form.append('frame', fs.createReadStream(imagePath));
        
        const response = await axios.post('http://localhost:5001/analyze/sit', form, {
            headers: form.getHeaders()
        });
        
        // Clean up temp file if it was uploaded
        if (req.file) {
            fs.unlinkSync(imagePath);
        }
        
        res.json(response.data);
    } catch (error) {
        // Clean up temp file on error
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: error.message });
    }
});

// Error handling middleware for multer
router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        return res.status(400).json({ error: error.message });
    }
    next(error);
});

module.exports = router;