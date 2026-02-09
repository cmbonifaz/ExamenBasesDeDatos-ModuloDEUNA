require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { createConnectionWithoutDB, dbConfig } = require('../config/database');

const createDatabase = async () => {
    console.log('Iniciando configuracion de base de datos DEUNA - Banco Pichincha...\n');
    
    let connection;
    
    try {
        // Conectar sin base de datos
        connection = await createConnectionWithoutDB();
        console.log(`[OK] Conectado a MySQL en puerto ${dbConfig.port}`);

        // Crear base de datos si no existe
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        console.log(`[OK] Base de datos '${dbConfig.database}' verificada/creada`);

        // Usar la base de datos
        await connection.query(`USE \`${dbConfig.database}\``);

        // =====================================================
        // CREAR TABLAS
        // =====================================================

        // Tabla de Clientes
        await connection.query(`
            CREATE TABLE IF NOT EXISTS clients (
                id INT PRIMARY KEY AUTO_INCREMENT,
                cedula VARCHAR(13) UNIQUE NOT NULL,
                first_name VARCHAR(100) NOT NULL,
                last_name VARCHAR(100) NOT NULL,
                email VARCHAR(150) UNIQUE NOT NULL,
                phone VARCHAR(15) NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                address TEXT,
                birth_date DATE,
                status ENUM('ACTIVO', 'INACTIVO', 'BLOQUEADO') DEFAULT 'ACTIVO',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_cedula (cedula),
                INDEX idx_email (email),
                INDEX idx_status (status)
            ) ENGINE=InnoDB
        `);
        console.log('[OK] Tabla clients creada');

        // Tabla de Cuentas
        await connection.query(`
            CREATE TABLE IF NOT EXISTS accounts (
                id INT PRIMARY KEY AUTO_INCREMENT,
                client_id INT NOT NULL,
                account_number VARCHAR(20) UNIQUE NOT NULL,
                account_type ENUM('AHORROS', 'CORRIENTE') NOT NULL,
                balance DECIMAL(15, 2) DEFAULT 0.00,
                available_balance DECIMAL(15, 2) DEFAULT 0.00,
                currency VARCHAR(3) DEFAULT 'USD',
                daily_limit DECIMAL(15, 2) DEFAULT 5000.00,
                monthly_limit DECIMAL(15, 2) DEFAULT 50000.00,
                status ENUM('ACTIVA', 'INACTIVA', 'BLOQUEADA', 'CERRADA') DEFAULT 'ACTIVA',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
                INDEX idx_account_number (account_number),
                INDEX idx_client_id (client_id),
                INDEX idx_status (status)
            ) ENGINE=InnoDB
        `);
        console.log('[OK] Tabla accounts creada');

        // Tabla de Tarjetas
        await connection.query(`
            CREATE TABLE IF NOT EXISTS cards (
                id INT PRIMARY KEY AUTO_INCREMENT,
                account_id INT NOT NULL,
                card_number VARCHAR(16) UNIQUE NOT NULL,
                card_type ENUM('DEBITO', 'CREDITO') NOT NULL,
                brand ENUM('VISA', 'MASTERCARD', 'AMERICAN_EXPRESS') DEFAULT 'VISA',
                expiry_date DATE NOT NULL,
                cvv_hash VARCHAR(255) NOT NULL,
                credit_limit DECIMAL(15, 2) DEFAULT 0.00,
                current_balance DECIMAL(15, 2) DEFAULT 0.00,
                status ENUM('ACTIVA', 'INACTIVA', 'BLOQUEADA', 'VENCIDA') DEFAULT 'ACTIVA',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
                INDEX idx_card_number (card_number),
                INDEX idx_account_id (account_id)
            ) ENGINE=InnoDB
        `);
        console.log('[OK] Tabla cards creada');

        // Tabla de Identificadores de Pago (alias, QR, tokens)
        await connection.query(`
            CREATE TABLE IF NOT EXISTS payment_identifiers (
                id INT PRIMARY KEY AUTO_INCREMENT,
                client_id INT NOT NULL,
                account_id INT NOT NULL,
                identifier_type ENUM('ALIAS', 'PHONE', 'EMAIL', 'QR', 'TOKEN') NOT NULL,
                identifier_value VARCHAR(255) UNIQUE NOT NULL,
                is_primary BOOLEAN DEFAULT FALSE,
                status ENUM('ACTIVO', 'INACTIVO') DEFAULT 'ACTIVO',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
                FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
                INDEX idx_identifier_value (identifier_value),
                INDEX idx_identifier_type (identifier_type)
            ) ENGINE=InnoDB
        `);
        console.log('[OK] Tabla payment_identifiers creada');

        // Tabla de Transacciones
        await connection.query(`
            CREATE TABLE IF NOT EXISTS transactions (
                id INT PRIMARY KEY AUTO_INCREMENT,
                transaction_uuid VARCHAR(36) UNIQUE NOT NULL,
                transaction_type ENUM('TRANSFERENCIA', 'RECARGA', 'PAGO_QR', 'RETIRO', 'DEPOSITO') NOT NULL,
                source_account_id INT,
                destination_account_id INT,
                amount DECIMAL(15, 2) NOT NULL,
                commission DECIMAL(15, 2) DEFAULT 0.00,
                total_amount DECIMAL(15, 2) NOT NULL,
                currency VARCHAR(3) DEFAULT 'USD',
                description TEXT,
                reference VARCHAR(100),
                status ENUM('PENDIENTE', 'PROCESANDO', 'CONFIRMADA', 'FALLIDA', 'REVERSADA', 'EXPIRADA') DEFAULT 'PENDIENTE',
                failure_reason TEXT,
                is_interbank BOOLEAN DEFAULT FALSE,
                destination_bank VARCHAR(100),
                destination_account_external VARCHAR(50),
                qr_payment_id INT,
                processed_at TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (source_account_id) REFERENCES accounts(id) ON DELETE SET NULL,
                FOREIGN KEY (destination_account_id) REFERENCES accounts(id) ON DELETE SET NULL,
                INDEX idx_transaction_uuid (transaction_uuid),
                INDEX idx_source_account (source_account_id),
                INDEX idx_destination_account (destination_account_id),
                INDEX idx_status (status),
                INDEX idx_created_at (created_at),
                INDEX idx_transaction_type (transaction_type)
            ) ENGINE=InnoDB
        `);
        console.log('[OK] Tabla transactions creada');

        // Tabla de Pagos QR
        await connection.query(`
            CREATE TABLE IF NOT EXISTS qr_payments (
                id INT PRIMARY KEY AUTO_INCREMENT,
                qr_uuid VARCHAR(36) UNIQUE NOT NULL,
                creator_client_id INT NOT NULL,
                creator_account_id INT NOT NULL,
                amount DECIMAL(15, 2),
                is_amount_fixed BOOLEAN DEFAULT TRUE,
                min_amount DECIMAL(15, 2),
                max_amount DECIMAL(15, 2),
                description VARCHAR(255),
                reference VARCHAR(100),
                qr_code_data TEXT NOT NULL,
                expiry_datetime DATETIME NOT NULL,
                usage_type ENUM('SINGLE_USE', 'MULTIPLE_USE') DEFAULT 'SINGLE_USE',
                times_used INT DEFAULT 0,
                max_uses INT DEFAULT 1,
                status ENUM('ACTIVO', 'USADO', 'EXPIRADO', 'CANCELADO') DEFAULT 'ACTIVO',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (creator_client_id) REFERENCES clients(id) ON DELETE CASCADE,
                FOREIGN KEY (creator_account_id) REFERENCES accounts(id) ON DELETE CASCADE,
                INDEX idx_qr_uuid (qr_uuid),
                INDEX idx_status (status),
                INDEX idx_expiry (expiry_datetime)
            ) ENGINE=InnoDB
        `);
        console.log('[OK] Tabla qr_payments creada');

        // Tabla de Comisiones
        await connection.query(`
            CREATE TABLE IF NOT EXISTS commissions (
                id INT PRIMARY KEY AUTO_INCREMENT,
                transaction_type ENUM('TRANSFERENCIA', 'RECARGA', 'PAGO_QR', 'TRANSFERENCIA_INTERBANCARIA') NOT NULL,
                commission_type ENUM('FIJO', 'PORCENTAJE') NOT NULL,
                value DECIMAL(10, 4) NOT NULL,
                min_amount DECIMAL(15, 2) DEFAULT 0.00,
                max_amount DECIMAL(15, 2) DEFAULT 999999.99,
                description VARCHAR(255),
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_transaction_type (transaction_type),
                INDEX idx_is_active (is_active)
            ) ENGINE=InnoDB
        `);
        console.log('[OK] Tabla commissions creada');

        // Tabla de Auditoría
        await connection.query(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INT PRIMARY KEY AUTO_INCREMENT,
                client_id INT,
                action_type VARCHAR(50) NOT NULL,
                entity_type VARCHAR(50) NOT NULL,
                entity_id INT,
                old_values JSON,
                new_values JSON,
                ip_address VARCHAR(45),
                user_agent TEXT,
                session_id VARCHAR(100),
                status ENUM('SUCCESS', 'FAILURE', 'WARNING') DEFAULT 'SUCCESS',
                error_message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
                INDEX idx_client_id (client_id),
                INDEX idx_action_type (action_type),
                INDEX idx_entity_type (entity_type),
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB
        `);
        console.log('[OK] Tabla audit_logs creada');

        // Tabla de Notificaciones
        await connection.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id INT PRIMARY KEY AUTO_INCREMENT,
                client_id INT NOT NULL,
                transaction_id INT,
                notification_type ENUM('TRANSFERENCIA_ENVIADA', 'TRANSFERENCIA_RECIBIDA', 'RECARGA', 'PAGO_QR', 'ALERTA', 'SISTEMA') NOT NULL,
                title VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                is_read BOOLEAN DEFAULT FALSE,
                sent_via ENUM('APP', 'EMAIL', 'SMS', 'PUSH') DEFAULT 'APP',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                read_at TIMESTAMP NULL,
                FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
                FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL,
                INDEX idx_client_id (client_id),
                INDEX idx_is_read (is_read),
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB
        `);
        console.log('[OK] Tabla notifications creada');

        // Tabla para límites diarios utilizados
        await connection.query(`
            CREATE TABLE IF NOT EXISTS daily_limits (
                id INT PRIMARY KEY AUTO_INCREMENT,
                account_id INT NOT NULL,
                limit_date DATE NOT NULL,
                amount_used DECIMAL(15, 2) DEFAULT 0.00,
                transactions_count INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
                UNIQUE KEY unique_account_date (account_id, limit_date),
                INDEX idx_limit_date (limit_date)
            ) ENGINE=InnoDB
        `);
        console.log('[OK] Tabla daily_limits creada');

        // Actualizar foreign key de transactions para qr_payments
        await connection.query(`
            ALTER TABLE transactions 
            ADD CONSTRAINT fk_qr_payment 
            FOREIGN KEY (qr_payment_id) REFERENCES qr_payments(id) ON DELETE SET NULL
        `).catch(() => {}); // Ignorar si ya existe

        console.log('\n[OK] Todas las tablas creadas exitosamente!\n');

        // =====================================================
        // INSERTAR DATOS DE PRUEBA
        // =====================================================
        
        console.log('Insertando datos de prueba...\n');

        // Verificar si ya hay datos
        const [existingClients] = await connection.query('SELECT COUNT(*) as count FROM clients');
        
        if (existingClients[0].count > 0) {
            console.log('[WARN] Ya existen datos en la base de datos. Omitiendo insercion de datos de prueba.\n');
        } else {
            // Insertar Clientes (10 registros)
            const bcrypt = require('bcryptjs');
            const passwordHash = await bcrypt.hash('123456', 10);
            
            await connection.query(`
                INSERT INTO clients (cedula, first_name, last_name, email, phone, password_hash, address, birth_date, status) VALUES
                ('1720136918', 'Christian Mateo', 'Bonifaz Vasquez', 'christian.bonifaz@email.com', '0984146076', '${passwordHash}', 'Quito, Ecuador', '2000-01-15', 'ACTIVO'),
                ('1723456789', 'María Elena', 'González López', 'maria.gonzalez@email.com', '0982345678', '${passwordHash}', 'Calle 10 de Agosto, Guayaquil', '1990-07-22', 'ACTIVO'),
                ('1734567890', 'Pedro Antonio', 'Rodríguez Sánchez', 'pedro.rodriguez@email.com', '0973456789', '${passwordHash}', 'Av. 6 de Diciembre, Quito', '1988-11-08', 'ACTIVO'),
                ('1745678901', 'Ana Lucía', 'Martínez Vera', 'ana.martinez@email.com', '0964567890', '${passwordHash}', 'Av. América N34-12, Quito', '1992-05-30', 'ACTIVO'),
                ('1756789012', 'Carlos Eduardo', 'López Mendoza', 'carlos.lopez@email.com', '0955678901', '${passwordHash}', 'Malecón 2000, Guayaquil', '1987-09-14', 'ACTIVO'),
                ('1767890123', 'Sofía Alejandra', 'Herrera Castro', 'sofia.herrera@email.com', '0946789012', '${passwordHash}', 'Av. Eloy Alfaro, Quito', '1995-02-28', 'ACTIVO'),
                ('1778901234', 'Diego Fernando', 'Vargas Ruiz', 'diego.vargas@email.com', '0937890123', '${passwordHash}', 'Av. 9 de Octubre, Guayaquil', '1983-06-17', 'ACTIVO'),
                ('1789012345', 'Valentina Isabel', 'Torres Paredes', 'valentina.torres@email.com', '0928901234', '${passwordHash}', 'Av. República, Quito', '1998-12-03', 'ACTIVO'),
                ('1790123456', 'Andrés Sebastián', 'Flores Moreno', 'andres.flores@email.com', '0919012345', '${passwordHash}', 'Urdesa Central, Guayaquil', '1991-04-25', 'ACTIVO'),
                ('1701234567', 'Camila Fernanda', 'Núñez Salazar', 'camila.nunez@email.com', '0900123456', '${passwordHash}', 'La Carolina, Quito', '1994-08-11', 'ACTIVO')
            `);
            console.log('[OK] 10 Clientes insertados');

            // Insertar Cuentas (10 registros - una por cliente)
            await connection.query(`
                INSERT INTO accounts (client_id, account_number, account_type, balance, available_balance, daily_limit, monthly_limit, status) VALUES
                (1, '2200123456001', 'AHORROS', 15000.00, 15000.00, 5000.00, 50000.00, 'ACTIVA'),
                (2, '2200234567002', 'CORRIENTE', 25000.00, 25000.00, 10000.00, 100000.00, 'ACTIVA'),
                (3, '2200345678003', 'AHORROS', 8500.50, 8500.50, 5000.00, 50000.00, 'ACTIVA'),
                (4, '2200456789004', 'AHORROS', 12300.75, 12300.75, 5000.00, 50000.00, 'ACTIVA'),
                (5, '2200567890005', 'CORRIENTE', 45000.00, 45000.00, 15000.00, 150000.00, 'ACTIVA'),
                (6, '2200678901006', 'AHORROS', 3200.25, 3200.25, 5000.00, 50000.00, 'ACTIVA'),
                (7, '2200789012007', 'CORRIENTE', 67500.00, 67500.00, 20000.00, 200000.00, 'ACTIVA'),
                (8, '2200890123008', 'AHORROS', 1850.00, 1850.00, 5000.00, 50000.00, 'ACTIVA'),
                (9, '2200901234009', 'AHORROS', 22000.00, 22000.00, 5000.00, 50000.00, 'ACTIVA'),
                (10, '2201012345010', 'CORRIENTE', 38750.50, 38750.50, 10000.00, 100000.00, 'ACTIVA')
            `);
            console.log('[OK] 10 Cuentas insertadas');

            // Insertar Tarjetas (10 registros)
            const cvvHash = await bcrypt.hash('123', 10);
            await connection.query(`
                INSERT INTO cards (account_id, card_number, card_type, brand, expiry_date, cvv_hash, credit_limit, current_balance, status) VALUES
                (1, '4532015112830366', 'DEBITO', 'VISA', '2027-12-31', '${cvvHash}', 0.00, 0.00, 'ACTIVA'),
                (2, '5425233430109903', 'CREDITO', 'MASTERCARD', '2028-06-30', '${cvvHash}', 15000.00, 2500.00, 'ACTIVA'),
                (3, '4916338506082832', 'DEBITO', 'VISA', '2027-09-30', '${cvvHash}', 0.00, 0.00, 'ACTIVA'),
                (4, '5114496353984312', 'DEBITO', 'MASTERCARD', '2028-03-31', '${cvvHash}', 0.00, 0.00, 'ACTIVA'),
                (5, '4539578763621486', 'CREDITO', 'VISA', '2027-08-31', '${cvvHash}', 25000.00, 5000.00, 'ACTIVA'),
                (6, '5285298879883437', 'DEBITO', 'MASTERCARD', '2028-01-31', '${cvvHash}', 0.00, 0.00, 'ACTIVA'),
                (7, '4024007198964305', 'CREDITO', 'VISA', '2027-11-30', '${cvvHash}', 50000.00, 12000.00, 'ACTIVA'),
                (8, '5178053929770627', 'DEBITO', 'MASTERCARD', '2028-05-31', '${cvvHash}', 0.00, 0.00, 'ACTIVA'),
                (9, '4716108999716531', 'DEBITO', 'VISA', '2027-07-31', '${cvvHash}', 0.00, 0.00, 'ACTIVA'),
                (10, '5364847522370638', 'CREDITO', 'MASTERCARD', '2028-02-28', '${cvvHash}', 20000.00, 3500.00, 'ACTIVA')
            `);
            console.log('[OK] 10 Tarjetas insertadas');

            // Insertar Identificadores de Pago (10 registros)
            await connection.query(`
                INSERT INTO payment_identifiers (client_id, account_id, identifier_type, identifier_value, is_primary, status) VALUES
                (1, 1, 'ALIAS', 'juan.perez.deuna', TRUE, 'ACTIVO'),
                (2, 2, 'PHONE', '0982345678', TRUE, 'ACTIVO'),
                (3, 3, 'EMAIL', 'pedro.rodriguez@email.com', TRUE, 'ACTIVO'),
                (4, 4, 'ALIAS', 'ana.martinez.pay', TRUE, 'ACTIVO'),
                (5, 5, 'PHONE', '0955678901', TRUE, 'ACTIVO'),
                (6, 6, 'ALIAS', 'sofia.herrera.qr', TRUE, 'ACTIVO'),
                (7, 7, 'EMAIL', 'diego.vargas@email.com', TRUE, 'ACTIVO'),
                (8, 8, 'PHONE', '0928901234', TRUE, 'ACTIVO'),
                (9, 9, 'ALIAS', 'andres.flores.deuna', TRUE, 'ACTIVO'),
                (10, 10, 'PHONE', '0900123456', TRUE, 'ACTIVO')
            `);
            console.log('[OK] 10 Identificadores de pago insertados');

            // Insertar Transacciones de ejemplo (10 registros)
            const { v4: uuidv4 } = require('uuid');
            await connection.query(`
                INSERT INTO transactions (transaction_uuid, transaction_type, source_account_id, destination_account_id, amount, commission, total_amount, description, reference, status, is_interbank, processed_at) VALUES
                ('${uuidv4()}', 'TRANSFERENCIA', 1, 2, 500.00, 0.00, 500.00, 'Pago de servicios', 'REF-001', 'CONFIRMADA', FALSE, NOW()),
                ('${uuidv4()}', 'TRANSFERENCIA', 2, 3, 1200.00, 0.00, 1200.00, 'Transferencia personal', 'REF-002', 'CONFIRMADA', FALSE, NOW()),
                ('${uuidv4()}', 'RECARGA', NULL, 4, 50.00, 0.00, 50.00, 'Recarga celular Claro', 'REC-001', 'CONFIRMADA', FALSE, NOW()),
                ('${uuidv4()}', 'TRANSFERENCIA', 5, 6, 2500.00, 0.00, 2500.00, 'Pago alquiler', 'REF-003', 'CONFIRMADA', FALSE, NOW()),
                ('${uuidv4()}', 'RECARGA', NULL, 7, 25.00, 0.00, 25.00, 'Recarga celular Movistar', 'REC-002', 'CONFIRMADA', FALSE, NOW()),
                ('${uuidv4()}', 'TRANSFERENCIA', 8, 9, 150.00, 0.00, 150.00, 'Pago comida', 'REF-004', 'CONFIRMADA', FALSE, NOW()),
                ('${uuidv4()}', 'TRANSFERENCIA', 10, 1, 3000.00, 0.00, 3000.00, 'Préstamo', 'REF-005', 'CONFIRMADA', FALSE, NOW()),
                ('${uuidv4()}', 'RECARGA', NULL, 2, 100.00, 0.00, 100.00, 'Recarga celular CNT', 'REC-003', 'CONFIRMADA', FALSE, NOW()),
                ('${uuidv4()}', 'TRANSFERENCIA', 3, 4, 800.00, 0.50, 800.50, 'Transferencia interbancaria', 'REF-006', 'CONFIRMADA', TRUE, NOW()),
                ('${uuidv4()}', 'TRANSFERENCIA', 6, 7, 450.00, 0.00, 450.00, 'Regalo cumpleaños', 'REF-007', 'PENDIENTE', FALSE, NULL)
            `);
            console.log('[OK] 10 Transacciones insertadas');

            // Insertar Comisiones (configuración)
            await connection.query(`
                INSERT INTO commissions (transaction_type, commission_type, value, min_amount, max_amount, description, is_active) VALUES
                ('TRANSFERENCIA', 'FIJO', 0.00, 0.00, 999999.99, 'Transferencias mismo banco sin costo', TRUE),
                ('TRANSFERENCIA_INTERBANCARIA', 'FIJO', 0.50, 0.00, 999999.99, 'Comisión transferencia interbancaria', TRUE),
                ('RECARGA', 'FIJO', 0.00, 0.00, 999999.99, 'Recargas sin costo', TRUE),
                ('PAGO_QR', 'FIJO', 0.00, 0.00, 999999.99, 'Pagos QR sin costo', TRUE),
                ('TRANSFERENCIA', 'PORCENTAJE', 0.50, 10000.00, 999999.99, 'Comisión 0.5% para montos mayores a $10,000', FALSE),
                ('RECARGA', 'PORCENTAJE', 1.00, 500.00, 999999.99, 'Comisión 1% recargas mayores a $500', FALSE),
                ('TRANSFERENCIA_INTERBANCARIA', 'PORCENTAJE', 0.25, 5000.00, 999999.99, 'Comisión adicional interbancaria', FALSE),
                ('PAGO_QR', 'PORCENTAJE', 0.15, 1000.00, 999999.99, 'Comisión QR montos altos', FALSE),
                ('TRANSFERENCIA', 'FIJO', 1.00, 0.00, 50.00, 'Comisión mínima transferencias pequeñas', FALSE),
                ('RECARGA', 'FIJO', 0.25, 0.00, 10.00, 'Comisión mínima recargas pequeñas', FALSE)
            `);
            console.log('[OK] 10 Configuraciones de comisiones insertadas');

            // Insertar Logs de Auditoría (10 registros)
            await connection.query(`
                INSERT INTO audit_logs (client_id, action_type, entity_type, entity_id, new_values, ip_address, status) VALUES
                (1, 'LOGIN', 'CLIENT', 1, '{"session": "started"}', '192.168.1.100', 'SUCCESS'),
                (2, 'TRANSFER', 'TRANSACTION', 1, '{"amount": 500.00}', '192.168.1.101', 'SUCCESS'),
                (3, 'UPDATE_PROFILE', 'CLIENT', 3, '{"phone": "updated"}', '192.168.1.102', 'SUCCESS'),
                (4, 'RECARGA', 'TRANSACTION', 3, '{"amount": 50.00}', '192.168.1.103', 'SUCCESS'),
                (5, 'LOGIN', 'CLIENT', 5, '{"session": "started"}', '192.168.1.104', 'SUCCESS'),
                (6, 'TRANSFER', 'TRANSACTION', 4, '{"amount": 2500.00}', '192.168.1.105', 'SUCCESS'),
                (7, 'CREATE_QR', 'QR_PAYMENT', 1, '{"amount": 100.00}', '192.168.1.106', 'SUCCESS'),
                (8, 'LOGIN_FAILED', 'CLIENT', 8, '{"reason": "wrong_password"}', '192.168.1.107', 'FAILURE'),
                (9, 'TRANSFER', 'TRANSACTION', 6, '{"amount": 150.00}', '192.168.1.108', 'SUCCESS'),
                (10, 'LOGOUT', 'CLIENT', 10, '{"session": "ended"}', '192.168.1.109', 'SUCCESS')
            `);
            console.log('[OK] 10 Registros de auditoría insertados');

            // Insertar Notificaciones (10 registros)
            await connection.query(`
                INSERT INTO notifications (client_id, transaction_id, notification_type, title, message, is_read, sent_via) VALUES
                (1, 1, 'TRANSFERENCIA_ENVIADA', 'Transferencia Exitosa', 'Has enviado $500.00 a María González', TRUE, 'APP'),
                (2, 1, 'TRANSFERENCIA_RECIBIDA', 'Dinero Recibido', 'Has recibido $500.00 de Juan Pérez', FALSE, 'APP'),
                (3, 2, 'TRANSFERENCIA_RECIBIDA', 'Dinero Recibido', 'Has recibido $1,200.00 de María González', FALSE, 'APP'),
                (4, 3, 'RECARGA', 'Recarga Exitosa', 'Tu recarga de $50.00 fue procesada', TRUE, 'APP'),
                (5, 4, 'TRANSFERENCIA_ENVIADA', 'Transferencia Exitosa', 'Has enviado $2,500.00 a Sofía Herrera', TRUE, 'APP'),
                (6, 4, 'TRANSFERENCIA_RECIBIDA', 'Dinero Recibido', 'Has recibido $2,500.00 de Carlos López', FALSE, 'APP'),
                (7, 5, 'RECARGA', 'Recarga Exitosa', 'Tu recarga de $25.00 fue procesada', FALSE, 'APP'),
                (8, 6, 'TRANSFERENCIA_ENVIADA', 'Transferencia Exitosa', 'Has enviado $150.00 a Andrés Flores', TRUE, 'APP'),
                (9, 6, 'TRANSFERENCIA_RECIBIDA', 'Dinero Recibido', 'Has recibido $150.00 de Valentina Torres', TRUE, 'APP'),
                (10, 7, 'TRANSFERENCIA_ENVIADA', 'Transferencia Exitosa', 'Has enviado $3,000.00 a Juan Pérez', FALSE, 'APP')
            `);
            console.log('[OK] 10 Notificaciones insertadas');

            console.log('\nBase de datos inicializada con exito con datos de prueba!\n');
        }

        console.log('='.repeat(60));
        console.log('RESUMEN DE LA BASE DE DATOS DEUNA - BANCO PICHINCHA');
        console.log('='.repeat(60));
        console.log(`Base de datos: ${dbConfig.database}`);
        console.log(`Puerto MySQL: ${dbConfig.port}`);
        console.log('Tablas creadas:');
        console.log('  • clients - Clientes del banco');
        console.log('  • accounts - Cuentas bancarias');
        console.log('  • cards - Tarjetas de débito/crédito');
        console.log('  • payment_identifiers - Alias y tokens de pago');
        console.log('  • transactions - Historial de transacciones');
        console.log('  • qr_payments - Códigos QR para cobros');
        console.log('  • commissions - Configuración de comisiones');
        console.log('  • audit_logs - Auditoría del sistema');
        console.log('  • notifications - Notificaciones');
        console.log('  • daily_limits - Control de límites diarios');
        console.log('='.repeat(60));

    } catch (error) {
        console.error('[ERROR] Error al inicializar la base de datos:', error.message);
        throw error;
    } finally {
        if (connection) {
            await connection.end();
        }
    }
};

// Ejecutar si se llama directamente
if (require.main === module) {
    createDatabase()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

module.exports = { createDatabase };
