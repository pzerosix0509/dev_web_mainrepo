const express = require('express');
const studentController = require('../controllers/student.controller');

const router = express.Router();

// JSON API Endpoints for Client-Side Rendering (CSR)
router.get('/api/students', studentController.listStudentsJson);
router.post('/api/students', studentController.createStudentJson);
router.post('/api/students/reset', studentController.resetStudentsJson);

// HTML Shell Routes (Browser loads empty #root shell, React mounts UI)
router.get('/', studentController.serveAppShell);
router.get('/students', studentController.serveAppShell);

module.exports = router;
