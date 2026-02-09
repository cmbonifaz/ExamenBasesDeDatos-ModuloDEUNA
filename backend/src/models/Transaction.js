const { getPool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class Transaction {
    // Obtener todas las transacciones con filtros
    static async findAll(filters = {}) {
        const pool = getPool();
        let query = `
            SELECT t.*,
                   sa.account_number as source_account_number,
                   sc.first_name as source_first_name,
                   sc.last_name as source_last_name,
                   da.account_number as destination_account_number,
                   dc.first_name as destination_first_name,
                   dc.last_name as destination_last_name
            FROM transactions t
            LEFT JOIN accounts sa ON t.source_account_id = sa.id
            LEFT JOIN clients sc ON sa.client_id = sc.id
            LEFT JOIN accounts da ON t.destination_account_id = da.id
            LEFT JOIN clients dc ON da.client_id = dc.id
            WHERE 1=1
        `;
        const params = [];

        if (filters.transaction_type) {
            query += ' AND t.transaction_type = ?';
            params.push(filters.transaction_type);
        }

        if (filters.status) {
            query += ' AND t.status = ?';
            params.push(filters.status);
        }

        if (filters.source_account_id) {
            query += ' AND t.source_account_id = ?';
            params.push(filters.source_account_id);
        }

        if (filters.destination_account_id) {
            query += ' AND t.destination_account_id = ?';
            params.push(filters.destination_account_id);
        }

        if (filters.client_id) {
            query += ' AND (sa.client_id = ? OR da.client_id = ?)';
            params.push(filters.client_id, filters.client_id);
        }

        if (filters.from_date) {
            query += ' AND t.created_at >= ?';
            params.push(filters.from_date);
        }

        if (filters.to_date) {
            query += ' AND t.created_at <= ?';
            params.push(filters.to_date);
        }

        if (filters.min_amount) {
            query += ' AND t.amount >= ?';
            params.push(filters.min_amount);
        }

        if (filters.max_amount) {
            query += ' AND t.amount <= ?';
            params.push(filters.max_amount);
        }

        query += ' ORDER BY t.created_at DESC';

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

    // Obtener transacción por ID
    static async findById(id) {
        const pool = getPool();
        const [rows] = await pool.query(
            `SELECT t.*,
                    sa.account_number as source_account_number,
                    sc.first_name as source_first_name,
                    sc.last_name as source_last_name,
                    sc.cedula as source_cedula,
                    da.account_number as destination_account_number,
                    dc.first_name as destination_first_name,
                    dc.last_name as destination_last_name,
                    dc.cedula as destination_cedula
             FROM transactions t
             LEFT JOIN accounts sa ON t.source_account_id = sa.id
             LEFT JOIN clients sc ON sa.client_id = sc.id
             LEFT JOIN accounts da ON t.destination_account_id = da.id
             LEFT JOIN clients dc ON da.client_id = dc.id
             WHERE t.id = ?`,
            [id]
        );
        return rows[0];
    }

    // Obtener transacción por UUID
    static async findByUuid(uuid) {
        const pool = getPool();
        const [rows] = await pool.query(
            `SELECT t.*,
                    sa.account_number as source_account_number,
                    sc.first_name as source_first_name,
                    sc.last_name as source_last_name,
                    da.account_number as destination_account_number,
                    dc.first_name as destination_first_name,
                    dc.last_name as destination_last_name
             FROM transactions t
             LEFT JOIN accounts sa ON t.source_account_id = sa.id
             LEFT JOIN clients sc ON sa.client_id = sc.id
             LEFT JOIN accounts da ON t.destination_account_id = da.id
             LEFT JOIN clients dc ON da.client_id = dc.id
             WHERE t.transaction_uuid = ?`,
            [uuid]
        );
        return rows[0];
    }

    // Obtener transacciones de una cuenta
    static async findByAccountId(accountId, limit = 50) {
        const pool = getPool();
        const [rows] = await pool.query(
            `SELECT t.*,
                    sa.account_number as source_account_number,
                    sc.first_name as source_first_name,
                    sc.last_name as source_last_name,
                    da.account_number as destination_account_number,
                    dc.first_name as destination_first_name,
                    dc.last_name as destination_last_name,
                    CASE 
                        WHEN t.source_account_id = ? THEN 'ENVIADA'
                        ELSE 'RECIBIDA'
                    END as direction
             FROM transactions t
             LEFT JOIN accounts sa ON t.source_account_id = sa.id
             LEFT JOIN clients sc ON sa.client_id = sc.id
             LEFT JOIN accounts da ON t.destination_account_id = da.id
             LEFT JOIN clients dc ON da.client_id = dc.id
             WHERE t.source_account_id = ? OR t.destination_account_id = ?
             ORDER BY t.created_at DESC
             LIMIT ?`,
            [accountId, accountId, accountId, limit]
        );
        return rows;
    }

    // Crear nueva transacción
    static async create(transactionData, connection = null) {
        const db = connection || getPool();
        const {
            transaction_type,
            source_account_id,
            destination_account_id,
            amount,
            commission = 0,
            description,
            reference,
            is_interbank = false,
            destination_bank,
            destination_account_external,
            qr_payment_id
        } = transactionData;

        const transaction_uuid = uuidv4();
        const total_amount = parseFloat(amount) + parseFloat(commission);

        const [result] = await db.query(
            `INSERT INTO transactions (
                transaction_uuid, transaction_type, source_account_id, destination_account_id,
                amount, commission, total_amount, description, reference, status,
                is_interbank, destination_bank, destination_account_external, qr_payment_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDIENTE', ?, ?, ?, ?)`,
            [
                transaction_uuid, transaction_type, source_account_id, destination_account_id,
                amount, commission, total_amount, description, reference,
                is_interbank, destination_bank, destination_account_external, qr_payment_id
            ]
        );

        return { id: result.insertId, uuid: transaction_uuid };
    }

    // Actualizar estado de transacción
    static async updateStatus(id, status, failureReason = null, connection = null) {
        const db = connection || getPool();
        const processedAt = ['CONFIRMADA', 'FALLIDA', 'REVERSADA'].includes(status) ? 'NOW()' : 'NULL';
        
        const [result] = await db.query(
            `UPDATE transactions 
             SET status = ?, 
                 failure_reason = ?,
                 processed_at = ${processedAt === 'NOW()' ? 'NOW()' : 'NULL'}
             WHERE id = ?`,
            [status, failureReason, id]
        );
        return result.affectedRows > 0;
    }

    // Obtener estadísticas de transacciones
    static async getStatistics(filters = {}) {
        const pool = getPool();
        let query = `
            SELECT 
                COUNT(*) as total_transactions,
                SUM(CASE WHEN status = 'CONFIRMADA' THEN amount ELSE 0 END) as total_amount,
                SUM(CASE WHEN status = 'CONFIRMADA' THEN commission ELSE 0 END) as total_commissions,
                COUNT(CASE WHEN status = 'CONFIRMADA' THEN 1 END) as confirmed_count,
                COUNT(CASE WHEN status = 'FALLIDA' THEN 1 END) as failed_count,
                COUNT(CASE WHEN status = 'PENDIENTE' THEN 1 END) as pending_count,
                COUNT(CASE WHEN transaction_type = 'TRANSFERENCIA' THEN 1 END) as transfers_count,
                COUNT(CASE WHEN transaction_type = 'RECARGA' THEN 1 END) as recharges_count,
                COUNT(CASE WHEN transaction_type = 'PAGO_QR' THEN 1 END) as qr_payments_count
            FROM transactions
            WHERE 1=1
        `;
        const params = [];

        if (filters.from_date) {
            query += ' AND created_at >= ?';
            params.push(filters.from_date);
        }

        if (filters.to_date) {
            query += ' AND created_at <= ?';
            params.push(filters.to_date);
        }

        if (filters.client_id) {
            query += ` AND (source_account_id IN (SELECT id FROM accounts WHERE client_id = ?) 
                       OR destination_account_id IN (SELECT id FROM accounts WHERE client_id = ?))`;
            params.push(filters.client_id, filters.client_id);
        }

        const [rows] = await pool.query(query, params);
        return rows[0];
    }

    // Obtener transacciones pendientes para procesamiento
    static async getPendingTransactions() {
        const pool = getPool();
        const [rows] = await pool.query(
            `SELECT * FROM transactions WHERE status = 'PENDIENTE' ORDER BY created_at ASC`
        );
        return rows;
    }

    // Obtener transacciones expiradas (más de 24 horas en PENDIENTE)
    static async getExpiredTransactions() {
        const pool = getPool();
        const [rows] = await pool.query(
            `SELECT * FROM transactions 
             WHERE status = 'PENDIENTE' 
             AND created_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)`
        );
        return rows;
    }

    // Reversar transacción
    static async reverse(transactionId, reason, connection = null) {
        const db = connection || getPool();
        const [result] = await db.query(
            `UPDATE transactions 
             SET status = 'REVERSADA', 
                 failure_reason = ?,
                 processed_at = NOW()
             WHERE id = ? AND status = 'CONFIRMADA'`,
            [reason, transactionId]
        );
        return result.affectedRows > 0;
    }

    // Generar referencia única
    static generateReference(type = 'TRF') {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 8).toUpperCase();
        return `${type}-${timestamp}-${random}`;
    }
}

module.exports = Transaction;
