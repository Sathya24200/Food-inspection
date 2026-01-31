const Inspection = require('../models/Inspection');

// @desc    Create new inspection
// @route   POST /api/inspections
// @access  Private
const createInspection = async (req, res) => {
    try {
        const { packageId, temperature, weight, isSealed, imageData } = req.body;

        // Validation
        if (!packageId || temperature === undefined || weight === undefined || isSealed === undefined) {
            return res.status(400).json({ message: 'Please provide all required fields' });
        }

        // Decision logic
        let status = 'passed';
        let reason = '';

        // Temperature check (acceptable range: 0-25°C)
        if (temperature < 0 || temperature > 25) {
            status = 'rejected';
            reason += `Temperature out of range (${temperature}°C). `;
        }

        // Weight check (acceptable range: 100-1000g)
        if (weight < 100 || weight > 1000) {
            status = 'rejected';
            reason += `Weight out of range (${weight}g). `;
        }

        // Seal check
        if (!isSealed) {
            status = 'rejected';
            reason += 'Package is unsealed. ';
        }

        if (status === 'passed') {
            reason = 'All parameters within acceptable range';
        }

        // Create inspection record
        const inspection = await Inspection.create({
            packageId,
            temperature,
            weight,
            isSealed,
            status,
            imageData,
            reason: reason.trim(),
        });

        res.status(201).json(inspection);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all inspections
// @route   GET /api/inspections
// @access  Public
const getInspections = async (req, res) => {
    try {
        const inspections = await Inspection.find({})
            .sort({ timestamp: -1 })
            .limit(100);

        res.json(inspections);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get inspection statistics
// @route   GET /api/inspections/stats
// @access  Public
const getInspectionStats = async (req, res) => {
    try {
        const totalPackages = await Inspection.countDocuments({});
        const passedPackages = await Inspection.countDocuments({ status: 'passed' });
        const rejectedPackages = await Inspection.countDocuments({ status: 'rejected' });
        const sealedPackages = await Inspection.countDocuments({ isSealed: true });
        const unsealedPackages = await Inspection.countDocuments({ isSealed: false });

        res.json({
            totalPackages,
            passedPackages,
            rejectedPackages,
            sealedPackages,
            unsealedPackages,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete inspection
// @route   DELETE /api/inspections/:id
// @access  Public
const deleteInspection = async (req, res) => {
    try {
        const inspection = await Inspection.findById(req.params.id);

        if (!inspection) {
            return res.status(404).json({ message: 'Inspection not found' });
        }

        await inspection.deleteOne();

        res.json({ message: 'Inspection removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createInspection,
    getInspections,
    getInspectionStats,
    deleteInspection,
};
