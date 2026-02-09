const { getPool } = require('../config/database');
const { 
    Account, 
    Transaction, 
    QRPayment, 
    Commission, 
    AuditLog, 
    Notification,
    Client
} = require('../models');

class QRController {
    // Generar código QR para cobro
    static async generateQR(req, res) {
        try {
            const {
                account_id,
                amount,
                is_amount_fixed = true,
                min_amount,
                max_amount,
                description,
                expiry_minutes = 30,
                usage_type = 'SINGLE_USE',
                max_uses = 1
            } = req.body;

            const clientId = req.user.id;

            // Validaciones
            if (!account_id) {
                return res.status(400).json({
                    success: false,
                    message: 'Cuenta es requerida'
                });
            }

            // Verificar cuenta
            const account = await Account.findById(account_id);
            if (!account) {
                return res.status(404).json({
                    success: false,
                    message: 'Cuenta no encontrada'
                });
            }

            if (account.client_id !== clientId) {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permiso para esta cuenta'
                });
            }

            if (account.status !== 'ACTIVA') {
                return res.status(400).json({
                    success: false,
                    message: 'La cuenta no está activa'
                });
            }

            // Validar monto si es fijo
            if (is_amount_fixed && (!amount || parseFloat(amount) <= 0)) {
                return res.status(400).json({
                    success: false,
                    message: 'Monto válido es requerido'
                });
            }

            // Validar rango si no es fijo
            if (!is_amount_fixed) {
                if (min_amount && max_amount && parseFloat(min_amount) >= parseFloat(max_amount)) {
                    return res.status(400).json({
                        success: false,
                        message: 'El monto mínimo debe ser menor al máximo'
                    });
                }
            }

            // Generar referencia
            const reference = Transaction.generateReference('QR');

            // Crear QR
            const qrResult = await QRPayment.create({
                creator_client_id: clientId,
                creator_account_id: account_id,
                amount: is_amount_fixed ? parseFloat(amount) : null,
                is_amount_fixed,
                min_amount: min_amount ? parseFloat(min_amount) : null,
                max_amount: max_amount ? parseFloat(max_amount) : null,
                description,
                reference,
                expiry_minutes: parseInt(expiry_minutes),
                usage_type,
                max_uses: parseInt(max_uses)
            });

            // Registrar auditoría
            await AuditLog.create({
                client_id: clientId,
                action_type: 'CREATE_QR',
                entity_type: 'QR_PAYMENT',
                entity_id: qrResult.id,
                new_values: {
                    amount,
                    is_amount_fixed,
                    reference,
                    expiry_minutes
                },
                ip_address: req.ip,
                user_agent: req.get('user-agent'),
                status: 'SUCCESS'
            });

            res.status(201).json({
                success: true,
                message: 'Código QR generado exitosamente',
                data: {
                    id: qrResult.id,
                    uuid: qrResult.uuid,
                    reference,
                    qr_code: qrResult.qr_code,
                    amount: is_amount_fixed ? parseFloat(amount) : null,
                    is_amount_fixed,
                    min_amount,
                    max_amount,
                    description,
                    expiry_datetime: qrResult.expiry_datetime,
                    usage_type,
                    max_uses
                }
            });

        } catch (error) {
            console.error('Error al generar QR:', error);
            res.status(500).json({
                success: false,
                message: 'Error al generar código QR'
            });
        }
    }

    // Obtener información de QR (para quien va a pagar)
    static async getQRInfo(req, res) {
        try {
            const { uuid } = req.params;

            const validation = await QRPayment.validateForPayment(uuid);

            if (!validation.valid) {
                return res.status(400).json({
                    success: false,
                    message: validation.error
                });
            }

            const qr = validation.qr;

            res.json({
                success: true,
                data: {
                    uuid: qr.qr_uuid,
                    recipient: `${qr.first_name} ${qr.last_name}`,
                    amount: qr.amount ? parseFloat(qr.amount) : null,
                    is_amount_fixed: qr.is_amount_fixed,
                    min_amount: qr.min_amount ? parseFloat(qr.min_amount) : null,
                    max_amount: qr.max_amount ? parseFloat(qr.max_amount) : null,
                    description: qr.description,
                    reference: qr.reference,
                    expiry_datetime: qr.expiry_datetime
                }
            });

        } catch (error) {
            console.error('Error al obtener info de QR:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener información del QR'
            });
        }
    }

    // Pagar con código QR
    static async payWithQR(req, res) {
        const pool = getPool();
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            const { qr_uuid, source_account_id, amount } = req.body;
            const clientId = req.user.id;

            // Validar campos
            if (!qr_uuid || !source_account_id) {
                return res.status(400).json({
                    success: false,
                    message: 'UUID del QR y cuenta origen son requeridos'
                });
            }

            // Validar QR
            const validation = await QRPayment.validateForPayment(qr_uuid);
            if (!validation.valid) {
                return res.status(400).json({
                    success: false,
                    message: validation.error
                });
            }

            const qr = validation.qr;

            // Determinar monto a pagar
            let paymentAmount;
            if (qr.is_amount_fixed) {
                paymentAmount = parseFloat(qr.amount);
            } else {
                if (!amount || parseFloat(amount) <= 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'Monto es requerido para este QR'
                    });
                }
                paymentAmount = parseFloat(amount);

                // Validar rango
                if (qr.min_amount && paymentAmount < parseFloat(qr.min_amount)) {
                    return res.status(400).json({
                        success: false,
                        message: `El monto mínimo es $${parseFloat(qr.min_amount).toFixed(2)}`
                    });
                }
                if (qr.max_amount && paymentAmount > parseFloat(qr.max_amount)) {
                    return res.status(400).json({
                        success: false,
                        message: `El monto máximo es $${parseFloat(qr.max_amount).toFixed(2)}`
                    });
                }
            }

            // Verificar cuenta origen
            const sourceAccount = await Account.findById(source_account_id);
            if (!sourceAccount) {
                return res.status(404).json({
                    success: false,
                    message: 'Cuenta origen no encontrada'
                });
            }

            if (sourceAccount.client_id !== clientId) {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permiso para esta cuenta'
                });
            }

            if (sourceAccount.status !== 'ACTIVA') {
                return res.status(400).json({
                    success: false,
                    message: 'La cuenta origen no está activa'
                });
            }

            // Evitar pago a sí mismo
            if (sourceAccount.id === qr.account_id) {
                return res.status(400).json({
                    success: false,
                    message: 'No puedes pagar a tu propia cuenta'
                });
            }

            // Calcular comisión
            const commissionResult = await Commission.calculate('PAGO_QR', paymentAmount);
            const commission = commissionResult.commission;
            const totalAmount = paymentAmount + commission;

            // Verificar saldo
            if (!(await Account.hasAvailableBalance(source_account_id, totalAmount))) {
                return res.status(400).json({
                    success: false,
                    message: `Saldo insuficiente. Necesitas $${totalAmount.toFixed(2)}`
                });
            }

            // Verificar límite diario
            const limitCheck = await Account.checkDailyLimit(source_account_id, paymentAmount);
            if (!limitCheck.allowed) {
                return res.status(400).json({
                    success: false,
                    message: limitCheck.reason
                });
            }

            // Generar referencia
            const reference = Transaction.generateReference('QRP');

            // Crear transacción
            const transactionData = {
                transaction_type: 'PAGO_QR',
                source_account_id,
                destination_account_id: qr.account_id,
                amount: paymentAmount,
                commission,
                description: qr.description || 'Pago con QR DEUNA',
                reference,
                qr_payment_id: qr.id
            };

            const transaction = await Transaction.create(transactionData, connection);

            // Débito origen
            const debitSuccess = await Account.debit(source_account_id, totalAmount, connection);
            if (!debitSuccess) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'No se pudo procesar el débito'
                });
            }

            // Crédito destino
            const creditSuccess = await Account.credit(qr.account_id, paymentAmount, connection);
            if (!creditSuccess) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'No se pudo acreditar al destinatario'
                });
            }

            // Marcar QR como usado
            await QRPayment.markAsUsed(qr.id, connection);

            // Actualizar límite diario
            await Account.updateDailyLimit(source_account_id, paymentAmount, connection);

            // Confirmar transacción
            await Transaction.updateStatus(transaction.id, 'CONFIRMADA', null, connection);

            // Commit
            await connection.commit();

            // Obtener datos para notificaciones
            const payerClient = await Client.findById(clientId);
            const recipientClient = await Client.findById(qr.creator_client_id);

            // Notificaciones
            await Notification.createTransferSent(
                clientId,
                transaction.id,
                `${recipientClient.first_name} ${recipientClient.last_name}`,
                paymentAmount
            );

            await Notification.createQRPayment(
                qr.creator_client_id,
                transaction.id,
                `${payerClient.first_name} ${payerClient.last_name}`,
                paymentAmount
            );

            // Auditoría
            await AuditLog.create({
                client_id: clientId,
                action_type: 'PAY_QR',
                entity_type: 'TRANSACTION',
                entity_id: transaction.id,
                new_values: {
                    qr_uuid,
                    amount: paymentAmount,
                    recipient: `${recipientClient.first_name} ${recipientClient.last_name}`,
                    reference
                },
                ip_address: req.ip,
                user_agent: req.get('user-agent'),
                status: 'SUCCESS'
            });

            // Obtener saldo actualizado
            const updatedAccount = await Account.findById(source_account_id);

            res.status(201).json({
                success: true,
                message: 'Pago realizado exitosamente',
                data: {
                    transaction: {
                        id: transaction.id,
                        uuid: transaction.uuid,
                        reference,
                        amount: paymentAmount,
                        commission,
                        total: totalAmount,
                        status: 'CONFIRMADA',
                        recipient: `${recipientClient.first_name} ${recipientClient.last_name}`
                    },
                    source_account: {
                        id: source_account_id,
                        account_number: sourceAccount.account_number,
                        new_balance: updatedAccount.balance,
                        new_available_balance: updatedAccount.available_balance
                    }
                }
            });

        } catch (error) {
            await connection.rollback();
            console.error('Error en pago QR:', error);

            await AuditLog.create({
                client_id: req.user.id,
                action_type: 'PAY_QR',
                entity_type: 'TRANSACTION',
                new_values: req.body,
                ip_address: req.ip,
                user_agent: req.get('user-agent'),
                status: 'FAILURE',
                error_message: error.message
            });

            res.status(500).json({
                success: false,
                message: 'Error al procesar el pago'
            });
        } finally {
            connection.release();
        }
    }

    // Obtener mis códigos QR
    static async getMyQRs(req, res) {
        try {
            const clientId = req.user.id;
            const { status } = req.query;

            let qrs = await QRPayment.findByClientId(clientId);

            if (status) {
                qrs = qrs.filter(qr => qr.status === status);
            }

            res.json({
                success: true,
                data: qrs.map(qr => ({
                    id: qr.id,
                    uuid: qr.qr_uuid,
                    account_number: qr.account_number,
                    amount: qr.amount ? parseFloat(qr.amount) : null,
                    is_amount_fixed: qr.is_amount_fixed,
                    description: qr.description,
                    reference: qr.reference,
                    qr_code: qr.qr_code_data,
                    expiry_datetime: qr.expiry_datetime,
                    usage_type: qr.usage_type,
                    times_used: qr.times_used,
                    max_uses: qr.max_uses,
                    status: qr.status,
                    created_at: qr.created_at
                }))
            });

        } catch (error) {
            console.error('Error al obtener QRs:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener códigos QR'
            });
        }
    }

    // Cancelar código QR
    static async cancelQR(req, res) {
        try {
            const { id } = req.params;
            const clientId = req.user.id;

            const cancelled = await QRPayment.cancel(id, clientId);

            if (!cancelled) {
                return res.status(400).json({
                    success: false,
                    message: 'No se pudo cancelar el código QR'
                });
            }

            await AuditLog.create({
                client_id: clientId,
                action_type: 'CANCEL_QR',
                entity_type: 'QR_PAYMENT',
                entity_id: id,
                ip_address: req.ip,
                user_agent: req.get('user-agent'),
                status: 'SUCCESS'
            });

            res.json({
                success: true,
                message: 'Código QR cancelado'
            });

        } catch (error) {
            console.error('Error al cancelar QR:', error);
            res.status(500).json({
                success: false,
                message: 'Error al cancelar código QR'
            });
        }
    }
}

module.exports = QRController;
