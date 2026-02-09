const express = require('express');
const router = express.Router();
const { NotificationController } = require('../controllers');
const authMiddleware = require('../middlewares/auth');

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// Obtener notificaciones
router.get('/', NotificationController.getNotifications);

// Obtener conteo de no leídas
router.get('/unread-count', NotificationController.getUnreadCount);

// Marcar todas como leídas
router.put('/mark-all-read', NotificationController.markAllAsRead);

// Marcar una como leída
router.put('/:id/read', NotificationController.markAsRead);

// Eliminar notificación
router.delete('/:id', NotificationController.deleteNotification);

module.exports = router;
