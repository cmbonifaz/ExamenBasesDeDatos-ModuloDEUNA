const express = require('express');
const router = express.Router();
const { AccountController, AuthController } = require('../controllers');
const authMiddleware = require('../middlewares/auth');

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// Obtener perfil del usuario
router.get('/profile', AuthController.getProfile);

// Actualizar perfil
router.put('/profile', AuthController.updateProfile);

// Cambiar contraseña
router.put('/change-password', AuthController.changePassword);

// Logout
router.post('/logout', AuthController.logout);

// Obtener mis cuentas
router.get('/accounts', AccountController.getMyAccounts);

// Obtener balance total
router.get('/accounts/total-balance', AccountController.getTotalBalance);

// Detalle de cuenta
router.get('/accounts/:id', AccountController.getAccountDetail);

// Transacciones de una cuenta
router.get('/accounts/:id/transactions', AccountController.getAccountTransactions);

// Estadísticas de una cuenta
router.get('/accounts/:id/stats', AccountController.getAccountStats);

// Agregar identificador de pago
router.post('/payment-identifiers', AccountController.addPaymentIdentifier);

module.exports = router;
