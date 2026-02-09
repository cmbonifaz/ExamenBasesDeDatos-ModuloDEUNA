require('dotenv').config();
const mysql = require('mysql2/promise');

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3096,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'deuna_pichincha',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// Pool de conexiones para la base de datos
let pool = null;

const createPool = async () => {
    if (!pool) {
        pool = mysql.createPool(dbConfig);
    }
    return pool;
};

// Conexión sin base de datos (para crear la BD si no existe)
const createConnectionWithoutDB = async () => {
    const config = { ...dbConfig };
    delete config.database;
    return mysql.createConnection(config);
};

const getPool = () => pool;

module.exports = {
    createPool,
    createConnectionWithoutDB,
    getPool,
    dbConfig
};
