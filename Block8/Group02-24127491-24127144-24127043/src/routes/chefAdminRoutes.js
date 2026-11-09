const express = require('express');
const router = express.Router();
const chefAdminController = require('../controllers/chefAdminController');

// Quản lý đầu bếp
router.get('/chefs', chefAdminController.listChefs);
router.get('/chefs/new', chefAdminController.renderNewForm);
router.post('/chefs', chefAdminController.createChef);
router.get('/chefs/:id/edit', chefAdminController.renderEditForm);
router.patch('/chefs/:id', chefAdminController.updateChef);
router.get('/chefs/:id/delete', chefAdminController.renderDeleteConfirm);
router.delete('/chefs/:id', chefAdminController.deleteChef);

module.exports = router;
