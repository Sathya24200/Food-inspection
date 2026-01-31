const mongoose = require('mongoose');

const inspectionSchema = new mongoose.Schema({
    packageId: {
        type: String,
        required: true,
    },
    temperature: {
        type: Number,
        required: true,
    },
    weight: {
        type: Number,
        required: true,
    },
    isSealed: {
        type: Boolean,
        required: true,
    },
    status: {
        type: String,
        enum: ['passed', 'rejected'],
        required: true,
    },
    imageData: {
        type: String, // Base64 encoded image
    },
    reason: {
        type: String,
    },
    timestamp: {
        type: Date,
        default: Date.now,
    },
});

// Index for faster queries
inspectionSchema.index({ timestamp: -1 });

module.exports = mongoose.model('Inspection', inspectionSchema);
