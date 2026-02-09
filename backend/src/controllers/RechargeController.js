const { getPool } = require('../config/database');
const { 
    Account, 
    Transaction, 
    Commission, 
    AuditLog, 
    Notification,
    Client
} = require('../models');

// Metodos de recarga de cuenta
const RECHARGE_METHODS = {
    TARJETA_DEBITO: { 
        name: 'Tarjeta de Debito', 
        min: 1, 
        max: 5000, 
        commission_percent: 0,
        description: 'Recarga desde tarjeta de debito'
    },
    TARJETA_CREDITO: { 
        name: 'Tarjeta de Credito', 
        min: 1, 
        max: 3000, 
        commission_percent: 2.5,
        description: 'Recarga desde tarjeta de credito (2.5% comision)'
    },
    TRANSFERENCIA_EXTERNA: { 
        name: 'Transferencia desde otro banco', 
        min: 1, 
        max: 10000, 
        commission_percent: 0,
        description: 'Transferencia desde cuenta de otro banco'
    },
    DEPOSITO_EFECTIVO: { 
        name: 'Deposito en efectivo', 
        min: 5, 
        max: 2000, 
        commission_percent: 0,
        description: 'Deposito en punto de recarga autorizado'
    },
    PAYPAL: { 
        name: 'PayPal', 
        min: 5, 
        max: 1000, 
        commission_percent: 3.5,
        description: 'Recarga desde PayPal (3.5% comision)'
    }
};

class RechargeController {
    // Obtener metodos de recarga disponibles
    static async getProviders(req, res) {
        try {
            const methods = Object.keys(RECHARGE_METHODS).map(key => ({
                id: key,
                name: RECHARGE_METHODS[key].name,
                min_amount: RECHARGE_METHODS[key].min,
                max_amount: RECHARGE_METHODS[key].max,
                commission_percent: RECHARGE_METHODS[key].commission_percent,
                description: RECHARGE_METHODS[key].description,
                type: 'RECARGA_CUENTA'
            }));

            res.json({
                success: true,
                data: methods
            });
        } catch (error) {
            console.error('Error al obtener metodos de recarga:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener metodos de recarga'
            });
        }
    }

    // Realizar recarga de cuenta
    static async recharge(req, res) {
        const pool = getPool();
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            const {
                destination_account_id,
                method_id,
                amount,
                card_number,
                external_reference
            } = req.body;

            const clientId = req.user.id;

            // Validaciones basicas
            if (!destination_account_id || !method_id || !amount) {
                return res.status(400).json({
                    success: false,
                    message: 'Cuenta destino, metodo y monto son requeridos'
                });
            }

            // Validar metodo
            const method = RECHARGE_METHODS[method_id];
            if (!method) {
                return res.status(400).json({
                    success: false,
                    message: 'Metodo de recarga no valido'
                });
            }

            // Validar monto segun metodo
            const rechargeAmount = parseFloat(amount);
            if (rechargeAmount < method.min || rechargeAmount > method.max) {
                return res.status(400).json({
                    success: false,
                    message: `El monto debe estar entre $${method.min} y $${method.max} para ${method.name}`
                });
            }

            // Verificar cuenta destino
            const destinationAccount = await Account.findById(destination_account_id);
            if (!destinationAccount) {
                return res.status(404).json({
                    success: false,
                    message: 'Cuenta destino no encontrada'
                });
            }

            // Verificar que la cuenta pertenece al cliente autenticado
            if (destinationAccount.client_id !== clientId) {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permiso para operar con esta cuenta'
                });
            }

            // Verificar estado de la cuenta
            if (destinationAccount.status !== 'ACTIVA') {
                return res.status(400).json({
                    success: false,
                    message: 'La cuenta no esta activa'
                });
            }

            // Calcular comision segun el metodo
            const commission = (rechargeAmount * method.commission_percent) / 100;
            const netAmount = rechargeAmount - commission; // Lo que realmente se acredita

            // Generar referencia
            const reference = Transaction.generateReference('REC');

            // Descripcion de la recarga
            const description = `Recarga de cuenta via ${method.name}`;

            // Crear transaccion
            const transactionData = {
                transaction_type: 'DEPOSITO',
                source_account_id: null, // No hay cuenta origen (es entrada de dinero)
                destination_account_id,
                amount: rechargeAmount,
                commission,
                description,
                reference,
                is_interbank: method_id === 'TRANSFERENCIA_EXTERNA'
            };

            const transaction = await Transaction.create(transactionData, connection);

            // Simular procesamiento del metodo de pago
            const processSuccess = await simulatePaymentProcess(method_id, card_number, external_reference, rechargeAmount);

            if (!processSuccess) {
                await connection.rollback();
                await Transaction.updateStatus(transaction.id, 'FALLIDA', 'Error al procesar el pago', connection);
                return res.status(400).json({
                    success: false,
                    message: 'No se pudo procesar el pago. Verifica los datos e intenta nuevamente.'
                });
            }

            // Ejecutar credito (agregar dinero a la cuenta)
            const creditSuccess = await Account.credit(destination_account_id, netAmount, connection);
            if (!creditSuccess) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'No se pudo acreditar el monto'
                });
            }

            // Marcar transaccion como confirmada
            await Transaction.updateStatus(transaction.id, 'CONFIRMADA', null, connection);

            // Commit de la transaccion
            await connection.commit();

            // Crear notificacion
            await Notification.create({
                client_id: clientId,
                transaction_id: transaction.id,
                notification_type: 'RECARGA',
                title: 'Recarga Exitosa',
                message: `Se han acreditado $${netAmount.toFixed(2)} a tu cuenta ${destinationAccount.account_number}${commission > 0 ? ` (comision: $${commission.toFixed(2)})` : ''}`
            });

            // Registrar auditoria
            await AuditLog.create({
                client_id: clientId,
                action_type: 'RECARGA_CUENTA',
                entity_type: 'TRANSACTION',
                entity_id: transaction.id,
                new_values: {
                    method: method.name,
                    amount: rechargeAmount,
                    commission,
                    net_amount: netAmount,
                    reference
                },
                ip_address: req.ip,
                user_agent: req.get('user-agent'),
                status: 'SUCCESS'
            });

            // Obtener saldo actualizado
            const updatedAccount = await Account.findById(destination_account_id);

            res.status(201).json({
                success: true,
                message: 'Recarga realizada exitosamente',
                data: {
                    transaction: {
                        id: transaction.id,
                        uuid: transaction.uuid,
                        reference,
                        amount: rechargeAmount,
                        commission,
                        net_amount: netAmount,
                        status: 'CONFIRMADA',
                        method: method.name,
                        description
                    },
                    destination_account: {
                        id: destination_account_id,
                        account_number: destinationAccount.account_number,
                        new_balance: updatedAccount.balance,
                        new_available_balance: updatedAccount.available_balance
                    }
                }
            });

        } catch (error) {
            await connection.rollback();
            console.error('Error en recarga:', error);

            await AuditLog.create({
                client_id: req.user.id,
                action_type: 'RECARGA_CUENTA',
                entity_type: 'TRANSACTION',
                new_values: req.body,
                ip_address: req.ip,
                user_agent: req.get('user-agent'),
                status: 'FAILURE',
                error_message: error.message
            });

            res.status(500).json({
                success: false,
                message: 'Error al procesar la recarga'
            });
        } finally {
            connection.release();
        }
    }

    // Obtener historial de recargas
    static async getRechargeHistory(req, res) {
        try {
            const { account_id, limit = 20, offset = 0 } = req.query;
            const clientId = req.user.id;

            const filters = {
                client_id: clientId,
                transaction_type: 'DEPOSITO',
                limit: parseInt(limit),
                offset: parseInt(offset)
            };

            if (account_id) {
                const account = await Account.findById(account_id);
                if (!account || account.client_id !== clientId) {
                    return res.status(403).json({
                        success: false,
                        message: 'No tienes acceso a esta cuenta'
                    });
                }
                filters.destination_account_id = account_id;
            }

            const transactions = await Transaction.findAll(filters);

            res.json({
                success: true,
                data: transactions.map(t => ({
                    id: t.id,
                    uuid: t.transaction_uuid,
                    reference: t.reference,
                    amount: parseFloat(t.amount),
                    commission: parseFloat(t.commission),
                    net_amount: parseFloat(t.amount) - parseFloat(t.commission),
                    status: t.status,
                    description: t.description,
                    created_at: t.created_at,
                    processed_at: t.processed_at
                }))
            });

        } catch (error) {
            console.error('Error al obtener historial:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener historial de recargas'
            });
        }
    }

    // Obtener montos sugeridos para recarga
    static async getSuggestedAmounts(req, res) {
        try {
            const { provider_id } = req.query;

            const method = RECHARGE_METHODS[provider_id];
            if (!method) {
                return res.status(400).json({
                    success: false,
                    message: 'Metodo no valido'
                });
            }

            // Montos sugeridos fijos para recarga de cuenta
            const suggestions = [10, 20, 50, 100, 200, 500].filter(
                amount => amount >= method.min && amount <= method.max
            );

            res.json({
                success: true,
                data: {
                    method: method.name,
                    min_amount: method.min,
                    max_amount: method.max,
                    commission_percent: method.commission_percent,
                    suggested_amounts: suggestions
                }
            });

        } catch (error) {
            console.error('Error al obtener montos sugeridos:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener montos sugeridos'
            });
        }
    }

    // Calcular comision de recarga
    static async calculateCommission(req, res) {
        try {
            const { method_id, amount } = req.query;

            const method = RECHARGE_METHODS[method_id];
            if (!method) {
                return res.status(400).json({
                    success: false,
                    message: 'Metodo no valido'
                });
            }

            const rechargeAmount = parseFloat(amount);
            const commission = (rechargeAmount * method.commission_percent) / 100;
            const netAmount = rechargeAmount - commission;

            res.json({
                success: true,
                data: {
                    amount: rechargeAmount,
                    commission_percent: method.commission_percent,
                    commission: commission,
                    net_amount: netAmount,
                    message: commission > 0 ? 
                        `Se cobrara una comision de $${commission.toFixed(2)} (${method.commission_percent}%)` :
                        'Sin comision'
                }
            });

        } catch (error) {
            console.error('Error al calcular comision:', error);
            res.status(500).json({
                success: false,
                message: 'Error al calcular comision'
            });
        }
    }
}

// Funcion para simular procesamiento de pago
async function simulatePaymentProcess(methodId, cardNumber, externalRef, amount) {
    // Simular latencia de red
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Simular 98% de exito
    return Math.random() > 0.02;
}

module.exports = RechargeController;
