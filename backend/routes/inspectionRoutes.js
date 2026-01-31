const express = require('express');
const router = express.Router();
const {
    createInspection,
    getInspections,
    getInspectionStats,
    deleteInspection,
} = require('../controllers/inspectionController');

router.route('/')
    .post(createInspection)
    .get(getInspections);

router.get('/stats', getInspectionStats);
router.delete('/:id', deleteInspection);

module.exports = router;
