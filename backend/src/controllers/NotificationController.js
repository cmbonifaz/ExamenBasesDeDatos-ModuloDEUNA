const { Notification } = require('../models');

class NotificationController {
    // Obtener todas las notificaciones del cliente
    static async getNotifications(req, res) {
        try {
            const { unread_only } = req.query;
            const notifications = await Notification.findByClientId(
                req.user.id, 
                unread_only === 'true'
            );

            res.json({
                success: true,
                data: notifications
            });
        } catch (error) {
            console.error('Error al obtener notificaciones:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener notificaciones'
            });
        }
    }

    // Obtener conteo de no leídas
    static async getUnreadCount(req, res) {
        try {
            const count = await Notification.getUnreadCount(req.user.id);

            res.json({
                success: true,
                data: { unread_count: count }
            });
        } catch (error) {
            console.error('Error al obtener conteo:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener conteo'
            });
        }
    }

    // Marcar notificación como leída
    static async markAsRead(req, res) {
        try {
            const { id } = req.params;
            const marked = await Notification.markAsRead(id, req.user.id);

            if (!marked) {
                return res.status(404).json({
                    success: false,
                    message: 'Notificación no encontrada'
                });
            }

            res.json({
                success: true,
                message: 'Notificación marcada como leída'
            });
        } catch (error) {
            console.error('Error al marcar notificación:', error);
            res.status(500).json({
                success: false,
                message: 'Error al marcar notificación'
            });
        }
    }

    // Marcar todas como leídas
    static async markAllAsRead(req, res) {
        try {
            const count = await Notification.markAllAsRead(req.user.id);

            res.json({
                success: true,
                message: `${count} notificaciones marcadas como leídas`
            });
        } catch (error) {
            console.error('Error al marcar notificaciones:', error);
            res.status(500).json({
                success: false,
                message: 'Error al marcar notificaciones'
            });
        }
    }

    // Eliminar notificación
    static async deleteNotification(req, res) {
        try {
            const { id } = req.params;
            const deleted = await Notification.delete(id, req.user.id);

            if (!deleted) {
                return res.status(404).json({
                    success: false,
                    message: 'Notificación no encontrada'
                });
            }

            res.json({
                success: true,
                message: 'Notificación eliminada'
            });
        } catch (error) {
            console.error('Error al eliminar notificación:', error);
            res.status(500).json({
                success: false,
                message: 'Error al eliminar notificación'
            });
        }
    }
}

module.exports = NotificationController;
