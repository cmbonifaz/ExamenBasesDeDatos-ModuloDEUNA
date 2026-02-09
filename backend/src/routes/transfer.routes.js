const express = require('express');
const router = express.Router();
const { TransferController } = require('../controllers');
const authMiddleware = require('../middlewares/auth');

// Todas las rutas de transferencia requieren autenticación
router.use(authMiddleware);

// Realizar transferencia
router.post('/', TransferController.transfer);

// Buscar destinatario
router.get('/search-recipient', TransferController.searchRecipient);

// Historial de transferencias
router.get('/history', TransferController.getTransferHistory);

// Detalle de transferencia
router.get('/:id', TransferController.getTransferDetail);

// Calcular comisión
router.get('/calculate/commission', TransferController.calculateCommission);

module.exports = router;
