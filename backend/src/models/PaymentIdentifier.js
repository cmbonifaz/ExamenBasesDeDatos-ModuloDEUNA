const { getPool } = require('../config/database');

class PaymentIdentifier {
    // Obtener todos los identificadores de un cliente
    static async findByClientId(clientId) {
        const pool = getPool();
        const [rows] = await pool.query(
            `SELECT pi.*, a.account_number, a.account_type
             FROM payment_identifiers pi
             JOIN accounts a ON pi.account_id = a.id
             WHERE pi.client_id = ? AND pi.status = 'ACTIVO'
             ORDER BY pi.is_primary DESC, pi.created_at DESC`,
            [clientId]
        );
        return rows;
    }

    // Buscar por valor de identificador (para transferencias)
    static async findByIdentifierValue(value) {
        const pool = getPool();
        const [rows] = await pool.query(
            `SELECT pi.*, a.account_number, a.id as account_id, a.status as account_status,
                    c.first_name, c.last_name, c.cedula
             FROM payment_identifiers pi
             JOIN accounts a ON pi.account_id = a.id
             JOIN clients c ON pi.client_id = c.id
             WHERE pi.identifier_value = ? AND pi.status = 'ACTIVO' AND a.status = 'ACTIVA'`,
            [value]
        );
        return rows[0];
    }

    // Buscar por teléfono o email (para transferencias rápidas)
    static async findByPhoneOrEmail(value) {
        const pool = getPool();
        const [rows] = await pool.query(
            `SELECT pi.*, a.account_number, a.id as account_id,
                    c.first_name, c.last_name, c.cedula
             FROM payment_identifiers pi
             JOIN accounts a ON pi.account_id = a.id
             JOIN clients c ON pi.client_id = c.id
             WHERE (pi.identifier_type IN ('PHONE', 'EMAIL') AND pi.identifier_value = ?)
             AND pi.status = 'ACTIVO' AND a.status = 'ACTIVA'
             AND pi.is_primary = TRUE`,
            [value]
        );
        return rows[0];
    }

    // Crear nuevo identificador
    static async create(identifierData) {
        const pool = getPool();
        const { client_id, account_id, identifier_type, identifier_value, is_primary = false } = identifierData;

        // Si es primario, desactivar otros primarios del mismo tipo
        if (is_primary) {
            await pool.query(
                `UPDATE payment_identifiers 
                 SET is_primary = FALSE 
                 WHERE client_id = ? AND identifier_type = ?`,
                [client_id, identifier_type]
            );
        }

        const [result] = await pool.query(
            `INSERT INTO payment_identifiers (client_id, account_id, identifier_type, identifier_value, is_primary)
             VALUES (?, ?, ?, ?, ?)`,
            [client_id, account_id, identifier_type, identifier_value, is_primary]
        );

        return result.insertId;
    }

    // Verificar si un identificador ya existe
    static async exists(identifierValue) {
        const pool = getPool();
        const [rows] = await pool.query(
            `SELECT id FROM payment_identifiers WHERE identifier_value = ?`,
            [identifierValue]
        );
        return rows.length > 0;
    }

    // Desactivar identificador
    static async deactivate(id) {
        const pool = getPool();
        const [result] = await pool.query(
            `UPDATE payment_identifiers SET status = 'INACTIVO' WHERE id = ?`,
            [id]
        );
        return result.affectedRows > 0;
    }

    // Actualizar cuenta asociada
    static async updateAccount(id, accountId) {
        const pool = getPool();
        const [result] = await pool.query(
            `UPDATE payment_identifiers SET account_id = ? WHERE id = ?`,
            [accountId, id]
        );
        return result.affectedRows > 0;
    }

    // Establecer como primario
    static async setPrimary(id, clientId, identifierType) {
        const pool = getPool();
        
        // Desactivar otros primarios del mismo tipo
        await pool.query(
            `UPDATE payment_identifiers 
             SET is_primary = FALSE 
             WHERE client_id = ? AND identifier_type = ?`,
            [clientId, identifierType]
        );

        // Establecer el nuevo primario
        const [result] = await pool.query(
            `UPDATE payment_identifiers SET is_primary = TRUE WHERE id = ?`,
            [id]
        );
        return result.affectedRows > 0;
    }
}

module.exports = PaymentIdentifier;
