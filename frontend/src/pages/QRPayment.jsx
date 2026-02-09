import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { qrService } from '../services/api';
import toast from 'react-hot-toast';
import { FiGrid, FiCamera, FiDollarSign, FiCheckCircle, FiClock, FiCopy, FiRefreshCw } from 'react-icons/fi';

const QRPayment = () => {
    const { accounts, refreshAccounts } = useAuth();
    const [activeTab, setActiveTab] = useState('generate');
    const [loading, setLoading] = useState(false);
    const [myQRs, setMyQRs] = useState([]);
    
    // Generar QR
    const [generateData, setGenerateData] = useState({
        account_id: '',
        amount: '',
        description: ''
    });
    const [generatedQR, setGeneratedQR] = useState(null);

    // Pagar QR
    const [payStep, setPayStep] = useState(1);
    const [qrCode, setQrCode] = useState('');
    const [qrInfo, setQrInfo] = useState(null);
    const [payData, setPayData] = useState({
        source_account_id: ''
    });
    const [payResult, setPayResult] = useState(null);

    useEffect(() => {
        if (accounts.length > 0) {
            setGenerateData(prev => ({ ...prev, account_id: accounts[0].id }));
            setPayData({ source_account_id: accounts[0].id });
        }
        loadMyQRs();
    }, [accounts]);

    const loadMyQRs = async () => {
        try {
            const response = await qrService.getMyQRs();
            if (response.data.success) {
                setMyQRs(response.data.data.slice(0, 5)); // últimos 5
            }
        } catch (error) {
            console.error('Error cargando QRs:', error);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('es-EC', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    };

    const handleGenerateQR = async () => {
        if (!generateData.amount || parseFloat(generateData.amount) <= 0) {
            toast.error('Ingresa un monto válido');
            return;
        }

        setLoading(true);
        try {
            const response = await qrService.generateQR({
                account_id: parseInt(generateData.account_id),
                amount: parseFloat(generateData.amount),
                description: generateData.description || `Pago QR por ${formatCurrency(generateData.amount)}`
            });

            if (response.data.success) {
                setGeneratedQR(response.data.data);
                loadMyQRs();
                toast.success('QR generado exitosamente');
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error al generar QR');
        } finally {
            setLoading(false);
        }
    };

    const handleValidateQR = async () => {
        if (!qrCode.trim()) {
            toast.error('Ingresa o escanea un código QR');
            return;
        }

        setLoading(true);
        try {
            const response = await qrService.validateQR(qrCode.trim());
            if (response.data.success) {
                setQrInfo(response.data.data);
                setPayStep(2);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Código QR inválido o expirado');
        } finally {
            setLoading(false);
        }
    };

    const handlePayQR = async () => {
        setLoading(true);
        try {
            const response = await qrService.payQR({
                qr_code: qrCode.trim(),
                source_account_id: parseInt(payData.source_account_id)
            });

            if (response.data.success) {
                setPayResult(response.data.data);
                setPayStep(3);
                await refreshAccounts();
                toast.success('¡Pago QR exitoso!');
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error al procesar el pago');
        } finally {
            setLoading(false);
        }
    };

    const handleCopyCode = (code) => {
        navigator.clipboard.writeText(code);
        toast.success('Código copiado');
    };

    const resetPayFlow = () => {
        setPayStep(1);
        setQrCode('');
        setQrInfo(null);
        setPayResult(null);
    };

    const resetGenerateFlow = () => {
        setGeneratedQR(null);
        setGenerateData({
            account_id: accounts[0]?.id || '',
            amount: '',
            description: ''
        });
    };

    const selectedPayAccount = accounts.find(a => a.id === parseInt(payData.source_account_id));

    return (
        <div className="max-w-xl mx-auto animate-fade-in">
            {/* Header */}
            <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
                    <FiGrid className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">Pagos QR</h1>
                <p className="text-gray-500 mt-1">Genera o paga con código QR</p>
            </div>

            {/* Tabs */}
            <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
                <button
                    onClick={() => { setActiveTab('generate'); resetPayFlow(); }}
                    className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                        activeTab === 'generate'
                            ? 'bg-white text-purple-600 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    <FiGrid className="w-4 h-4" />
                    Generar QR
                </button>
                <button
                    onClick={() => { setActiveTab('pay'); resetGenerateFlow(); }}
                    className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                        activeTab === 'pay'
                            ? 'bg-white text-purple-600 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    <FiCamera className="w-4 h-4" />
                    Pagar QR
                </button>
            </div>

            {/* Generar QR */}
            {activeTab === 'generate' && (
                <div className="card">
                    {!generatedQR ? (
                        <div className="space-y-5">
                            <h3 className="text-lg font-semibold">Genera tu código QR</h3>
                            
                            {/* Cuenta destino */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Recibir en cuenta
                                </label>
                                <select
                                    value={generateData.account_id}
                                    onChange={(e) => setGenerateData({ ...generateData, account_id: e.target.value })}
                                    className="input-field"
                                >
                                    {accounts.map((account) => (
                                        <option key={account.id} value={account.id}>
                                            {account.account_number} - {account.account_type}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Monto */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Monto a recibir
                                </label>
                                <div className="relative">
                                    <FiDollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                    <input
                                        type="number"
                                        value={generateData.amount}
                                        onChange={(e) => setGenerateData({ ...generateData, amount: e.target.value })}
                                        className="input-field pl-12"
                                        placeholder="0.00"
                                        min="1"
                                        step="0.01"
                                    />
                                </div>
                            </div>

                            {/* Descripción */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Descripción (opcional)
                                </label>
                                <input
                                    type="text"
                                    value={generateData.description}
                                    onChange={(e) => setGenerateData({ ...generateData, description: e.target.value })}
                                    className="input-field"
                                    placeholder="Ej: Pago almuerzo"
                                    maxLength="100"
                                />
                            </div>

                            <button 
                                onClick={handleGenerateQR} 
                                className="btn-primary w-full"
                                disabled={loading}
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <div className="spinner" />
                                        Generando...
                                    </span>
                                ) : (
                                    'Generar Código QR'
                                )}
                            </button>
                        </div>
                    ) : (
                        <div className="text-center space-y-6 py-4">
                            <h3 className="text-lg font-semibold">Tu Código QR</h3>
                            
                            <div className="bg-white p-4 rounded-xl shadow-inner inline-block mx-auto">
                                {/* Mostrar imagen base64 del QR generado por el backend */}
                                <img 
                                    src={generatedQR.qr_code} 
                                    alt="Código QR"
                                    className="w-[200px] h-[200px]"
                                />
                            </div>

                            <div className="bg-purple-50 rounded-xl p-4 space-y-3 text-left">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Monto:</span>
                                    <span className="font-bold text-purple-600">{formatCurrency(generatedQR.amount)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-500">Código:</span>
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-sm">{generatedQR.uuid?.substring(0, 12) || 'N/A'}...</span>
                                        <button 
                                            onClick={() => handleCopyCode(generatedQR.uuid)}
                                            className="p-1 hover:bg-purple-100 rounded"
                                        >
                                            <FiCopy className="w-4 h-4 text-purple-600" />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-500">Expira:</span>
                                    <span className="text-sm flex items-center gap-1">
                                        <FiClock className="w-4 h-4" />
                                        {new Date(generatedQR.expiry_datetime).toLocaleString('es-EC')}
                                    </span>
                                </div>
                            </div>

                            <p className="text-sm text-gray-500">
                                Muestra este código para recibir el pago
                            </p>

                            <button onClick={resetGenerateFlow} className="btn-secondary w-full">
                                <FiRefreshCw className="w-4 h-4 mr-2" />
                                Generar Nuevo QR
                            </button>
                        </div>
                    )}

                    {/* Mis QRs recientes */}
                    {!generatedQR && myQRs.length > 0 && (
                        <div className="mt-8 pt-6 border-t">
                            <h4 className="font-semibold text-gray-700 mb-4">QRs Recientes</h4>
                            <div className="space-y-3">
                                {myQRs.map((qr) => (
                                    <div key={qr.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                        <div>
                                            <p className="font-medium">{formatCurrency(qr.amount)}</p>
                                            <p className="text-xs text-gray-500">{qr.description}</p>
                                        </div>
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                                            qr.status === 'ACTIVO' ? 'bg-green-100 text-green-700' :
                                            qr.status === 'PAGADO' ? 'bg-blue-100 text-blue-700' :
                                            'bg-gray-100 text-gray-700'
                                        }`}>
                                            {qr.status}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Pagar QR */}
            {activeTab === 'pay' && (
                <div className="card">
                    {/* Step 1: Ingresar código */}
                    {payStep === 1 && (
                        <div className="space-y-5">
                            <h3 className="text-lg font-semibold">Pagar con QR</h3>
                            
                            <div className="bg-gray-100 rounded-xl p-8 text-center">
                                <FiCamera className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                                <p className="text-gray-500 text-sm">Escanea el código QR o ingresa el código manualmente</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Código QR
                                </label>
                                <input
                                    type="text"
                                    value={qrCode}
                                    onChange={(e) => setQrCode(e.target.value)}
                                    className="input-field font-mono"
                                    placeholder="QR-XXXXXXXX-XXXXXXXX-XXXXXXXX"
                                />
                            </div>

                            <button 
                                onClick={handleValidateQR} 
                                className="btn-primary w-full"
                                disabled={loading || !qrCode.trim()}
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <div className="spinner" />
                                        Validando...
                                    </span>
                                ) : (
                                    'Validar y Continuar'
                                )}
                            </button>
                        </div>
                    )}

                    {/* Step 2: Confirmar pago */}
                    {payStep === 2 && qrInfo && (
                        <div className="space-y-5">
                            <h3 className="text-lg font-semibold text-center">Confirmar Pago</h3>

                            <div className="bg-purple-50 rounded-xl p-4 space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Beneficiario:</span>
                                    <span className="font-medium">{qrInfo.beneficiary_name}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Cuenta destino:</span>
                                    <span className="font-mono text-sm">{qrInfo.account_number}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Descripción:</span>
                                    <span>{qrInfo.description}</span>
                                </div>
                                <div className="border-t pt-3 flex justify-between">
                                    <span className="font-semibold">Monto a pagar:</span>
                                    <span className="font-bold text-xl text-purple-600">{formatCurrency(qrInfo.amount)}</span>
                                </div>
                            </div>

                            {/* Cuenta origen */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Pagar desde
                                </label>
                                <select
                                    value={payData.source_account_id}
                                    onChange={(e) => setPayData({ source_account_id: e.target.value })}
                                    className="input-field"
                                >
                                    {accounts.map((account) => (
                                        <option key={account.id} value={account.id}>
                                            {account.account_number} ({formatCurrency(account.available_balance)})
                                        </option>
                                    ))}
                                </select>
                                {selectedPayAccount && parseFloat(qrInfo.amount) > selectedPayAccount.available_balance && (
                                    <p className="text-red-500 text-sm mt-1">Saldo insuficiente</p>
                                )}
                            </div>

                            <div className="flex gap-4">
                                <button onClick={resetPayFlow} className="btn-secondary flex-1" disabled={loading}>
                                    Cancelar
                                </button>
                                <button 
                                    onClick={handlePayQR} 
                                    className="btn-primary flex-1"
                                    disabled={loading || parseFloat(qrInfo.amount) > selectedPayAccount?.available_balance}
                                >
                                    {loading ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <div className="spinner" />
                                            Procesando...
                                        </span>
                                    ) : (
                                        'Confirmar Pago'
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Éxito */}
                    {payStep === 3 && payResult && (
                        <div className="text-center space-y-6 py-4">
                            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                                <FiCheckCircle className="w-10 h-10 text-green-500" />
                            </div>
                            
                            <div>
                                <h3 className="text-2xl font-bold text-gray-900">¡Pago Exitoso!</h3>
                                <p className="text-gray-500 mt-2">
                                    Tu pago QR ha sido procesado correctamente
                                </p>
                            </div>

                            <div className="bg-gray-50 rounded-xl p-4 text-left space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Monto:</span>
                                    <span className="font-semibold text-green-600">{formatCurrency(payResult.transaction?.amount || qrInfo?.amount)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Referencia:</span>
                                    <span className="font-mono text-sm">{payResult.transaction?.reference}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Nuevo saldo:</span>
                                    <span className="font-semibold">{formatCurrency(payResult.source_account?.new_balance)}</span>
                                </div>
                            </div>

                            <button onClick={resetPayFlow} className="btn-primary w-full">
                                Realizar Otro Pago
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default QRPayment;
