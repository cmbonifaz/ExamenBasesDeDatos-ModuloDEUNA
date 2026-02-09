const { getPool } = require('../config/database');

class Notification {
    // Crear notificación
    static async create(notificationData) {
        const pool = getPool();
        const {
            client_id,
            transaction_id,
            notification_type,
            title,
            message,
            sent_via = 'APP'
        } = notificationData;

        const [result] = await pool.query(
            `INSERT INTO notifications (client_id, transaction_id, notification_type, title, message, sent_via)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [client_id, transaction_id, notification_type, title, message, sent_via]
        );

        return result.insertId;
    }

    // Obtener notificaciones de un cliente
    static async findByClientId(clientId, unreadOnly = false) {
        const pool = getPool();
        let query = `
            SELECT n.*, t.amount, t.transaction_type
            FROM notifications n
            LEFT JOIN transactions t ON n.transaction_id = t.id
            WHERE n.client_id = ?
        `;
        const params = [clientId];

        if (unreadOnly) {
            query += ' AND n.is_read = FALSE';
        }

        query += ' ORDER BY n.created_at DESC LIMIT 50';

        const [rows] = await pool.query(query, params);
        return rows;
    }

    // Obtener conteo de no leídas
    static async getUnreadCount(clientId) {
        const pool = getPool();
        const [rows] = await pool.query(
            `SELECT COUNT(*) as count FROM notifications 
             WHERE client_id = ? AND is_read = FALSE`,
            [clientId]
        );
        return rows[0].count;
    }

    // Marcar como leída
    static async markAsRead(id, clientId) {
        const pool = getPool();
        const [result] = await pool.query(
            `UPDATE notifications 
             SET is_read = TRUE, read_at = NOW()
             WHERE id = ? AND client_id = ?`,
            [id, clientId]
        );
        return result.affectedRows > 0;
    }

    // Marcar todas como leídas
    static async markAllAsRead(clientId) {
        const pool = getPool();
        const [result] = await pool.query(
            `UPDATE notifications 
             SET is_read = TRUE, read_at = NOW()
             WHERE client_id = ? AND is_read = FALSE`,
            [clientId]
        );
        return result.affectedRows;
    }

    // Eliminar notificación
    static async delete(id, clientId) {
        const pool = getPool();
        const [result] = await pool.query(
            `DELETE FROM notifications WHERE id = ? AND client_id = ?`,
            [id, clientId]
        );
        return result.affectedRows > 0;
    }

    // Crear notificación de transferencia enviada
    static async createTransferSent(clientId, transactionId, recipientName, amount) {
        return await this.create({
            client_id: clientId,
            transaction_id: transactionId,
            notification_type: 'TRANSFERENCIA_ENVIADA',
            title: 'Transferencia Exitosa',
            message: `Has enviado $${parseFloat(amount).toFixed(2)} a ${recipientName}`
        });
    }

    // Crear notificación de transferencia recibida
    static async createTransferReceived(clientId, transactionId, senderName, amount) {
        return await this.create({
            client_id: clientId,
            transaction_id: transactionId,
            notification_type: 'TRANSFERENCIA_RECIBIDA',
            title: 'Dinero Recibido',
            message: `Has recibido $${parseFloat(amount).toFixed(2)} de ${senderName}`
        });
    }

    // Crear notificación de recarga
    static async createRecharge(clientId, transactionId, amount, description) {
        return await this.create({
            client_id: clientId,
            transaction_id: transactionId,
            notification_type: 'RECARGA',
            title: 'Recarga Exitosa',
            message: `Tu recarga de $${parseFloat(amount).toFixed(2)} fue procesada. ${description || ''}`
        });
    }

    // Crear notificación de pago QR
    static async createQRPayment(clientId, transactionId, payerName, amount) {
        return await this.create({
            client_id: clientId,
            transaction_id: transactionId,
            notification_type: 'PAGO_QR',
            title: 'Pago QR Recibido',
            message: `Has recibido $${parseFloat(amount).toFixed(2)} de ${payerName} mediante QR`
        });
    }

    // Crear alerta
    static async createAlert(clientId, title, message) {
        return await this.create({
            client_id: clientId,
            notification_type: 'ALERTA',
            title,
            message
        });
    }
}

module.exports = Notification;
