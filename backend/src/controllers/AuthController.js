const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Client, Account, PaymentIdentifier, AuditLog } = require('../models');

class AuthController {
    // Login
    static async login(req, res) {
        try {
            const { email, password } = req.body;

            // Validar campos
            if (!email || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Email y contraseña son requeridos'
                });
            }

            // Buscar cliente
            const client = await Client.findByEmail(email);
            if (!client) {
                await AuditLog.create({
                    action_type: 'LOGIN_FAILED',
                    entity_type: 'CLIENT',
                    new_values: { email, reason: 'user_not_found' },
                    ip_address: req.ip,
                    user_agent: req.get('user-agent'),
                    status: 'FAILURE'
                });

                return res.status(401).json({
                    success: false,
                    message: 'Credenciales inválidas'
                });
            }

            // Verificar estado
            if (client.status !== 'ACTIVO') {
                await AuditLog.create({
                    client_id: client.id,
                    action_type: 'LOGIN_FAILED',
                    entity_type: 'CLIENT',
                    entity_id: client.id,
                    new_values: { reason: 'account_inactive', status: client.status },
                    ip_address: req.ip,
                    user_agent: req.get('user-agent'),
                    status: 'FAILURE'
                });

                return res.status(401).json({
                    success: false,
                    message: `Tu cuenta está ${client.status.toLowerCase()}`
                });
            }

            // Verificar contraseña
            const isValidPassword = await bcrypt.compare(password, client.password_hash);
            if (!isValidPassword) {
                await AuditLog.create({
                    client_id: client.id,
                    action_type: 'LOGIN_FAILED',
                    entity_type: 'CLIENT',
                    entity_id: client.id,
                    new_values: { reason: 'wrong_password' },
                    ip_address: req.ip,
                    user_agent: req.get('user-agent'),
                    status: 'FAILURE'
                });

                return res.status(401).json({
                    success: false,
                    message: 'Credenciales inválidas'
                });
            }

            // Generar token
            const token = jwt.sign(
                { 
                    id: client.id, 
                    email: client.email,
                    cedula: client.cedula 
                },
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
            );

            // Obtener cuentas del cliente
            const accounts = await Account.findByClientId(client.id);

            // Registrar login exitoso
            await AuditLog.create({
                client_id: client.id,
                action_type: 'LOGIN',
                entity_type: 'CLIENT',
                entity_id: client.id,
                new_values: { session: 'started' },
                ip_address: req.ip,
                user_agent: req.get('user-agent'),
                status: 'SUCCESS'
            });

            // Preparar respuesta (sin password)
            const clientData = {
                id: client.id,
                cedula: client.cedula,
                first_name: client.first_name,
                last_name: client.last_name,
                email: client.email,
                phone: client.phone,
                status: client.status
            };

            res.json({
                success: true,
                message: 'Login exitoso',
                data: {
                    client: clientData,
                    accounts,
                    token
                }
            });

        } catch (error) {
            console.error('Error en login:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }

    // Registro de nuevo cliente
    static async register(req, res) {
        try {
            const { 
                cedula, first_name, last_name, email, 
                phone, password, address, birth_date 
            } = req.body;

            // Validaciones básicas
            if (!cedula || !first_name || !last_name || !email || !phone || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Todos los campos requeridos deben ser completados'
                });
            }

            // Verificar si ya existe el cliente
            const existingByCedula = await Client.findByCedula(cedula);
            if (existingByCedula) {
                return res.status(400).json({
                    success: false,
                    message: 'Ya existe un cliente con esta cédula'
                });
            }

            const existingByEmail = await Client.findByEmail(email);
            if (existingByEmail) {
                return res.status(400).json({
                    success: false,
                    message: 'Ya existe un cliente con este email'
                });
            }

            // Encriptar contraseña
            const password_hash = await bcrypt.hash(password, 10);

            // Crear cliente
            const clientId = await Client.create({
                cedula,
                first_name,
                last_name,
                email,
                phone,
                password_hash,
                address,
                birth_date
            });

            // Crear cuenta de ahorros por defecto
            const accountNumber = await Account.generateAccountNumber();
            const accountId = await Account.create({
                client_id: clientId,
                account_number: accountNumber,
                account_type: 'AHORROS',
                balance: 0,
                available_balance: 0
            });

            // Crear identificador de pago con el teléfono
            await PaymentIdentifier.create({
                client_id: clientId,
                account_id: accountId,
                identifier_type: 'PHONE',
                identifier_value: phone,
                is_primary: true
            });

            // Registrar auditoría
            await AuditLog.create({
                client_id: clientId,
                action_type: 'REGISTER',
                entity_type: 'CLIENT',
                entity_id: clientId,
                new_values: { cedula, email, phone },
                ip_address: req.ip,
                user_agent: req.get('user-agent'),
                status: 'SUCCESS'
            });

            // Generar token
            const token = jwt.sign(
                { id: clientId, email, cedula },
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
            );

            res.status(201).json({
                success: true,
                message: 'Cliente registrado exitosamente',
                data: {
                    client: {
                        id: clientId,
                        cedula,
                        first_name,
                        last_name,
                        email,
                        phone
                    },
                    account: {
                        id: accountId,
                        account_number: accountNumber,
                        account_type: 'AHORROS',
                        balance: 0
                    },
                    token
                }
            });

        } catch (error) {
            console.error('Error en registro:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }

    // Obtener perfil del usuario autenticado
    static async getProfile(req, res) {
        try {
            const client = await Client.findWithAccounts(req.user.id);
            
            if (!client) {
                return res.status(404).json({
                    success: false,
                    message: 'Cliente no encontrado'
                });
            }

            // Obtener identificadores de pago
            const identifiers = await PaymentIdentifier.findByClientId(client.id);

            res.json({
                success: true,
                data: {
                    client: {
                        id: client.id,
                        cedula: client.cedula,
                        first_name: client.first_name,
                        last_name: client.last_name,
                        email: client.email,
                        phone: client.phone,
                        address: client.address,
                        status: client.status
                    },
                    accounts: client.accounts,
                    payment_identifiers: identifiers
                }
            });

        } catch (error) {
            console.error('Error al obtener perfil:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }

    // Actualizar perfil
    static async updateProfile(req, res) {
        try {
            const { first_name, last_name, phone, address } = req.body;
            
            const updated = await Client.update(req.user.id, {
                first_name,
                last_name,
                phone,
                address
            });

            if (updated) {
                await AuditLog.create({
                    client_id: req.user.id,
                    action_type: 'UPDATE_PROFILE',
                    entity_type: 'CLIENT',
                    entity_id: req.user.id,
                    new_values: { first_name, last_name, phone, address },
                    ip_address: req.ip,
                    user_agent: req.get('user-agent'),
                    status: 'SUCCESS'
                });

                res.json({
                    success: true,
                    message: 'Perfil actualizado exitosamente'
                });
            } else {
                res.status(400).json({
                    success: false,
                    message: 'No se pudo actualizar el perfil'
                });
            }

        } catch (error) {
            console.error('Error al actualizar perfil:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }

    // Cambiar contraseña
    static async changePassword(req, res) {
        try {
            const { current_password, new_password } = req.body;

            if (!current_password || !new_password) {
                return res.status(400).json({
                    success: false,
                    message: 'Contraseña actual y nueva son requeridas'
                });
            }

            const client = await Client.findById(req.user.id);
            
            // Verificar contraseña actual
            const isValid = await bcrypt.compare(current_password, client.password_hash);
            if (!isValid) {
                return res.status(401).json({
                    success: false,
                    message: 'Contraseña actual incorrecta'
                });
            }

            // Encriptar nueva contraseña
            const password_hash = await bcrypt.hash(new_password, 10);
            
            await Client.update(req.user.id, { password_hash });

            await AuditLog.create({
                client_id: req.user.id,
                action_type: 'CHANGE_PASSWORD',
                entity_type: 'CLIENT',
                entity_id: req.user.id,
                ip_address: req.ip,
                user_agent: req.get('user-agent'),
                status: 'SUCCESS'
            });

            res.json({
                success: true,
                message: 'Contraseña cambiada exitosamente'
            });

        } catch (error) {
            console.error('Error al cambiar contraseña:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }

    // Logout
    static async logout(req, res) {
        try {
            await AuditLog.create({
                client_id: req.user.id,
                action_type: 'LOGOUT',
                entity_type: 'CLIENT',
                entity_id: req.user.id,
                new_values: { session: 'ended' },
                ip_address: req.ip,
                user_agent: req.get('user-agent'),
                status: 'SUCCESS'
            });

            res.json({
                success: true,
                message: 'Sesión cerrada exitosamente'
            });

        } catch (error) {
            console.error('Error en logout:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }
}

module.exports = AuthController;
