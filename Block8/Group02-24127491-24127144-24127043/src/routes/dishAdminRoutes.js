const express = require('express');
const router = express.Router();
const dishAdminController = require('../controllers/dishAdminController');

// Quản lý món ăn
router.get('/dishes', dishAdminController.listDishes);
router.get('/dishes/new', dishAdminController.renderNewForm);
router.post('/dishes', dishAdminController.createDish);
router.get('/dishes/:id/edit', dishAdminController.renderEditForm);
router.patch('/dishes/:id', dishAdminController.updateDish);
router.get('/dishes/:id/delete', dishAdminController.renderDeleteConfirm);
router.delete('/dishes/:id', dishAdminController.deleteDish);

module.exports = router;
