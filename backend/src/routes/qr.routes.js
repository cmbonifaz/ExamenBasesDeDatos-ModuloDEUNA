const express = require('express');
const router = express.Router();
const { QRController } = require('../controllers');
const authMiddleware = require('../middlewares/auth');

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// Generar código QR
router.post('/generate', QRController.generateQR);

// Obtener información de QR (para pagar)
router.get('/info/:uuid', QRController.getQRInfo);

// Pagar con QR
router.post('/pay', QRController.payWithQR);

// Obtener mis códigos QR
router.get('/my-codes', QRController.getMyQRs);

// Cancelar código QR
router.delete('/:id', QRController.cancelQR);

module.exports = router;
