import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { accountService } from '../services/api';
import { FiList, FiArrowUpRight, FiArrowDownLeft, FiFilter, FiCalendar, FiSearch, FiDownload } from 'react-icons/fi';

const History = () => {
    const { accounts } = useAuth();
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState({
        account_id: '',
        type: '',
        status: '',
        start_date: '',
        end_date: ''
    });
    const [showFilters, setShowFilters] = useState(false);

    useEffect(() => {
        if (accounts.length > 0 && !filter.account_id) {
            setFilter(prev => ({ ...prev, account_id: accounts[0].id }));
        }
    }, [accounts]);

    useEffect(() => {
        if (filter.account_id) {
            loadTransactions();
        }
    }, [filter.account_id]);

    const loadTransactions = async () => {
        setLoading(true);
        try {
            const response = await accountService.getTransactions(filter.account_id);
            if (response.data.success) {
                let filtered = response.data.data;
                
                // Aplicar filtros locales
                if (filter.type) {
                    filtered = filtered.filter(t => t.transaction_type === filter.type);
                }
                if (filter.status) {
                    filtered = filtered.filter(t => t.status === filter.status);
                }
                if (filter.start_date) {
                    const start = new Date(filter.start_date);
                    filtered = filtered.filter(t => new Date(t.created_at) >= start);
                }
                if (filter.end_date) {
                    const end = new Date(filter.end_date);
                    end.setHours(23, 59, 59);
                    filtered = filtered.filter(t => new Date(t.created_at) <= end);
                }
                
                setTransactions(filtered);
            }
        } catch (error) {
            console.error('Error cargando transacciones:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('es-EC', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-EC', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getTransactionIcon = (type, isIncoming) => {
        if (isIncoming) {
            return <FiArrowDownLeft className="w-5 h-5 text-green-500" />;
        }
        return <FiArrowUpRight className="w-5 h-5 text-red-500" />;
    };

    const getStatusBadge = (status) => {
        const styles = {
            'CONFIRMADA': 'bg-green-100 text-green-700',
            'PENDIENTE': 'bg-yellow-100 text-yellow-700',
            'FALLIDA': 'bg-red-100 text-red-700',
            'REVERSADA': 'bg-gray-100 text-gray-700'
        };
        return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100'}`}>
                {status}
            </span>
        );
    };

    const getTypeBadge = (type) => {
        const labels = {
            'TRANSFERENCIA': 'Transferencia',
            'QR': 'Pago QR',
            'RECARGA': 'Recarga',
            'DEPOSITO': 'Depósito',
            'RETIRO': 'Retiro'
        };
        const styles = {
            'TRANSFERENCIA': 'bg-blue-100 text-blue-700',
            'QR': 'bg-purple-100 text-purple-700',
            'RECARGA': 'bg-green-100 text-green-700',
            'DEPOSITO': 'bg-teal-100 text-teal-700',
            'RETIRO': 'bg-orange-100 text-orange-700'
        };
        return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[type] || 'bg-gray-100'}`}>
                {labels[type] || type}
            </span>
        );
    };

    const selectedAccount = accounts.find(a => a.id === parseInt(filter.account_id));

    const handleApplyFilters = () => {
        loadTransactions();
        setShowFilters(false);
    };

    const handleClearFilters = () => {
        setFilter({
            ...filter,
            type: '',
            status: '',
            start_date: '',
            end_date: ''
        });
        loadTransactions();
    };

    const calculateTotals = () => {
        const incoming = transactions
            .filter(t => t.destination_account_id === parseInt(filter.account_id) && t.status === 'CONFIRMADA')
            .reduce((sum, t) => sum + parseFloat(t.amount), 0);
        const outgoing = transactions
            .filter(t => t.source_account_id === parseInt(filter.account_id) && t.status === 'CONFIRMADA')
            .reduce((sum, t) => sum + parseFloat(t.amount), 0);
        return { incoming, outgoing };
    };

    const totals = calculateTotals();

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Historial</h1>
                    <p className="text-gray-500">Todas tus transacciones</p>
                </div>
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`btn-secondary flex items-center gap-2 ${showFilters ? 'bg-blue-100 text-blue-700' : ''}`}
                >
                    <FiFilter className="w-4 h-4" />
                    Filtros
                </button>
            </div>

            {/* Selector de cuenta y filtros */}
            <div className="card mb-6">
                <div className="flex flex-wrap gap-4 items-end">
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Cuenta
                        </label>
                        <select
                            value={filter.account_id}
                            onChange={(e) => setFilter({ ...filter, account_id: e.target.value })}
                            className="input-field"
                        >
                            {accounts.map((account) => (
                                <option key={account.id} value={account.id}>
                                    {account.account_number} - {account.account_type}
                                </option>
                            ))}
                        </select>
                    </div>

                    {selectedAccount && (
                        <div className="text-right">
                            <p className="text-sm text-gray-500">Saldo actual</p>
                            <p className="text-xl font-bold text-gray-900">
                                {formatCurrency(selectedAccount.available_balance)}
                            </p>
                        </div>
                    )}
                </div>

                {/* Filtros expandibles */}
                {showFilters && (
                    <div className="mt-4 pt-4 border-t">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Tipo
                                </label>
                                <select
                                    value={filter.type}
                                    onChange={(e) => setFilter({ ...filter, type: e.target.value })}
                                    className="input-field"
                                >
                                    <option value="">Todos</option>
                                    <option value="TRANSFERENCIA">Transferencias</option>
                                    <option value="QR">Pagos QR</option>
                                    <option value="RECARGA">Recargas</option>
                                    <option value="DEPOSITO">Depósitos</option>
                                    <option value="RETIRO">Retiros</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Estado
                                </label>
                                <select
                                    value={filter.status}
                                    onChange={(e) => setFilter({ ...filter, status: e.target.value })}
                                    className="input-field"
                                >
                                    <option value="">Todos</option>
                                    <option value="CONFIRMADA">Confirmada</option>
                                    <option value="PENDIENTE">Pendiente</option>
                                    <option value="FALLIDA">Fallida</option>
                                    <option value="REVERSADA">Reversada</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Desde
                                </label>
                                <input
                                    type="date"
                                    value={filter.start_date}
                                    onChange={(e) => setFilter({ ...filter, start_date: e.target.value })}
                                    className="input-field"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Hasta
                                </label>
                                <input
                                    type="date"
                                    value={filter.end_date}
                                    onChange={(e) => setFilter({ ...filter, end_date: e.target.value })}
                                    className="input-field"
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-4">
                            <button onClick={handleApplyFilters} className="btn-primary">
                                <FiSearch className="w-4 h-4 mr-2" />
                                Aplicar Filtros
                            </button>
                            <button onClick={handleClearFilters} className="btn-secondary">
                                Limpiar
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Resumen */}
            {transactions.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="card">
                        <p className="text-sm text-gray-500">Total Transacciones</p>
                        <p className="text-2xl font-bold text-gray-900">{transactions.length}</p>
                    </div>
                    <div className="card">
                        <p className="text-sm text-gray-500">Ingresos</p>
                        <p className="text-2xl font-bold text-green-600">+{formatCurrency(totals.incoming)}</p>
                    </div>
                    <div className="card">
                        <p className="text-sm text-gray-500">Egresos</p>
                        <p className="text-2xl font-bold text-red-600">-{formatCurrency(totals.outgoing)}</p>
                    </div>
                </div>
            )}

            {/* Lista de transacciones */}
            <div className="card">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900">
                        <FiList className="inline w-5 h-5 mr-2" />
                        Transacciones
                    </h3>
                    {transactions.length > 0 && (
                        <span className="text-sm text-gray-500">
                            {transactions.length} resultados
                        </span>
                    )}
                </div>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="spinner" />
                    </div>
                ) : transactions.length === 0 ? (
                    <div className="text-center py-12">
                        <FiList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">No hay transacciones</p>
                        {(filter.type || filter.status || filter.start_date || filter.end_date) && (
                            <button onClick={handleClearFilters} className="text-blue-600 hover:underline text-sm mt-2">
                                Limpiar filtros
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {transactions.map((transaction) => {
                            const isIncoming = transaction.destination_account_id === parseInt(filter.account_id);
                            
                            return (
                                <div 
                                    key={transaction.id} 
                                    className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                            isIncoming ? 'bg-green-100' : 'bg-red-100'
                                        }`}>
                                            {getTransactionIcon(transaction.transaction_type, isIncoming)}
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900">{transaction.description}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                {getTypeBadge(transaction.transaction_type)}
                                                {getStatusBadge(transaction.status)}
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1">
                                                <FiCalendar className="inline w-3 h-3 mr-1" />
                                                {formatDate(transaction.created_at)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`font-bold text-lg ${
                                            isIncoming ? 'text-green-600' : 'text-red-600'
                                        }`}>
                                            {isIncoming ? '+' : '-'}{formatCurrency(transaction.amount)}
                                        </p>
                                        {transaction.commission_amount > 0 && (
                                            <p className="text-xs text-gray-500">
                                                Comisión: {formatCurrency(transaction.commission_amount)}
                                            </p>
                                        )}
                                        <p className="text-xs text-gray-400 font-mono">
                                            {transaction.reference}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default History;
