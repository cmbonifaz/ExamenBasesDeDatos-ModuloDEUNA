const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const transferRoutes = require('./transfer.routes');
const rechargeRoutes = require('./recharge.routes');
const qrRoutes = require('./qr.routes');
const accountRoutes = require('./account.routes');
const notificationRoutes = require('./notification.routes');

// Rutas de autenticación
router.use('/auth', authRoutes);

// Rutas de transferencias
router.use('/transfers', transferRoutes);

// Rutas de recargas
router.use('/recharges', rechargeRoutes);

// Rutas de QR
router.use('/qr', qrRoutes);

// Rutas de usuario/cuentas
router.use('/user', accountRoutes);

// Rutas de notificaciones
router.use('/notifications', notificationRoutes);

// Ruta de estado del API
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'DEUNA API - Banco Pichincha',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
