import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { accountService, notificationService } from '../services/api';
import toast from 'react-hot-toast';
import { FiUser, FiMail, FiPhone, FiCreditCard, FiShield, FiBell, FiCheck, FiPlus, FiTrash2 } from 'react-icons/fi';

const Profile = () => {
    const { user, accounts, refreshAccounts } = useAuth();
    const [activeTab, setActiveTab] = useState('info');
    const [paymentIds, setPaymentIds] = useState([]);
    const [cards, setCards] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(false);

    const [newPaymentId, setNewPaymentId] = useState({
        type: 'TELEFONO',
        identifier: '',
        alias: ''
    });

    useEffect(() => {
        loadPaymentIds();
        loadCards();
        loadNotifications();
    }, []);

    const loadPaymentIds = async () => {
        try {
            const response = await accountService.getPaymentIdentifiers();
            if (response.data.success) {
                setPaymentIds(response.data.data);
            }
        } catch (error) {
            console.error('Error cargando identificadores:', error);
        }
    };

    const loadCards = async () => {
        try {
            const response = await accountService.getCards();
            if (response.data.success) {
                setCards(response.data.data);
            }
        } catch (error) {
            console.error('Error cargando tarjetas:', error);
        }
    };

    const loadNotifications = async () => {
        try {
            const response = await notificationService.getAll();
            if (response.data.success) {
                setNotifications(response.data.data.slice(0, 10));
            }
        } catch (error) {
            console.error('Error cargando notificaciones:', error);
        }
    };

    const handleAddPaymentId = async () => {
        if (!newPaymentId.identifier) {
            toast.error('Ingresa el identificador');
            return;
        }

        setLoading(true);
        try {
            const response = await accountService.addPaymentIdentifier({
                account_id: accounts[0]?.id,
                type: newPaymentId.type,
                identifier: newPaymentId.identifier,
                alias: newPaymentId.alias || undefined
            });

            if (response.data.success) {
                toast.success('Identificador agregado');
                loadPaymentIds();
                setNewPaymentId({ type: 'TELEFONO', identifier: '', alias: '' });
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error al agregar');
        } finally {
            setLoading(false);
        }
    };

    const handleDeletePaymentId = async (id) => {
        if (!confirm('¿Eliminar este identificador?')) return;

        try {
            await accountService.deletePaymentIdentifier(id);
            toast.success('Identificador eliminado');
            loadPaymentIds();
        } catch (error) {
            toast.error('Error al eliminar');
        }
    };

    const handleMarkNotificationRead = async (id) => {
        try {
            await notificationService.markAsRead(id);
            loadNotifications();
        } catch (error) {
            console.error('Error:', error);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('es-EC', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    };

    const maskCardNumber = (number) => {
        return `**** **** **** ${number.slice(-4)}`;
    };

    const getCardBrand = (number) => {
        if (number.startsWith('4')) return 'Visa';
        if (number.startsWith('5')) return 'Mastercard';
        return 'Tarjeta';
    };

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div className="card mb-6">
                <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                        <span className="text-3xl font-bold text-white">
                            {user?.first_name?.[0]}{user?.last_name?.[0]}
                        </span>
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">
                            {user?.first_name} {user?.last_name}
                        </h1>
                        <p className="text-gray-500">{user?.email}</p>
                        <div className="flex items-center gap-2 mt-2">
                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium flex items-center gap-1">
                                <FiShield className="w-3 h-3" />
                                Cuenta Verificada
                            </span>
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                                {accounts.length} cuenta(s)
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex bg-gray-100 rounded-xl p-1 mb-6 overflow-x-auto">
                {[
                    { id: 'info', label: 'Información', icon: FiUser },
                    { id: 'accounts', label: 'Cuentas', icon: FiCreditCard },
                    { id: 'identifiers', label: 'Identificadores', icon: FiPhone },
                    { id: 'notifications', label: 'Notificaciones', icon: FiBell }
                ].map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        onClick={() => setActiveTab(id)}
                        className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
                            activeTab === id
                                ? 'bg-white text-blue-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        <Icon className="w-4 h-4" />
                        <span className="hidden sm:inline">{label}</span>
                    </button>
                ))}
            </div>

            {/* Información Personal */}
            {activeTab === 'info' && (
                <div className="card">
                    <h3 className="text-lg font-semibold mb-6">Información Personal</h3>
                    
                    <div className="space-y-4">
                        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                                <FiUser className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Nombre Completo</p>
                                <p className="font-medium">{user?.first_name} {user?.last_name}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                                <FiMail className="w-5 h-5 text-green-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Correo Electrónico</p>
                                <p className="font-medium">{user?.email}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                                <FiPhone className="w-5 h-5 text-purple-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Teléfono</p>
                                <p className="font-medium">{user?.phone || 'No registrado'}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                                <FiShield className="w-5 h-5 text-orange-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Identificación</p>
                                <p className="font-medium">{user?.identification_type}: {user?.identification_number}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Cuentas y Tarjetas */}
            {activeTab === 'accounts' && (
                <div className="space-y-6">
                    {/* Cuentas */}
                    <div className="card">
                        <h3 className="text-lg font-semibold mb-4">Mis Cuentas</h3>
                        <div className="space-y-3">
                            {accounts.map((account) => (
                                <div key={account.id} className="p-4 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl text-white">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <p className="text-blue-100 text-sm">{account.account_type}</p>
                                            <p className="font-mono">{account.account_number}</p>
                                        </div>
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                                            account.status === 'ACTIVA' ? 'bg-green-400 text-green-900' : 'bg-gray-400'
                                        }`}>
                                            {account.status}
                                        </span>
                                    </div>
                                    <div>
                                        <p className="text-blue-100 text-sm">Saldo Disponible</p>
                                        <p className="text-2xl font-bold">{formatCurrency(account.available_balance)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Tarjetas */}
                    <div className="card">
                        <h3 className="text-lg font-semibold mb-4">Tarjetas Vinculadas</h3>
                        {cards.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                <FiCreditCard className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                <p>No tienes tarjetas vinculadas</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {cards.map((card) => (
                                    <div key={card.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-8 bg-gradient-to-r from-gray-700 to-gray-900 rounded flex items-center justify-center">
                                                <span className="text-white text-xs font-bold">{getCardBrand(card.card_number)}</span>
                                            </div>
                                            <div>
                                                <p className="font-mono">{maskCardNumber(card.card_number)}</p>
                                                <p className="text-xs text-gray-500">Vence: {card.expiry_date}</p>
                                            </div>
                                        </div>
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                                            card.status === 'ACTIVA' ? 'bg-green-100 text-green-700' : 'bg-gray-100'
                                        }`}>
                                            {card.status}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Identificadores de Pago */}
            {activeTab === 'identifiers' && (
                <div className="space-y-6">
                    {/* Agregar nuevo */}
                    <div className="card">
                        <h3 className="text-lg font-semibold mb-4">Agregar Identificador</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo</label>
                                <select
                                    value={newPaymentId.type}
                                    onChange={(e) => setNewPaymentId({ ...newPaymentId, type: e.target.value })}
                                    className="input-field"
                                >
                                    <option value="TELEFONO">Teléfono</option>
                                    <option value="EMAIL">Email</option>
                                    <option value="CEDULA">Cédula</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Identificador</label>
                                <input
                                    type="text"
                                    value={newPaymentId.identifier}
                                    onChange={(e) => setNewPaymentId({ ...newPaymentId, identifier: e.target.value })}
                                    className="input-field"
                                    placeholder={newPaymentId.type === 'TELEFONO' ? '0991234567' : newPaymentId.type === 'EMAIL' ? 'correo@email.com' : '1234567890'}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Alias (opcional)</label>
                                <input
                                    type="text"
                                    value={newPaymentId.alias}
                                    onChange={(e) => setNewPaymentId({ ...newPaymentId, alias: e.target.value })}
                                    className="input-field"
                                    placeholder="Mi teléfono"
                                />
                            </div>
                        </div>
                        <button 
                            onClick={handleAddPaymentId} 
                            className="btn-primary mt-4"
                            disabled={loading}
                        >
                            <FiPlus className="w-4 h-4 mr-2" />
                            {loading ? 'Agregando...' : 'Agregar'}
                        </button>
                    </div>

                    {/* Lista de identificadores */}
                    <div className="card">
                        <h3 className="text-lg font-semibold mb-4">Mis Identificadores</h3>
                        {paymentIds.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                <FiPhone className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                <p>No tienes identificadores registrados</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {paymentIds.map((pid) => (
                                    <div key={pid.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                                pid.identifier_type === 'TELEFONO' ? 'bg-green-100' :
                                                pid.identifier_type === 'EMAIL' ? 'bg-blue-100' : 'bg-purple-100'
                                            }`}>
                                                {pid.identifier_type === 'TELEFONO' && <FiPhone className="w-5 h-5 text-green-600" />}
                                                {pid.identifier_type === 'EMAIL' && <FiMail className="w-5 h-5 text-blue-600" />}
                                                {pid.identifier_type === 'CEDULA' && <FiUser className="w-5 h-5 text-purple-600" />}
                                            </div>
                                            <div>
                                                <p className="font-medium">{pid.identifier_value}</p>
                                                <p className="text-sm text-gray-500">{pid.alias || pid.identifier_type}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {pid.is_primary && (
                                                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                                                    Principal
                                                </span>
                                            )}
                                            <button 
                                                onClick={() => handleDeletePaymentId(pid.id)}
                                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                <FiTrash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Notificaciones */}
            {activeTab === 'notifications' && (
                <div className="card">
                    <h3 className="text-lg font-semibold mb-4">Notificaciones</h3>
                    {notifications.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <FiBell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                            <p>No tienes notificaciones</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {notifications.map((notification) => (
                                <div 
                                    key={notification.id} 
                                    className={`p-4 rounded-xl border-l-4 ${
                                        notification.is_read 
                                            ? 'bg-gray-50 border-gray-300' 
                                            : 'bg-blue-50 border-blue-500'
                                    }`}
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-medium text-gray-900">{notification.title}</p>
                                            <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                                            <p className="text-xs text-gray-400 mt-2">
                                                {new Date(notification.created_at).toLocaleString('es-EC')}
                                            </p>
                                        </div>
                                        {!notification.is_read && (
                                            <button 
                                                onClick={() => handleMarkNotificationRead(notification.id)}
                                                className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                                                title="Marcar como leída"
                                            >
                                                <FiCheck className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Profile;
