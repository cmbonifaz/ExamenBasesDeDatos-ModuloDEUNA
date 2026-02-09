import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { accountService } from '../services/api';
import { FiSend, FiSmartphone, FiGrid, FiArrowUpRight, FiArrowDownLeft, FiDollarSign, FiCreditCard } from 'react-icons/fi';

const Dashboard = () => {
    const { user, accounts, refreshAccounts } = useAuth();
    const [transactions, setTransactions] = useState([]);
    const [totalBalance, setTotalBalance] = useState({ total_balance: 0, total_available: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        try {
            setLoading(true);
            
            // Cargar balance total
            const balanceRes = await accountService.getTotalBalance();
            if (balanceRes.data.success) {
                setTotalBalance(balanceRes.data.data);
            }

            // Cargar transacciones recientes de la primera cuenta
            if (accounts.length > 0) {
                const txRes = await accountService.getAccountTransactions(accounts[0].id, 5);
                if (txRes.data.success) {
                    setTransactions(txRes.data.data);
                }
            }

            await refreshAccounts();
        } catch (error) {
            console.error('Error cargando datos:', error);
        } finally {
            setLoading(false);
        }
    };

    const quickActions = [
        { to: '/transfer', icon: FiSend, label: 'Transferir', color: 'from-blue-500 to-blue-600' },
        { to: '/recharge', icon: FiSmartphone, label: 'Recargar', color: 'from-green-500 to-green-600' },
        { to: '/qr', icon: FiGrid, label: 'Pagar QR', color: 'from-purple-500 to-purple-600' },
    ];

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('es-EC', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    };

    const formatDate = (date) => {
        return new Date(date).toLocaleDateString('es-EC', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Welcome Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        ¡Hola, {user?.first_name}! 👋
                    </h1>
                    <p className="text-gray-500 mt-1">
                        Bienvenido a tu banca digital DEUNA
                    </p>
                </div>
            </div>

            {/* Balance Card */}
            <div className="card bg-gradient-to-br from-deuna-primary to-deuna-secondary text-white">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <p className="text-white/80 text-sm font-medium">Balance Total</p>
                        <h2 className="text-4xl font-bold mt-1">
                            {loading ? '...' : formatCurrency(totalBalance.total_balance)}
                        </h2>
                        <p className="text-white/80 text-sm mt-2">
                            Disponible: {loading ? '...' : formatCurrency(totalBalance.total_available)}
                        </p>
                    </div>
                    <div className="flex items-center gap-3 bg-white/10 rounded-2xl p-4">
                        <FiCreditCard className="w-8 h-8" />
                        <div>
                            <p className="text-white/80 text-sm">Cuentas Activas</p>
                            <p className="font-bold text-xl">{accounts.length}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Acciones Rápidas</h3>
                <div className="grid grid-cols-3 gap-4">
                    {quickActions.map(({ to, icon: Icon, label, color }) => (
                        <Link
                            key={to}
                            to={to}
                            className="card-hover text-center group"
                        >
                            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform`}>
                                <Icon className="w-7 h-7 text-white" />
                            </div>
                            <span className="font-medium text-gray-700">{label}</span>
                        </Link>
                    ))}
                </div>
            </div>

            {/* Accounts */}
            <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Mis Cuentas</h3>
                <div className="space-y-3">
                    {accounts.map((account) => (
                        <div key={account.id} className="card-hover">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                                        account.account_type === 'AHORROS' 
                                            ? 'bg-green-100 text-green-600' 
                                            : 'bg-blue-100 text-blue-600'
                                    }`}>
                                        <FiDollarSign className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-gray-900">
                                            Cuenta de {account.account_type}
                                        </p>
                                        <p className="text-sm text-gray-500">
                                            {account.account_number}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-lg text-gray-900">
                                        {formatCurrency(account.balance)}
                                    </p>
                                    <p className="text-sm text-gray-500">
                                        Disponible: {formatCurrency(account.available_balance)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Recent Transactions */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Movimientos Recientes</h3>
                    <Link to="/history" className="text-deuna-primary font-medium text-sm hover:underline">
                        Ver todos
                    </Link>
                </div>
                <div className="card">
                    {loading ? (
                        <div className="text-center py-8">
                            <div className="spinner mx-auto mb-2"></div>
                            <p className="text-gray-500">Cargando...</p>
                        </div>
                    ) : transactions.length === 0 ? (
                        <div className="text-center py-8">
                            <p className="text-gray-500">No hay movimientos recientes</p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {transactions.map((tx) => (
                                <div key={tx.id} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                            tx.direction === 'ENVIADA' 
                                                ? 'bg-red-100 text-red-600' 
                                                : 'bg-green-100 text-green-600'
                                        }`}>
                                            {tx.direction === 'ENVIADA' 
                                                ? <FiArrowUpRight className="w-5 h-5" />
                                                : <FiArrowDownLeft className="w-5 h-5" />
                                            }
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900">
                                                {tx.type === 'RECARGA' ? tx.description : 
                                                 tx.direction === 'ENVIADA' ? `A: ${tx.counterpart}` : `De: ${tx.counterpart}`}
                                            </p>
                                            <p className="text-sm text-gray-500">
                                                {formatDate(tx.created_at)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`font-semibold ${
                                            tx.direction === 'ENVIADA' ? 'text-red-600' : 'text-green-600'
                                        }`}>
                                            {tx.direction === 'ENVIADA' ? '-' : '+'}{formatCurrency(tx.amount)}
                                        </p>
                                        <span className={`text-xs px-2 py-1 rounded-full ${
                                            tx.status === 'CONFIRMADA' 
                                                ? 'bg-green-100 text-green-700'
                                                : tx.status === 'PENDIENTE'
                                                ? 'bg-yellow-100 text-yellow-700'
                                                : 'bg-red-100 text-red-700'
                                        }`}>
                                            {tx.status}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
