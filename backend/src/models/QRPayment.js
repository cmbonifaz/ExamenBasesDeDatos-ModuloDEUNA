const { getPool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');

class QRPayment {
    // Obtener QR por ID
    static async findById(id) {
        const pool = getPool();
        const [rows] = await pool.query(
            `SELECT qr.*, 
                    c.first_name, c.last_name, c.cedula,
                    a.account_number
             FROM qr_payments qr
             JOIN clients c ON qr.creator_client_id = c.id
             JOIN accounts a ON qr.creator_account_id = a.id
             WHERE qr.id = ?`,
            [id]
        );
        return rows[0];
    }

    // Obtener QR por UUID
    static async findByUuid(uuid) {
        const pool = getPool();
        const [rows] = await pool.query(
            `SELECT qr.*, 
                    c.first_name, c.last_name, c.cedula, c.email,
                    a.account_number, a.id as account_id
             FROM qr_payments qr
             JOIN clients c ON qr.creator_client_id = c.id
             JOIN accounts a ON qr.creator_account_id = a.id
             WHERE qr.qr_uuid = ?`,
            [uuid]
        );
        return rows[0];
    }

    // Obtener QRs de un cliente
    static async findByClientId(clientId) {
        const pool = getPool();
        const [rows] = await pool.query(
            `SELECT qr.*, a.account_number
             FROM qr_payments qr
             JOIN accounts a ON qr.creator_account_id = a.id
             WHERE qr.creator_client_id = ?
             ORDER BY qr.created_at DESC`,
            [clientId]
        );
        return rows;
    }

    // Crear nuevo código QR
    static async create(qrData) {
        const pool = getPool();
        const {
            creator_client_id,
            creator_account_id,
            amount,
            is_amount_fixed = true,
            min_amount,
            max_amount,
            description,
            reference,
            expiry_minutes = 30,
            usage_type = 'SINGLE_USE',
            max_uses = 1
        } = qrData;

        const qr_uuid = uuidv4();
        const expiry_datetime = new Date(Date.now() + expiry_minutes * 60 * 1000);

        // Generar datos del QR
        const qrPayload = {
            uuid: qr_uuid,
            type: 'DEUNA_PAYMENT',
            amount: amount,
            fixed: is_amount_fixed,
            ref: reference,
            exp: expiry_datetime.getTime()
        };

        // Generar código QR como base64
        const qr_code_data = await QRCode.toDataURL(JSON.stringify(qrPayload), {
            errorCorrectionLevel: 'M',
            type: 'image/png',
            quality: 0.92,
            margin: 2,
            width: 300
        });

        const [result] = await pool.query(
            `INSERT INTO qr_payments (
                qr_uuid, creator_client_id, creator_account_id, amount, is_amount_fixed,
                min_amount, max_amount, description, reference, qr_code_data, 
                expiry_datetime, usage_type, max_uses
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                qr_uuid, creator_client_id, creator_account_id, amount, is_amount_fixed,
                min_amount, max_amount, description, reference, qr_code_data,
                expiry_datetime, usage_type, max_uses
            ]
        );

        return {
            id: result.insertId,
            uuid: qr_uuid,
            qr_code: qr_code_data,
            expiry_datetime
        };
    }

    // Validar QR para pago
    static async validateForPayment(uuid) {
        const qr = await this.findByUuid(uuid);

        if (!qr) {
            return { valid: false, error: 'Código QR no encontrado' };
        }

        if (qr.status !== 'ACTIVO') {
            return { valid: false, error: `Código QR ${qr.status.toLowerCase()}` };
        }

        if (new Date(qr.expiry_datetime) < new Date()) {
            // Actualizar estado a expirado
            await this.updateStatus(qr.id, 'EXPIRADO');
            return { valid: false, error: 'Código QR expirado' };
        }

        if (qr.usage_type === 'SINGLE_USE' && qr.times_used >= 1) {
            return { valid: false, error: 'Código QR ya utilizado' };
        }

        if (qr.usage_type === 'MULTIPLE_USE' && qr.times_used >= qr.max_uses) {
            return { valid: false, error: 'Código QR ha alcanzado el máximo de usos' };
        }

        return { valid: true, qr };
    }

    // Marcar QR como usado
    static async markAsUsed(id, connection = null) {
        const db = connection || getPool();
        
        // Incrementar contador de usos
        await db.query(
            `UPDATE qr_payments SET times_used = times_used + 1 WHERE id = ?`,
            [id]
        );

        // Verificar si debe marcarse como USADO
        const [qr] = await db.query(
            `SELECT usage_type, times_used, max_uses FROM qr_payments WHERE id = ?`,
            [id]
        );

        if (qr[0] && (qr[0].usage_type === 'SINGLE_USE' || qr[0].times_used >= qr[0].max_uses)) {
            await db.query(
                `UPDATE qr_payments SET status = 'USADO' WHERE id = ?`,
                [id]
            );
        }
    }

    // Actualizar estado
    static async updateStatus(id, status) {
        const pool = getPool();
        const [result] = await pool.query(
            `UPDATE qr_payments SET status = ? WHERE id = ?`,
            [status, id]
        );
        return result.affectedRows > 0;
    }

    // Cancelar QR
    static async cancel(id, clientId) {
        const pool = getPool();
        const [result] = await pool.query(
            `UPDATE qr_payments 
             SET status = 'CANCELADO' 
             WHERE id = ? AND creator_client_id = ? AND status = 'ACTIVO'`,
            [id, clientId]
        );
        return result.affectedRows > 0;
    }

    // Obtener QRs expirados para actualización
    static async getExpiredQRs() {
        const pool = getPool();
        const [rows] = await pool.query(
            `SELECT id FROM qr_payments 
             WHERE status = 'ACTIVO' AND expiry_datetime < NOW()`
        );
        return rows;
    }

    // Actualizar QRs expirados
    static async expireOldQRs() {
        const pool = getPool();
        const [result] = await pool.query(
            `UPDATE qr_payments 
             SET status = 'EXPIRADO' 
             WHERE status = 'ACTIVO' AND expiry_datetime < NOW()`
        );
        return result.affectedRows;
    }

    // Obtener QRs activos de una cuenta
    static async getActiveByAccountId(accountId) {
        const pool = getPool();
        const [rows] = await pool.query(
            `SELECT * FROM qr_payments 
             WHERE creator_account_id = ? AND status = 'ACTIVO'
             ORDER BY created_at DESC`,
            [accountId]
        );
        return rows;
    }
}

module.exports = QRPayment;
