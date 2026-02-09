const express = require('express');
const router = express.Router();
const { RechargeController } = require('../controllers');
const authMiddleware = require('../middlewares/auth');

// Obtener proveedores (público)
router.get('/providers', RechargeController.getProviders);

// Rutas que requieren autenticación
router.use(authMiddleware);

// Realizar recarga
router.post('/', RechargeController.recharge);

// Historial de recargas
router.get('/history', RechargeController.getRechargeHistory);

// Montos sugeridos
router.get('/suggested-amounts', RechargeController.getSuggestedAmounts);

// Calcular comision
router.get('/calculate-commission', RechargeController.calculateCommission);

module.exports = router;
