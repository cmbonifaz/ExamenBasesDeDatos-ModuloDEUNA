import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { rechargeService } from '../services/api';
import toast from 'react-hot-toast';
import { FiDollarSign, FiCheckCircle, FiCreditCard, FiPercent, FiArrowRight } from 'react-icons/fi';

const Recharge = () => {
    const { accounts, refreshAccounts } = useAuth();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [methods, setMethods] = useState([]);
    const [suggestedAmounts, setSuggestedAmounts] = useState([]);
    const [result, setResult] = useState(null);

    const [formData, setFormData] = useState({
        destination_account_id: '',
        method_id: '',
        amount: '',
        card_number: '',
        external_reference: ''
    });

    useEffect(() => {
        loadMethods();
        if (accounts.length > 0) {
            setFormData(prev => ({ ...prev, destination_account_id: accounts[0].id }));
        }
    }, [accounts]);

    const loadMethods = async () => {
        try {
            const response = await rechargeService.getProviders();
            if (response.data.success) {
                setMethods(response.data.data);
            }
        } catch (error) {
            console.error('Error cargando metodos:', error);
        }
    };

    const loadSuggestedAmounts = async (methodId) => {
        try {
            const response = await rechargeService.getSuggestedAmounts(methodId);
            if (response.data.success) {
                setSuggestedAmounts(response.data.data.suggested_amounts);
            }
        } catch (error) {
            console.error('Error cargando montos:', error);
        }
    };

    const handleMethodSelect = (methodId) => {
        setFormData({ ...formData, method_id: methodId, amount: '', card_number: '', external_reference: '' });
        loadSuggestedAmounts(methodId);
        setStep(2);
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('es-EC', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    };

    const getMethodIcon = (methodId) => {
        if (methodId.includes('TARJETA')) return FiCreditCard;
        return FiDollarSign;
    };

    const selectedMethod = methods.find(m => m.id === formData.method_id);
    const selectedAccount = accounts.find(a => a.id === parseInt(formData.destination_account_id));
    
    // Calcular comision
    const rechargeAmount = parseFloat(formData.amount) || 0;
    const commissionPercent = selectedMethod?.commission_percent || 0;
    const commission = (rechargeAmount * commissionPercent) / 100;
    const netAmount = rechargeAmount - commission;

    const validateStep2 = () => {
        if (!formData.amount || parseFloat(formData.amount) <= 0) {
            toast.error('Ingresa un monto valido');
            return false;
        }

        if (selectedMethod) {
            if (rechargeAmount < selectedMethod.min_amount) {
                toast.error(`El monto minimo es ${formatCurrency(selectedMethod.min_amount)}`);
                return false;
            }
            if (rechargeAmount > selectedMethod.max_amount) {
                toast.error(`El monto maximo es ${formatCurrency(selectedMethod.max_amount)}`);
                return false;
            }
        }

        // Validar datos adicionales segun metodo
        if (formData.method_id.includes('TARJETA') && !formData.card_number) {
            toast.error('Ingresa el numero de tarjeta');
            return false;
        }

        return true;
    };

    const handleNext = () => {
        if (step === 2 && validateStep2()) {
            setStep(3);
        }
    };

    const handleRecharge = async () => {
        setLoading(true);
        try {
            const response = await rechargeService.recharge({
                destination_account_id: parseInt(formData.destination_account_id),
                method_id: formData.method_id,
                amount: parseFloat(formData.amount),
                card_number: formData.card_number || undefined,
                external_reference: formData.external_reference || undefined
            });

            if (response.data.success) {
                setResult(response.data.data);
                setStep(4);
                await refreshAccounts();
                toast.success('Recarga exitosa!');
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error al realizar la recarga');
        } finally {
            setLoading(false);
        }
    };

    const handleNewRecharge = () => {
        setStep(1);
        setResult(null);
        setFormData({
            destination_account_id: accounts[0]?.id || '',
            method_id: '',
            amount: '',
            card_number: '',
            external_reference: ''
        });
        setSuggestedAmounts([]);
    };

    const MethodIcon = formData.method_id ? getMethodIcon(formData.method_id) : FiDollarSign;

    return (
        <div className="max-w-xl mx-auto animate-fade-in">
            {/* Header */}
            <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center mx-auto mb-4">
                    <FiDollarSign className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">Recargar Cuenta</h1>
                <p className="text-gray-500 mt-1">Agrega saldo a tu cuenta DEUNA</p>
            </div>

            {/* Progress */}
            {step < 4 && (
                <div className="flex items-center justify-center gap-2 mb-8">
                    {[1, 2, 3].map((s) => (
                        <div key={s} className="flex items-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                                step >= s 
                                    ? 'bg-green-500 text-white' 
                                    : 'bg-gray-200 text-gray-500'
                            }`}>
                                {s}
                            </div>
                            {s < 3 && (
                                <div className={`w-12 h-1 ${step > s ? 'bg-green-500' : 'bg-gray-200'}`} />
                            )}
                        </div>
                    ))}
                </div>
            )}

            <div className="card">
                {/* Step 1: Seleccionar metodo */}
                {step === 1 && (
                    <div className="space-y-6">
                        <h3 className="text-lg font-semibold">Selecciona el metodo de recarga</h3>

                        <div className="space-y-3">
                            {methods.map((method) => {
                                const Icon = getMethodIcon(method.id);
                                return (
                                    <button
                                        key={method.id}
                                        onClick={() => handleMethodSelect(method.id)}
                                        className="w-full p-4 border-2 border-gray-200 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all text-left flex items-center gap-4"
                                    >
                                        <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                                            <Icon className="w-6 h-6 text-green-600" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-semibold text-gray-900">{method.name}</p>
                                            <p className="text-sm text-gray-500">{method.description}</p>
                                            <p className="text-xs text-gray-400 mt-1">
                                                Min: {formatCurrency(method.min_amount)} - Max: {formatCurrency(method.max_amount)}
                                            </p>
                                        </div>
                                        {method.commission_percent > 0 && (
                                            <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">
                                                {method.commission_percent}% comision
                                            </span>
                                        )}
                                        <FiArrowRight className="w-5 h-5 text-gray-400" />
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Step 2: Datos de recarga */}
                {step === 2 && (
                    <div className="space-y-6">
                        <div className="flex items-center gap-3 pb-4 border-b">
                            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                                <MethodIcon className="w-6 h-6 text-green-600" />
                            </div>
                            <div>
                                <p className="font-semibold">{selectedMethod?.name}</p>
                                <p className="text-sm text-gray-500">
                                    {selectedMethod?.commission_percent > 0 
                                        ? `Comision: ${selectedMethod.commission_percent}%`
                                        : 'Sin comision'}
                                </p>
                            </div>
                        </div>

                        {/* Cuenta destino */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Cuenta a recargar
                            </label>
                            <select
                                value={formData.destination_account_id}
                                onChange={(e) => setFormData({ ...formData, destination_account_id: e.target.value })}
                                className="input-field"
                            >
                                {accounts.map((account) => (
                                    <option key={account.id} value={account.id}>
                                        {account.account_number} - {account.account_type} ({formatCurrency(account.available_balance)})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Numero de tarjeta si aplica */}
                        {formData.method_id.includes('TARJETA') && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Numero de Tarjeta
                                </label>
                                <input
                                    type="text"
                                    value={formData.card_number}
                                    onChange={(e) => setFormData({ ...formData, card_number: e.target.value.replace(/\D/g, '').slice(0, 16) })}
                                    className="input-field font-mono"
                                    placeholder="1234 5678 9012 3456"
                                    maxLength={16}
                                />
                            </div>
                        )}

                        {/* Referencia externa si es transferencia */}
                        {formData.method_id === 'TRANSFERENCIA_EXTERNA' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Referencia de transferencia (opcional)
                                </label>
                                <input
                                    type="text"
                                    value={formData.external_reference}
                                    onChange={(e) => setFormData({ ...formData, external_reference: e.target.value })}
                                    className="input-field"
                                    placeholder="Numero de referencia del otro banco"
                                />
                            </div>
                        )}

                        {/* Monto */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Monto a recargar
                            </label>
                            
                            {/* Montos sugeridos */}
                            {suggestedAmounts.length > 0 && (
                                <div className="grid grid-cols-3 gap-2 mb-3">
                                    {suggestedAmounts.map((amount) => (
                                        <button
                                            key={amount}
                                            onClick={() => setFormData({ ...formData, amount: amount.toString() })}
                                            className={`py-2 px-3 rounded-lg border-2 font-medium transition-all ${
                                                formData.amount === amount.toString()
                                                    ? 'border-green-500 bg-green-50 text-green-700'
                                                    : 'border-gray-200 hover:border-green-300'
                                            }`}
                                        >
                                            {formatCurrency(amount)}
                                        </button>
                                    ))}
                                </div>
                            )}

                            <div className="relative">
                                <FiDollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                    type="number"
                                    value={formData.amount}
                                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                    className="input-field pl-12"
                                    placeholder="Otro monto"
                                    min={selectedMethod?.min_amount}
                                    max={selectedMethod?.max_amount}
                                    step="0.01"
                                />
                            </div>

                            {/* Mostrar comision si aplica */}
                            {rechargeAmount > 0 && commissionPercent > 0 && (
                                <div className="mt-3 p-3 bg-yellow-50 rounded-lg">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Monto ingresado:</span>
                                        <span>{formatCurrency(rechargeAmount)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm text-yellow-700">
                                        <span>Comision ({commissionPercent}%):</span>
                                        <span>-{formatCurrency(commission)}</span>
                                    </div>
                                    <div className="flex justify-between font-semibold text-green-700 border-t border-yellow-200 pt-2 mt-2">
                                        <span>Se acreditara:</span>
                                        <span>{formatCurrency(netAmount)}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-4">
                            <button onClick={() => setStep(1)} className="btn-secondary flex-1">
                                Atras
                            </button>
                            <button onClick={handleNext} className="btn-primary flex-1">
                                Continuar
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 3: Confirmacion */}
                {step === 3 && (
                    <div className="space-y-6">
                        <h3 className="text-lg font-semibold text-center">Confirma tu Recarga</h3>

                        <div className="bg-gray-50 rounded-xl p-4 space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-500">Metodo:</span>
                                <span className="font-medium">{selectedMethod?.name}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Cuenta destino:</span>
                                <span className="font-medium">{selectedAccount?.account_number}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Monto:</span>
                                <span className="font-medium">{formatCurrency(rechargeAmount)}</span>
                            </div>
                            {commission > 0 && (
                                <div className="flex justify-between text-yellow-700">
                                    <span>Comision ({commissionPercent}%):</span>
                                    <span>-{formatCurrency(commission)}</span>
                                </div>
                            )}
                            <div className="border-t pt-4 flex justify-between">
                                <span className="text-gray-700 font-semibold">Se acreditara:</span>
                                <span className="font-bold text-lg text-green-600">
                                    {formatCurrency(netAmount)}
                                </span>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button onClick={() => setStep(2)} className="btn-secondary flex-1" disabled={loading}>
                                Atras
                            </button>
                            <button 
                                onClick={handleRecharge} 
                                className="btn-primary flex-1 flex items-center justify-center gap-2"
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <div className="spinner" />
                                        <span>Procesando...</span>
                                    </>
                                ) : (
                                    'Confirmar Recarga'
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 4: Exito */}
                {step === 4 && result && (
                    <div className="text-center space-y-6 py-4">
                        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                            <FiCheckCircle className="w-10 h-10 text-green-500" />
                        </div>
                        
                        <div>
                            <h3 className="text-2xl font-bold text-gray-900">Recarga Exitosa!</h3>
                            <p className="text-gray-500 mt-2">
                                {result.transaction.description}
                            </p>
                        </div>

                        <div className="bg-gray-50 rounded-xl p-4 text-left space-y-3">
                            <div className="flex justify-between">
                                <span className="text-gray-500">Monto acreditado:</span>
                                <span className="font-semibold text-green-600">{formatCurrency(result.transaction.net_amount)}</span>
                            </div>
                            {result.transaction.commission > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Comision:</span>
                                    <span className="text-yellow-600">{formatCurrency(result.transaction.commission)}</span>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span className="text-gray-500">Referencia:</span>
                                <span className="font-mono text-sm">{result.transaction.reference}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Nuevo saldo:</span>
                                <span className="font-semibold">{formatCurrency(result.destination_account.new_available_balance)}</span>
                            </div>
                        </div>

                        <button onClick={handleNewRecharge} className="btn-primary w-full">
                            Nueva Recarga
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Recharge;
