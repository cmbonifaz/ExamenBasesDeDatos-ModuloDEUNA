const { Account, Transaction, PaymentIdentifier, Client } = require('../models');

class AccountController {
    // Obtener todas las cuentas del cliente autenticado
    static async getMyAccounts(req, res) {
        try {
            const accounts = await Account.findByClientId(req.user.id);

            res.json({
                success: true,
                data: accounts.map(acc => ({
                    id: acc.id,
                    account_number: acc.account_number,
                    account_type: acc.account_type,
                    balance: parseFloat(acc.balance),
                    available_balance: parseFloat(acc.available_balance),
                    currency: acc.currency,
                    daily_limit: parseFloat(acc.daily_limit),
                    monthly_limit: parseFloat(acc.monthly_limit),
                    status: acc.status
                }))
            });
        } catch (error) {
            console.error('Error al obtener cuentas:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener cuentas'
            });
        }
    }

    // Obtener detalle de una cuenta
    static async getAccountDetail(req, res) {
        try {
            const { id } = req.params;
            const account = await Account.findById(id);

            if (!account) {
                return res.status(404).json({
                    success: false,
                    message: 'Cuenta no encontrada'
                });
            }

            if (account.client_id !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes acceso a esta cuenta'
                });
            }

            // Obtener identificadores de pago asociados
            const identifiers = await PaymentIdentifier.findByClientId(req.user.id);
            const accountIdentifiers = identifiers.filter(i => i.account_id === parseInt(id));

            res.json({
                success: true,
                data: {
                    account: {
                        id: account.id,
                        account_number: account.account_number,
                        account_type: account.account_type,
                        balance: parseFloat(account.balance),
                        available_balance: parseFloat(account.available_balance),
                        currency: account.currency,
                        daily_limit: parseFloat(account.daily_limit),
                        monthly_limit: parseFloat(account.monthly_limit),
                        status: account.status,
                        created_at: account.created_at
                    },
                    payment_identifiers: accountIdentifiers
                }
            });
        } catch (error) {
            console.error('Error al obtener detalle de cuenta:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener detalle de cuenta'
            });
        }
    }

    // Obtener movimientos de una cuenta
    static async getAccountTransactions(req, res) {
        try {
            const { id } = req.params;
            const { limit = 20 } = req.query;

            const account = await Account.findById(id);

            if (!account) {
                return res.status(404).json({
                    success: false,
                    message: 'Cuenta no encontrada'
                });
            }

            if (account.client_id !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes acceso a esta cuenta'
                });
            }

            const transactions = await Transaction.findByAccountId(id, parseInt(limit));

            res.json({
                success: true,
                data: transactions.map(t => ({
                    id: t.id,
                    uuid: t.transaction_uuid,
                    type: t.transaction_type,
                    direction: t.direction,
                    amount: parseFloat(t.amount),
                    commission: parseFloat(t.commission),
                    total: parseFloat(t.total_amount),
                    status: t.status,
                    description: t.description,
                    reference: t.reference,
                    counterpart: t.direction === 'ENVIADA' ? 
                        `${t.destination_first_name || ''} ${t.destination_last_name || ''}`.trim() :
                        `${t.source_first_name || ''} ${t.source_last_name || ''}`.trim(),
                    created_at: t.created_at
                }))
            });
        } catch (error) {
            console.error('Error al obtener transacciones:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener transacciones'
            });
        }
    }

    // Agregar identificador de pago a una cuenta
    static async addPaymentIdentifier(req, res) {
        try {
            const { account_id, identifier_type, identifier_value, is_primary = false } = req.body;

            // Verificar cuenta
            const account = await Account.findById(account_id);
            if (!account) {
                return res.status(404).json({
                    success: false,
                    message: 'Cuenta no encontrada'
                });
            }

            if (account.client_id !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes acceso a esta cuenta'
                });
            }

            // Verificar que no exista
            const exists = await PaymentIdentifier.exists(identifier_value);
            if (exists) {
                return res.status(400).json({
                    success: false,
                    message: 'Este identificador ya está en uso'
                });
            }

            const id = await PaymentIdentifier.create({
                client_id: req.user.id,
                account_id,
                identifier_type,
                identifier_value,
                is_primary
            });

            res.status(201).json({
                success: true,
                message: 'Identificador de pago agregado',
                data: { id }
            });
        } catch (error) {
            console.error('Error al agregar identificador:', error);
            res.status(500).json({
                success: false,
                message: 'Error al agregar identificador de pago'
            });
        }
    }

    // Obtener balance total del cliente
    static async getTotalBalance(req, res) {
        try {
            const accounts = await Account.findByClientId(req.user.id);
            
            const total = accounts.reduce((sum, acc) => {
                if (acc.status === 'ACTIVA') {
                    return sum + parseFloat(acc.balance);
                }
                return sum;
            }, 0);

            const available = accounts.reduce((sum, acc) => {
                if (acc.status === 'ACTIVA') {
                    return sum + parseFloat(acc.available_balance);
                }
                return sum;
            }, 0);

            res.json({
                success: true,
                data: {
                    total_balance: total,
                    total_available: available,
                    accounts_count: accounts.filter(a => a.status === 'ACTIVA').length
                }
            });
        } catch (error) {
            console.error('Error al obtener balance total:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener balance total'
            });
        }
    }

    // Obtener estadísticas de la cuenta
    static async getAccountStats(req, res) {
        try {
            const { id } = req.params;
            
            const account = await Account.findById(id);
            if (!account || account.client_id !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes acceso a esta cuenta'
                });
            }

            const stats = await Transaction.getStatistics({
                client_id: req.user.id
            });

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            console.error('Error al obtener estadísticas:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener estadísticas'
            });
        }
    }
}

module.exports = AccountController;
