require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createPool } = require('./config/database');
const { createDatabase } = require('./database/init');
const routes = require('./routes');
const cron = require('node-cron');
const { QRPayment, Transaction } = require('./models');

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging de requests
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// Rutas de la API
app.use('/api', routes);

// Ruta raíz
app.get('/', (req, res) => {
    res.json({
        name: 'DEUNA API - Banco Pichincha',
        description: 'Sistema de pagos y transferencias inmediatas',
        version: '1.0.0',
        endpoints: {
            auth: '/api/auth',
            transfers: '/api/transfers',
            recharges: '/api/recharges',
            qr: '/api/qr',
            user: '/api/user',
            notifications: '/api/notifications',
            health: '/api/health'
        }
    });
});

// Manejo de rutas no encontradas
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint no encontrado'
    });
});

// Manejo de errores global
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Tareas programadas (cron jobs)
const setupCronJobs = () => {
    // Expirar QRs vencidos cada minuto
    cron.schedule('* * * * *', async () => {
        try {
            const expired = await QRPayment.expireOldQRs();
            if (expired > 0) {
                console.log(`[CRON] ${expired} códigos QR expirados`);
            }
        } catch (error) {
            console.error('[CRON] Error al expirar QRs:', error);
        }
    });

    // Expirar transacciones pendientes cada 5 minutos
    cron.schedule('*/5 * * * *', async () => {
        try {
            const expired = await Transaction.getExpiredTransactions();
            for (const tx of expired) {
                await Transaction.updateStatus(tx.id, 'EXPIRADA', 'Tiempo de espera excedido');
            }
            if (expired.length > 0) {
                console.log(`[CRON] ${expired.length} transacciones expiradas`);
            }
        } catch (error) {
            console.error('[CRON] Error al expirar transacciones:', error);
        }
    });

    console.log('[OK] Tareas programadas configuradas');
};

// Iniciar servidor
const startServer = async () => {
    try {
        console.log('Iniciando servidor DEUNA - Banco Pichincha...\n');

        // Inicializar base de datos (crear si no existe)
        await createDatabase();

        // Crear pool de conexiones
        await createPool();
        console.log('[OK] Pool de conexiones MySQL creado\n');

        // Configurar cron jobs
        setupCronJobs();

        // Iniciar servidor HTTP
        app.listen(PORT, () => {
            console.log('='.repeat(60));
            console.log(`DEUNA API - Banco Pichincha`);
            console.log(`Servidor corriendo en: http://localhost:${PORT}`);
            console.log(`API Endpoints: http://localhost:${PORT}/api`);
            console.log(`Health Check: http://localhost:${PORT}/api/health`);
            console.log('='.repeat(60));
        });

    } catch (error) {
        console.error('[ERROR] Error al iniciar el servidor:', error);
        process.exit(1);
    }
};

startServer();
