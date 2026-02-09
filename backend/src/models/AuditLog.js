const { getPool } = require('../config/database');

class AuditLog {
    // Crear registro de auditoría
    static async create(logData) {
        const pool = getPool();
        const {
            client_id,
            action_type,
            entity_type,
            entity_id,
            old_values,
            new_values,
            ip_address,
            user_agent,
            session_id,
            status = 'SUCCESS',
            error_message
        } = logData;

        const [result] = await pool.query(
            `INSERT INTO audit_logs (
                client_id, action_type, entity_type, entity_id,
                old_values, new_values, ip_address, user_agent, 
                session_id, status, error_message
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                client_id, action_type, entity_type, entity_id,
                old_values ? JSON.stringify(old_values) : null,
                new_values ? JSON.stringify(new_values) : null,
                ip_address, user_agent, session_id, status, error_message
            ]
        );

        return result.insertId;
    }

    // Obtener logs con filtros
    static async findAll(filters = {}) {
        const pool = getPool();
        let query = `
            SELECT al.*, c.first_name, c.last_name, c.cedula
            FROM audit_logs al
            LEFT JOIN clients c ON al.client_id = c.id
            WHERE 1=1
        `;
        const params = [];

        if (filters.client_id) {
            query += ' AND al.client_id = ?';
            params.push(filters.client_id);
        }

        if (filters.action_type) {
            query += ' AND al.action_type = ?';
            params.push(filters.action_type);
        }

        if (filters.entity_type) {
            query += ' AND al.entity_type = ?';
            params.push(filters.entity_type);
        }

        if (filters.status) {
            query += ' AND al.status = ?';
            params.push(filters.status);
        }

        if (filters.from_date) {
            query += ' AND al.created_at >= ?';
            params.push(filters.from_date);
        }

        if (filters.to_date) {
            query += ' AND al.created_at <= ?';
            params.push(filters.to_date);
        }

        query += ' ORDER BY al.created_at DESC';

        if (filters.limit) {
            query += ' LIMIT ?';
            params.push(parseInt(filters.limit));
        }

        if (filters.offset) {
            query += ' OFFSET ?';
            params.push(parseInt(filters.offset));
        }

        const [rows] = await pool.query(query, params);
        return rows;
    }

    // Obtener log por ID
    static async findById(id) {
        const pool = getPool();
        const [rows] = await pool.query(
            `SELECT al.*, c.first_name, c.last_name, c.cedula
             FROM audit_logs al
             LEFT JOIN clients c ON al.client_id = c.id
             WHERE al.id = ?`,
            [id]
        );
        return rows[0];
    }

    // Obtener logs de un cliente
    static async findByClientId(clientId, limit = 100) {
        const pool = getPool();
        const [rows] = await pool.query(
            `SELECT * FROM audit_logs 
             WHERE client_id = ?
             ORDER BY created_at DESC
             LIMIT ?`,
            [clientId, limit]
        );
        return rows;
    }

    // Obtener estadísticas de auditoría
    static async getStatistics(fromDate, toDate) {
        const pool = getPool();
        const [rows] = await pool.query(
            `SELECT 
                action_type,
                status,
                COUNT(*) as count
             FROM audit_logs
             WHERE created_at BETWEEN ? AND ?
             GROUP BY action_type, status
             ORDER BY action_type, status`,
            [fromDate, toDate]
        );
        return rows;
    }

    // Limpiar logs antiguos (más de X días)
    static async cleanOldLogs(daysToKeep = 90) {
        const pool = getPool();
        const [result] = await pool.query(
            `DELETE FROM audit_logs 
             WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
            [daysToKeep]
        );
        return result.affectedRows;
    }
}

module.exports = AuditLog;
