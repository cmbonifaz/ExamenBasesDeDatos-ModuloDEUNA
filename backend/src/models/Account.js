const { getPool } = require('../config/database');

class Account {
    // Obtener todas las cuentas
    static async findAll(filters = {}) {
        const pool = getPool();
        let query = `
            SELECT a.*, 
                   c.first_name, c.last_name, c.cedula, c.email,
                   CONCAT(c.first_name, ' ', c.last_name) as client_name
            FROM accounts a
            JOIN clients c ON a.client_id = c.id
            WHERE 1=1
        `;
        const params = [];

        if (filters.client_id) {
            query += ' AND a.client_id = ?';
            params.push(filters.client_id);
        }

        if (filters.status) {
            query += ' AND a.status = ?';
            params.push(filters.status);
        }

        if (filters.account_type) {
            query += ' AND a.account_type = ?';
            params.push(filters.account_type);
        }

        query += ' ORDER BY a.created_at DESC';

        const [rows] = await pool.query(query, params);
        return rows;
    }

    // Obtener cuenta por ID
    static async findById(id) {
        const pool = getPool();
        const [rows] = await pool.query(
            `SELECT a.*, c.first_name, c.last_name, c.cedula, c.email
             FROM accounts a
             JOIN clients c ON a.client_id = c.id
             WHERE a.id = ?`,
            [id]
        );
        return rows[0];
    }

    // Obtener cuenta por número de cuenta
    static async findByAccountNumber(accountNumber) {
        const pool = getPool();
        const [rows] = await pool.query(
            `SELECT a.*, c.first_name, c.last_name, c.cedula, c.email, c.id as client_id
             FROM accounts a
             JOIN clients c ON a.client_id = c.id
             WHERE a.account_number = ?`,
            [accountNumber]
        );
        return rows[0];
    }

    // Obtener cuentas de un cliente
    static async findByClientId(clientId) {
        const pool = getPool();
        const [rows] = await pool.query(
            `SELECT * FROM accounts WHERE client_id = ? ORDER BY created_at DESC`,
            [clientId]
        );
        return rows;
    }

    // Crear nueva cuenta
    static async create(accountData) {
        const pool = getPool();
        const {
            client_id, account_number, account_type, balance,
            available_balance, daily_limit, monthly_limit
        } = accountData;

        const [result] = await pool.query(
            `INSERT INTO accounts (client_id, account_number, account_type, balance, available_balance, daily_limit, monthly_limit)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [client_id, account_number, account_type, balance || 0, available_balance || 0, daily_limit || 5000, monthly_limit || 50000]
        );

        return result.insertId;
    }

    // Actualizar saldo de cuenta (débito)
    static async debit(accountId, amount, connection = null) {
        const db = connection || getPool();
        const [result] = await db.query(
            `UPDATE accounts 
             SET balance = balance - ?, 
                 available_balance = available_balance - ?,
                 updated_at = NOW()
             WHERE id = ? AND available_balance >= ? AND status = 'ACTIVA'`,
            [amount, amount, accountId, amount]
        );
        return result.affectedRows > 0;
    }

    // Actualizar saldo de cuenta (crédito)
    static async credit(accountId, amount, connection = null) {
        const db = connection || getPool();
        const [result] = await db.query(
            `UPDATE accounts 
             SET balance = balance + ?, 
                 available_balance = available_balance + ?,
                 updated_at = NOW()
             WHERE id = ? AND status = 'ACTIVA'`,
            [amount, amount, accountId]
        );
        return result.affectedRows > 0;
    }

    // Verificar saldo disponible
    static async hasAvailableBalance(accountId, amount) {
        const pool = getPool();
        const [rows] = await pool.query(
            `SELECT available_balance FROM accounts WHERE id = ? AND status = 'ACTIVA'`,
            [accountId]
        );
        return rows[0] && parseFloat(rows[0].available_balance) >= parseFloat(amount);
    }

    // Verificar límite diario
    static async checkDailyLimit(accountId, amount) {
        const pool = getPool();
        
        // Obtener límite de la cuenta
        const [account] = await pool.query(
            `SELECT daily_limit FROM accounts WHERE id = ?`,
            [accountId]
        );

        if (!account[0]) return { allowed: false, reason: 'Cuenta no encontrada' };

        // Obtener uso diario actual
        const [dailyUsage] = await pool.query(
            `SELECT COALESCE(amount_used, 0) as used 
             FROM daily_limits 
             WHERE account_id = ? AND limit_date = CURDATE()`,
            [accountId]
        );

        const used = dailyUsage[0] ? parseFloat(dailyUsage[0].used) : 0;
        const remaining = parseFloat(account[0].daily_limit) - used;

        if (parseFloat(amount) > remaining) {
            return { 
                allowed: false, 
                reason: `Límite diario excedido. Disponible: $${remaining.toFixed(2)}`,
                remaining
            };
        }

        return { allowed: true, remaining: remaining - parseFloat(amount) };
    }

    // Actualizar límite diario usado
    static async updateDailyLimit(accountId, amount, connection = null) {
        const db = connection || getPool();
        await db.query(
            `INSERT INTO daily_limits (account_id, limit_date, amount_used, transactions_count)
             VALUES (?, CURDATE(), ?, 1)
             ON DUPLICATE KEY UPDATE 
                amount_used = amount_used + ?,
                transactions_count = transactions_count + 1`,
            [accountId, amount, amount]
        );
    }

    // Bloquear cuenta
    static async block(accountId) {
        const pool = getPool();
        const [result] = await pool.query(
            `UPDATE accounts SET status = 'BLOQUEADA' WHERE id = ?`,
            [accountId]
        );
        return result.affectedRows > 0;
    }

    // Activar cuenta
    static async activate(accountId) {
        const pool = getPool();
        const [result] = await pool.query(
            `UPDATE accounts SET status = 'ACTIVA' WHERE id = ?`,
            [accountId]
        );
        return result.affectedRows > 0;
    }

    // Generar número de cuenta único
    static async generateAccountNumber() {
        const pool = getPool();
        let accountNumber;
        let exists = true;

        while (exists) {
            // Formato: 2200 + 9 dígitos aleatorios
            accountNumber = '2200' + Math.floor(Math.random() * 900000000 + 100000000).toString();
            const [rows] = await pool.query(
                `SELECT id FROM accounts WHERE account_number = ?`,
                [accountNumber]
            );
            exists = rows.length > 0;
        }

        return accountNumber;
    }
}

module.exports = Account;
