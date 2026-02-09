const { getPool } = require('../config/database');

class Commission {
    // Obtener todas las comisiones activas
    static async findAll(includeInactive = false) {
        const pool = getPool();
        let query = `SELECT * FROM commissions`;
        
        if (!includeInactive) {
            query += ` WHERE is_active = TRUE`;
        }
        
        query += ` ORDER BY transaction_type, min_amount`;
        
        const [rows] = await pool.query(query);
        return rows;
    }

    // Calcular comisión para una transacción
    static async calculate(transactionType, amount, isInterbank = false) {
        const pool = getPool();
        
        // Determinar el tipo correcto
        let type = transactionType;
        if (transactionType === 'TRANSFERENCIA' && isInterbank) {
            type = 'TRANSFERENCIA_INTERBANCARIA';
        }

        // Buscar comisiones activas aplicables
        const [commissions] = await pool.query(
            `SELECT * FROM commissions 
             WHERE transaction_type = ? 
             AND is_active = TRUE 
             AND min_amount <= ? 
             AND max_amount >= ?
             ORDER BY commission_type DESC`,
            [type, amount, amount]
        );

        if (commissions.length === 0) {
            return { commission: 0, description: 'Sin comisión' };
        }

        let totalCommission = 0;
        let descriptions = [];

        for (const comm of commissions) {
            let commissionAmount = 0;
            
            if (comm.commission_type === 'FIJO') {
                commissionAmount = parseFloat(comm.value);
            } else if (comm.commission_type === 'PORCENTAJE') {
                commissionAmount = (parseFloat(amount) * parseFloat(comm.value)) / 100;
            }

            totalCommission += commissionAmount;
            if (commissionAmount > 0) {
                descriptions.push(comm.description || `Comisión ${comm.commission_type.toLowerCase()}`);
            }
        }

        return {
            commission: Math.round(totalCommission * 100) / 100,
            description: descriptions.join('; ') || 'Sin comisión'
        };
    }

    // Obtener comisión por ID
    static async findById(id) {
        const pool = getPool();
        const [rows] = await pool.query(
            `SELECT * FROM commissions WHERE id = ?`,
            [id]
        );
        return rows[0];
    }

    // Crear nueva comisión
    static async create(commissionData) {
        const pool = getPool();
        const {
            transaction_type,
            commission_type,
            value,
            min_amount = 0,
            max_amount = 999999.99,
            description,
            is_active = true
        } = commissionData;

        const [result] = await pool.query(
            `INSERT INTO commissions (transaction_type, commission_type, value, min_amount, max_amount, description, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [transaction_type, commission_type, value, min_amount, max_amount, description, is_active]
        );

        return result.insertId;
    }

    // Actualizar comisión
    static async update(id, commissionData) {
        const pool = getPool();
        const fields = [];
        const values = [];

        Object.keys(commissionData).forEach(key => {
            if (commissionData[key] !== undefined && key !== 'id') {
                fields.push(`${key} = ?`);
                values.push(commissionData[key]);
            }
        });

        if (fields.length === 0) return false;

        values.push(id);
        const [result] = await pool.query(
            `UPDATE commissions SET ${fields.join(', ')} WHERE id = ?`,
            values
        );

        return result.affectedRows > 0;
    }

    // Activar/Desactivar comisión
    static async toggleActive(id) {
        const pool = getPool();
        const [result] = await pool.query(
            `UPDATE commissions SET is_active = NOT is_active WHERE id = ?`,
            [id]
        );
        return result.affectedRows > 0;
    }

    // Obtener resumen de comisiones cobradas
    static async getCommissionsSummary(fromDate, toDate) {
        const pool = getPool();
        const [rows] = await pool.query(
            `SELECT 
                transaction_type,
                COUNT(*) as total_transactions,
                SUM(commission) as total_commissions,
                AVG(commission) as avg_commission,
                MIN(commission) as min_commission,
                MAX(commission) as max_commission
             FROM transactions
             WHERE status = 'CONFIRMADA'
             AND commission > 0
             AND created_at BETWEEN ? AND ?
             GROUP BY transaction_type`,
            [fromDate, toDate]
        );
        return rows;
    }
}

module.exports = Commission;
