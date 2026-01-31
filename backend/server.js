require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

// Route imports
const authRoutes = require('./routes/authRoutes');
const inspectionRoutes = require('./routes/inspectionRoutes');

// Connect to database
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased limit for base64 images
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/inspections', inspectionRoutes);

// Serve static files from the React frontend app
const path = require('path');
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// API Root route
app.get('/api', (req, res) => {
    res.json({ message: 'Food Quality Inspection API is running' });
});

// Anything that doesn't match the above routes, send back index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!' });
});

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Either stop the process using that port or set a different PORT environment variable before starting the app.`);
        process.exit(1);
    } else {
        console.error('Server error:', err);
        process.exit(1);
    }
});
