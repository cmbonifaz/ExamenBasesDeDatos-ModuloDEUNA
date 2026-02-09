const { getPool } = require('../config/database');
const { 
    Account, 
    Transaction, 
    PaymentIdentifier, 
    Commission, 
    AuditLog, 
    Notification,
    Client
} = require('../models');

class TransferController {
    // Realizar transferencia
    static async transfer(req, res) {
        const pool = getPool();
        const connection = await pool.getConnection();
        
        try {
            await connection.beginTransaction();

            const {
                source_account_id,
                destination_identifier, // Puede ser número de cuenta, alias, teléfono o email
                amount,
                description,
                is_interbank = false,
                destination_bank,
                destination_account_external
            } = req.body;

            const clientId = req.user.id;

            // Validaciones básicas
            if (!source_account_id || !destination_identifier || !amount) {
                return res.status(400).json({
                    success: false,
                    message: 'Cuenta origen, destino y monto son requeridos'
                });
            }

            if (parseFloat(amount) <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'El monto debe ser mayor a 0'
                });
            }

            // Verificar cuenta origen
            const sourceAccount = await Account.findById(source_account_id);
            if (!sourceAccount) {
                return res.status(404).json({
                    success: false,
                    message: 'Cuenta origen no encontrada'
                });
            }

            // Verificar que la cuenta pertenece al cliente autenticado
            if (sourceAccount.client_id !== clientId) {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permiso para operar con esta cuenta'
                });
            }

            // Verificar estado de la cuenta origen
            if (sourceAccount.status !== 'ACTIVA') {
                return res.status(400).json({
                    success: false,
                    message: 'La cuenta origen no está activa'
                });
            }

            // Buscar cuenta destino
            let destinationAccount = null;
            let destinationClientId = null;

            if (!is_interbank) {
                // Primero buscar por número de cuenta
                destinationAccount = await Account.findByAccountNumber(destination_identifier);

                // Si no encuentra, buscar por identificador de pago
                if (!destinationAccount) {
                    const identifier = await PaymentIdentifier.findByIdentifierValue(destination_identifier);
                    if (identifier) {
                        destinationAccount = await Account.findById(identifier.account_id);
                    }
                }

                // Si aún no encuentra, buscar por teléfono o email
                if (!destinationAccount) {
                    const identifier = await PaymentIdentifier.findByPhoneOrEmail(destination_identifier);
                    if (identifier) {
                        destinationAccount = await Account.findById(identifier.account_id);
                    }
                }

                if (!destinationAccount) {
                    return res.status(404).json({
                        success: false,
                        message: 'No se encontró el destinatario. Verifica el número de cuenta, alias, teléfono o email.'
                    });
                }

                // Evitar transferencia a sí mismo
                if (destinationAccount.id === source_account_id) {
                    return res.status(400).json({
                        success: false,
                        message: 'No puedes transferir a tu misma cuenta'
                    });
                }

                if (destinationAccount.status !== 'ACTIVA') {
                    return res.status(400).json({
                        success: false,
                        message: 'La cuenta destino no está disponible para recibir transferencias'
                    });
                }

                destinationClientId = destinationAccount.client_id;
            }

            // Calcular comisión
            const commissionResult = await Commission.calculate('TRANSFERENCIA', amount, is_interbank);
            const commission = commissionResult.commission;
            const totalAmount = parseFloat(amount) + commission;

            // Verificar saldo disponible
            if (!(await Account.hasAvailableBalance(source_account_id, totalAmount))) {
                return res.status(400).json({
                    success: false,
                    message: `Saldo insuficiente. Necesitas $${totalAmount.toFixed(2)} (incluye comisión de $${commission.toFixed(2)})`
                });
            }

            // Verificar límite diario
            const limitCheck = await Account.checkDailyLimit(source_account_id, amount);
            if (!limitCheck.allowed) {
                return res.status(400).json({
                    success: false,
                    message: limitCheck.reason
                });
            }

            // Generar referencia
            const reference = Transaction.generateReference('TRF');

            // Crear transacción
            const transactionData = {
                transaction_type: 'TRANSFERENCIA',
                source_account_id,
                destination_account_id: destinationAccount?.id || null,
                amount: parseFloat(amount),
                commission,
                description: description || 'Transferencia DEUNA',
                reference,
                is_interbank,
                destination_bank: is_interbank ? destination_bank : null,
                destination_account_external: is_interbank ? destination_account_external : null
            };

            const transaction = await Transaction.create(transactionData, connection);

            // Ejecutar débito de cuenta origen
            const debitSuccess = await Account.debit(source_account_id, totalAmount, connection);
            if (!debitSuccess) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'No se pudo procesar el débito'
                });
            }

            // Ejecutar crédito a cuenta destino (solo si no es interbancaria)
            if (!is_interbank && destinationAccount) {
                const creditSuccess = await Account.credit(destinationAccount.id, parseFloat(amount), connection);
                if (!creditSuccess) {
                    await connection.rollback();
                    return res.status(400).json({
                        success: false,
                        message: 'No se pudo acreditar al destinatario'
                    });
                }
            }

            // Actualizar límite diario
            await Account.updateDailyLimit(source_account_id, parseFloat(amount), connection);

            // Marcar transacción como confirmada
            await Transaction.updateStatus(transaction.id, 'CONFIRMADA', null, connection);

            // Commit de la transacción
            await connection.commit();

            // Obtener datos del origen y destino para notificaciones
            const sourceClient = await Client.findById(clientId);
            let destinationClient = null;
            if (destinationClientId) {
                destinationClient = await Client.findById(destinationClientId);
            }

            // Crear notificaciones
            await Notification.createTransferSent(
                clientId, 
                transaction.id, 
                destinationClient ? `${destinationClient.first_name} ${destinationClient.last_name}` : 'Destino externo',
                amount
            );

            if (destinationClientId) {
                await Notification.createTransferReceived(
                    destinationClientId, 
                    transaction.id, 
                    `${sourceClient.first_name} ${sourceClient.last_name}`,
                    amount
                );
            }

            // Registrar auditoría
            await AuditLog.create({
                client_id: clientId,
                action_type: 'TRANSFER',
                entity_type: 'TRANSACTION',
                entity_id: transaction.id,
                new_values: {
                    amount,
                    commission,
                    destination: destination_identifier,
                    reference
                },
                ip_address: req.ip,
                user_agent: req.get('user-agent'),
                status: 'SUCCESS'
            });

            // Obtener saldo actualizado
            const updatedSourceAccount = await Account.findById(source_account_id);

            res.status(201).json({
                success: true,
                message: 'Transferencia realizada exitosamente',
                data: {
                    transaction: {
                        id: transaction.id,
                        uuid: transaction.uuid,
                        reference,
                        amount: parseFloat(amount),
                        commission,
                        total: totalAmount,
                        status: 'CONFIRMADA',
                        destination: destinationClient ? 
                            `${destinationClient.first_name} ${destinationClient.last_name}` : 
                            destination_account_external
                    },
                    source_account: {
                        id: source_account_id,
                        account_number: sourceAccount.account_number,
                        new_balance: updatedSourceAccount.balance,
                        new_available_balance: updatedSourceAccount.available_balance
                    }
                }
            });

        } catch (error) {
            await connection.rollback();
            console.error('Error en transferencia:', error);
            
            await AuditLog.create({
                client_id: req.user.id,
                action_type: 'TRANSFER',
                entity_type: 'TRANSACTION',
                new_values: req.body,
                ip_address: req.ip,
                user_agent: req.get('user-agent'),
                status: 'FAILURE',
                error_message: error.message
            });

            res.status(500).json({
                success: false,
                message: 'Error al procesar la transferencia'
            });
        } finally {
            connection.release();
        }
    }

    // Buscar destinatario para preview
    static async searchRecipient(req, res) {
        try {
            const { identifier } = req.query;

            if (!identifier) {
                return res.status(400).json({
                    success: false,
                    message: 'Identificador es requerido'
                });
            }

            // Buscar por número de cuenta
            let account = await Account.findByAccountNumber(identifier);

            // Si no encuentra, buscar por identificador de pago
            if (!account) {
                const paymentId = await PaymentIdentifier.findByIdentifierValue(identifier);
                if (paymentId) {
                    account = await Account.findById(paymentId.account_id);
                }
            }

            // Si aún no encuentra, buscar por teléfono o email
            if (!account) {
                const paymentId = await PaymentIdentifier.findByPhoneOrEmail(identifier);
                if (paymentId) {
                    account = await Account.findById(paymentId.account_id);
                }
            }

            if (!account) {
                return res.status(404).json({
                    success: false,
                    message: 'Destinatario no encontrado'
                });
            }

            // Evitar mostrar datos si es la misma persona
            const client = await Client.findById(account.client_id);

            res.json({
                success: true,
                data: {
                    name: `${client.first_name} ${client.last_name}`,
                    account_number: account.account_number.substring(0, 4) + '****' + account.account_number.substring(account.account_number.length - 4),
                    account_type: account.account_type,
                    bank: 'Banco Pichincha'
                }
            });

        } catch (error) {
            console.error('Error al buscar destinatario:', error);
            res.status(500).json({
                success: false,
                message: 'Error al buscar destinatario'
            });
        }
    }

    // Obtener historial de transferencias
    static async getTransferHistory(req, res) {
        try {
            const { account_id, limit = 20, offset = 0, from_date, to_date } = req.query;
            const clientId = req.user.id;

            const filters = {
                client_id: clientId,
                transaction_type: 'TRANSFERENCIA',
                limit: parseInt(limit),
                offset: parseInt(offset)
            };

            if (account_id) {
                // Verificar que la cuenta pertenece al cliente
                const account = await Account.findById(account_id);
                if (!account || account.client_id !== clientId) {
                    return res.status(403).json({
                        success: false,
                        message: 'No tienes acceso a esta cuenta'
                    });
                }
                filters.source_account_id = account_id;
            }

            if (from_date) filters.from_date = from_date;
            if (to_date) filters.to_date = to_date;

            const transactions = await Transaction.findAll(filters);

            res.json({
                success: true,
                data: transactions.map(t => ({
                    id: t.id,
                    uuid: t.transaction_uuid,
                    reference: t.reference,
                    amount: parseFloat(t.amount),
                    commission: parseFloat(t.commission),
                    total: parseFloat(t.total_amount),
                    status: t.status,
                    description: t.description,
                    source: `${t.source_first_name || ''} ${t.source_last_name || ''}`.trim(),
                    destination: `${t.destination_first_name || ''} ${t.destination_last_name || ''}`.trim() || t.destination_account_external,
                    is_interbank: t.is_interbank,
                    created_at: t.created_at,
                    processed_at: t.processed_at
                }))
            });

        } catch (error) {
            console.error('Error al obtener historial:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener historial de transferencias'
            });
        }
    }

    // Obtener detalle de una transferencia
    static async getTransferDetail(req, res) {
        try {
            const { id } = req.params;
            const clientId = req.user.id;

            const transaction = await Transaction.findById(id);

            if (!transaction) {
                return res.status(404).json({
                    success: false,
                    message: 'Transacción no encontrada'
                });
            }

            // Verificar que el cliente tiene acceso a esta transacción
            const sourceAccount = transaction.source_account_id ? await Account.findById(transaction.source_account_id) : null;
            const destAccount = transaction.destination_account_id ? await Account.findById(transaction.destination_account_id) : null;

            const hasAccess = (sourceAccount && sourceAccount.client_id === clientId) || 
                            (destAccount && destAccount.client_id === clientId);

            if (!hasAccess) {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes acceso a esta transacción'
                });
            }

            res.json({
                success: true,
                data: {
                    id: transaction.id,
                    uuid: transaction.transaction_uuid,
                    reference: transaction.reference,
                    type: transaction.transaction_type,
                    amount: parseFloat(transaction.amount),
                    commission: parseFloat(transaction.commission),
                    total: parseFloat(transaction.total_amount),
                    status: transaction.status,
                    description: transaction.description,
                    source: {
                        account: transaction.source_account_number,
                        name: `${transaction.source_first_name || ''} ${transaction.source_last_name || ''}`.trim(),
                        cedula: transaction.source_cedula
                    },
                    destination: {
                        account: transaction.destination_account_number || transaction.destination_account_external,
                        name: `${transaction.destination_first_name || ''} ${transaction.destination_last_name || ''}`.trim(),
                        cedula: transaction.destination_cedula,
                        bank: transaction.is_interbank ? transaction.destination_bank : 'Banco Pichincha'
                    },
                    is_interbank: transaction.is_interbank,
                    failure_reason: transaction.failure_reason,
                    created_at: transaction.created_at,
                    processed_at: transaction.processed_at
                }
            });

        } catch (error) {
            console.error('Error al obtener detalle:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener detalle de la transacción'
            });
        }
    }

    // Calcular comisión preview
    static async calculateCommission(req, res) {
        try {
            const { amount, is_interbank = false } = req.query;

            if (!amount || parseFloat(amount) <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Monto válido es requerido'
                });
            }

            const result = await Commission.calculate('TRANSFERENCIA', parseFloat(amount), is_interbank === 'true');

            res.json({
                success: true,
                data: {
                    amount: parseFloat(amount),
                    commission: result.commission,
                    total: parseFloat(amount) + result.commission,
                    description: result.description
                }
            });

        } catch (error) {
            console.error('Error al calcular comisión:', error);
            res.status(500).json({
                success: false,
                message: 'Error al calcular comisión'
            });
        }
    }
}

module.exports = TransferController;
