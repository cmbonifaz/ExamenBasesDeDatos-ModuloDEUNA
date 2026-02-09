const { getPool } = require('../config/database');

class Client {
    // Obtener todos los clientes
    static async findAll(filters = {}) {
        const pool = getPool();
        let query = `
            SELECT c.*, 
                   COUNT(DISTINCT a.id) as total_accounts,
                   SUM(a.balance) as total_balance
            FROM clients c
            LEFT JOIN accounts a ON c.id = a.client_id
            WHERE 1=1
        `;
        const params = [];

        if (filters.status) {
            query += ' AND c.status = ?';
            params.push(filters.status);
        }

        if (filters.search) {
            query += ' AND (c.first_name LIKE ? OR c.last_name LIKE ? OR c.cedula LIKE ? OR c.email LIKE ?)';
            const searchTerm = `%${filters.search}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        query += ' GROUP BY c.id ORDER BY c.created_at DESC';

        if (filters.limit) {
            query += ' LIMIT ?';
            params.push(parseInt(filters.limit));
        }

        const [rows] = await pool.query(query, params);
        return rows;
    }

    // Obtener cliente por ID
    static async findById(id) {
        const pool = getPool();
        const [rows] = await pool.query(
            `SELECT * FROM clients WHERE id = ?`,
            [id]
        );
        return rows[0];
    }

    // Obtener cliente por cédula
    static async findByCedula(cedula) {
        const pool = getPool();
        const [rows] = await pool.query(
            `SELECT * FROM clients WHERE cedula = ?`,
            [cedula]
        );
        return rows[0];
    }

    // Obtener cliente por email
    static async findByEmail(email) {
        const pool = getPool();
        const [rows] = await pool.query(
            `SELECT * FROM clients WHERE email = ?`,
            [email]
        );
        return rows[0];
    }

    // Crear nuevo cliente
    static async create(clientData) {
        const pool = getPool();
        const {
            cedula, first_name, last_name, email, phone,
            password_hash, address, birth_date
        } = clientData;

        const [result] = await pool.query(
            `INSERT INTO clients (cedula, first_name, last_name, email, phone, password_hash, address, birth_date)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [cedula, first_name, last_name, email, phone, password_hash, address, birth_date]
        );

        return result.insertId;
    }

    // Actualizar cliente
    static async update(id, clientData) {
        const pool = getPool();
        const fields = [];
        const values = [];

        Object.keys(clientData).forEach(key => {
            if (clientData[key] !== undefined && key !== 'id') {
                fields.push(`${key} = ?`);
                values.push(clientData[key]);
            }
        });

        if (fields.length === 0) return false;

        values.push(id);
        const [result] = await pool.query(
            `UPDATE clients SET ${fields.join(', ')} WHERE id = ?`,
            values
        );

        return result.affectedRows > 0;
    }

    // Obtener cliente con sus cuentas
    static async findWithAccounts(clientId) {
        const pool = getPool();
        const [client] = await pool.query(
            `SELECT * FROM clients WHERE id = ?`,
            [clientId]
        );

        if (!client[0]) return null;

        const [accounts] = await pool.query(
            `SELECT * FROM accounts WHERE client_id = ? AND status = 'ACTIVA'`,
            [clientId]
        );

        return { ...client[0], accounts };
    }

    // Verificar si el cliente tiene saldo suficiente
    static async hasAvailableBalance(clientId, amount) {
        const pool = getPool();
        const [rows] = await pool.query(
            `SELECT SUM(available_balance) as total 
             FROM accounts 
             WHERE client_id = ? AND status = 'ACTIVA'`,
            [clientId]
        );
        return rows[0].total >= amount;
    }
}

module.exports = Client;
