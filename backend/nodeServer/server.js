const express = require('express');
const cors = require('cors');
const app = express();
const videoRoutes = require('./routes/videoRoutes');

// Uptime Robot Health Check Route (first for quick access)
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/video', videoRoutes);

// Server Start
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Node server running on http://localhost:${PORT}`);
});
