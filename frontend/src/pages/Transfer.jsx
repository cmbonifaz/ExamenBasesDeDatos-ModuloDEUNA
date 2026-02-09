import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { transferService } from '../services/api';
import toast from 'react-hot-toast';
import { FiSend, FiSearch, FiUser, FiDollarSign, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';

const Transfer = () => {
    const { accounts, refreshAccounts } = useAuth();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [searchingRecipient, setSearchingRecipient] = useState(false);
    const [recipient, setRecipient] = useState(null);
    const [commission, setCommission] = useState({ commission: 0, total: 0 });
    const [result, setResult] = useState(null);
    
    const [formData, setFormData] = useState({
        source_account_id: '',
        destination_identifier: '',
        amount: '',
        description: ''
    });

    useEffect(() => {
        if (accounts.length > 0 && !formData.source_account_id) {
            setFormData(prev => ({ ...prev, source_account_id: accounts[0].id }));
        }
    }, [accounts]);

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('es-EC', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    };

    const handleSearchRecipient = async () => {
        if (!formData.destination_identifier) {
            toast.error('Ingresa el número de cuenta, alias, teléfono o email');
            return;
        }

        setSearchingRecipient(true);
        try {
            const response = await transferService.searchRecipient(formData.destination_identifier);
            if (response.data.success) {
                setRecipient(response.data.data);
                toast.success('Destinatario encontrado');
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Destinatario no encontrado');
            setRecipient(null);
        } finally {
            setSearchingRecipient(false);
        }
    };

    const handleCalculateCommission = async () => {
        if (!formData.amount || parseFloat(formData.amount) <= 0) return;

        try {
            const response = await transferService.calculateCommission(formData.amount);
            if (response.data.success) {
                setCommission(response.data.data);
            }
        } catch (error) {
            console.error('Error calculando comisión:', error);
        }
    };

    useEffect(() => {
        if (formData.amount) {
            const debounce = setTimeout(() => {
                handleCalculateCommission();
            }, 500);
            return () => clearTimeout(debounce);
        }
    }, [formData.amount]);

    const validateStep1 = () => {
        if (!formData.source_account_id) {
            toast.error('Selecciona una cuenta origen');
            return false;
        }
        if (!recipient) {
            toast.error('Busca y verifica el destinatario');
            return false;
        }
        return true;
    };

    const validateStep2 = () => {
        if (!formData.amount || parseFloat(formData.amount) <= 0) {
            toast.error('Ingresa un monto válido');
            return false;
        }
        
        const sourceAccount = accounts.find(a => a.id === parseInt(formData.source_account_id));
        const total = parseFloat(formData.amount) + commission.commission;
        
        if (total > sourceAccount.available_balance) {
            toast.error('Saldo insuficiente');
            return false;
        }
        return true;
    };

    const handleNext = () => {
        if (step === 1 && validateStep1()) {
            setStep(2);
        } else if (step === 2 && validateStep2()) {
            setStep(3);
        }
    };

    const handleBack = () => {
        if (step > 1) setStep(step - 1);
    };

    const handleTransfer = async () => {
        setLoading(true);
        try {
            const response = await transferService.transfer({
                source_account_id: parseInt(formData.source_account_id),
                destination_identifier: formData.destination_identifier,
                amount: parseFloat(formData.amount),
                description: formData.description || 'Transferencia DEUNA'
            });

            if (response.data.success) {
                setResult(response.data.data);
                setStep(4);
                await refreshAccounts();
                toast.success('¡Transferencia exitosa!');
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error al realizar la transferencia');
        } finally {
            setLoading(false);
        }
    };

    const handleNewTransfer = () => {
        setStep(1);
        setRecipient(null);
        setResult(null);
        setFormData({
            source_account_id: accounts[0]?.id || '',
            destination_identifier: '',
            amount: '',
            description: ''
        });
    };

    const selectedAccount = accounts.find(a => a.id === parseInt(formData.source_account_id));

    return (
        <div className="max-w-xl mx-auto animate-fade-in">
            {/* Header */}
            <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mx-auto mb-4">
                    <FiSend className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">Transferir Dinero</h1>
                <p className="text-gray-500 mt-1">Envía dinero de forma inmediata</p>
            </div>

            {/* Progress */}
            {step < 4 && (
                <div className="flex items-center justify-center gap-2 mb-8">
                    {[1, 2, 3].map((s) => (
                        <div key={s} className="flex items-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                                step >= s 
                                    ? 'bg-deuna-primary text-white' 
                                    : 'bg-gray-200 text-gray-500'
                            }`}>
                                {s}
                            </div>
                            {s < 3 && (
                                <div className={`w-12 h-1 ${step > s ? 'bg-deuna-primary' : 'bg-gray-200'}`} />
                            )}
                        </div>
                    ))}
                </div>
            )}

            <div className="card">
                {/* Step 1: Destinatario */}
                {step === 1 && (
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Cuenta Origen
                            </label>
                            <select
                                value={formData.source_account_id}
                                onChange={(e) => setFormData({ ...formData, source_account_id: e.target.value })}
                                className="input-field"
                            >
                                {accounts.map((account) => (
                                    <option key={account.id} value={account.id}>
                                        {account.account_number} - {account.account_type} ({formatCurrency(account.available_balance)})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Destinatario
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={formData.destination_identifier}
                                    onChange={(e) => {
                                        setFormData({ ...formData, destination_identifier: e.target.value });
                                        setRecipient(null);
                                    }}
                                    className="input-field pr-12"
                                    placeholder="N° cuenta, alias, teléfono o email"
                                />
                                <button
                                    onClick={handleSearchRecipient}
                                    disabled={searchingRecipient}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-deuna-primary text-white rounded-lg hover:bg-deuna-secondary transition-colors"
                                >
                                    {searchingRecipient ? (
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <FiSearch className="w-5 h-5" />
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Recipient Found */}
                        {recipient && (
                            <div className="bg-green-50 border border-green-200 rounded-xl p-4 animate-slide-in">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                                        <FiUser className="w-6 h-6 text-green-600" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-semibold text-gray-900">{recipient.name}</p>
                                        <p className="text-sm text-gray-500">
                                            {recipient.account_number} - {recipient.bank}
                                        </p>
                                    </div>
                                    <FiCheckCircle className="w-6 h-6 text-green-500" />
                                </div>
                            </div>
                        )}

                        <button
                            onClick={handleNext}
                            className="btn-primary w-full"
                        >
                            Continuar
                        </button>
                    </div>
                )}

                {/* Step 2: Monto */}
                {step === 2 && (
                    <div className="space-y-6">
                        <div className="text-center py-4">
                            <p className="text-sm text-gray-500 mb-1">Enviar a:</p>
                            <p className="font-semibold text-lg">{recipient?.name}</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Monto a Transferir
                            </label>
                            <div className="relative">
                                <FiDollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                    type="number"
                                    value={formData.amount}
                                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                    className="input-field pl-12 text-2xl font-bold text-center"
                                    placeholder="0.00"
                                    step="0.01"
                                    min="0"
                                />
                            </div>
                            <p className="text-sm text-gray-500 mt-2 text-center">
                                Disponible: {formatCurrency(selectedAccount?.available_balance || 0)}
                            </p>
                        </div>

                        {commission.commission > 0 && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                                <div className="flex items-center gap-2 text-yellow-700">
                                    <FiAlertCircle className="w-5 h-5" />
                                    <p className="text-sm">
                                        Comisión: {formatCurrency(commission.commission)}
                                    </p>
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Descripción (opcional)
                            </label>
                            <input
                                type="text"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="input-field"
                                placeholder="Ej: Pago de servicios"
                                maxLength={100}
                            />
                        </div>

                        <div className="flex gap-4">
                            <button onClick={handleBack} className="btn-secondary flex-1">
                                Atrás
                            </button>
                            <button onClick={handleNext} className="btn-primary flex-1">
                                Continuar
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 3: Confirmación */}
                {step === 3 && (
                    <div className="space-y-6">
                        <h3 className="text-lg font-semibold text-center">Confirma tu Transferencia</h3>

                        <div className="bg-gray-50 rounded-xl p-4 space-y-4">
                            <div className="flex justify-between">
                                <span className="text-gray-500">De:</span>
                                <span className="font-medium">{selectedAccount?.account_number}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Para:</span>
                                <span className="font-medium">{recipient?.name}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Monto:</span>
                                <span className="font-medium">{formatCurrency(formData.amount)}</span>
                            </div>
                            {commission.commission > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Comisión:</span>
                                    <span className="font-medium">{formatCurrency(commission.commission)}</span>
                                </div>
                            )}
                            <div className="border-t pt-4 flex justify-between">
                                <span className="text-gray-700 font-semibold">Total:</span>
                                <span className="font-bold text-lg text-deuna-primary">
                                    {formatCurrency(parseFloat(formData.amount) + commission.commission)}
                                </span>
                            </div>
                            {formData.description && (
                                <div className="pt-2">
                                    <span className="text-gray-500 text-sm">Descripción:</span>
                                    <p className="font-medium">{formData.description}</p>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-4">
                            <button onClick={handleBack} className="btn-secondary flex-1" disabled={loading}>
                                Atrás
                            </button>
                            <button 
                                onClick={handleTransfer} 
                                className="btn-primary flex-1 flex items-center justify-center gap-2"
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <div className="spinner" />
                                        <span>Procesando...</span>
                                    </>
                                ) : (
                                    <>
                                        <FiSend className="w-5 h-5" />
                                        <span>Transferir</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 4: Éxito */}
                {step === 4 && result && (
                    <div className="text-center space-y-6 py-4">
                        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                            <FiCheckCircle className="w-10 h-10 text-green-500" />
                        </div>
                        
                        <div>
                            <h3 className="text-2xl font-bold text-gray-900">¡Transferencia Exitosa!</h3>
                            <p className="text-gray-500 mt-2">
                                Has enviado {formatCurrency(result.transaction.amount)} a {result.transaction.destination}
                            </p>
                        </div>

                        <div className="bg-gray-50 rounded-xl p-4 text-left space-y-3">
                            <div className="flex justify-between">
                                <span className="text-gray-500">Referencia:</span>
                                <span className="font-mono text-sm">{result.transaction.reference}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Nuevo saldo:</span>
                                <span className="font-semibold">{formatCurrency(result.source_account.new_balance)}</span>
                            </div>
                        </div>

                        <button onClick={handleNewTransfer} className="btn-primary w-full">
                            Nueva Transferencia
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Transfer;
