const express = require('express');
const router = express.Router();
const ingredientAdminController = require('../controllers/ingredientAdminController');

// Quản lý nguyên liệu
router.get('/ingredients', ingredientAdminController.listIngredients);
router.get('/ingredients/new', ingredientAdminController.renderNewForm);
router.post('/ingredients', ingredientAdminController.createIngredient);
router.get('/ingredients/:id/edit', ingredientAdminController.renderEditForm);
router.patch('/ingredients/:id', ingredientAdminController.updateIngredient);
router.get('/ingredients/:id/delete', ingredientAdminController.renderDeleteConfirm);
router.delete('/ingredients/:id', ingredientAdminController.deleteIngredient);

module.exports = router;
