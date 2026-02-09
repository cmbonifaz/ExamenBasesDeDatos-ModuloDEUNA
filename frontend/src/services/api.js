import axios from 'axios';

const API_URL = 'http://localhost:3001/api';

// Crear instancia de axios
const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Interceptor para agregar token a las peticiones
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Interceptor para manejar errores de respuesta
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Token expirado o inválido
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

// Servicios de Autenticación
export const authService = {
    login: (email, password) => api.post('/auth/login', { email, password }),
    register: (userData) => api.post('/auth/register', userData),
    logout: () => api.post('/user/logout'),
    getProfile: () => api.get('/user/profile'),
    updateProfile: (data) => api.put('/user/profile', data),
    changePassword: (data) => api.put('/user/change-password', data),
};

// Servicios de Cuentas
export const accountService = {
    getAccounts: () => api.get('/user/accounts'),
    getAccountDetail: (id) => api.get(`/user/accounts/${id}`),
    getAccountTransactions: (id, limit = 20) => api.get(`/user/accounts/${id}/transactions?limit=${limit}`),
    getTotalBalance: () => api.get('/user/accounts/total-balance'),
    addPaymentIdentifier: (data) => api.post('/user/payment-identifiers', data),
};

// Servicios de Transferencias
export const transferService = {
    transfer: (data) => api.post('/transfers', data),
    searchRecipient: (identifier) => api.get(`/transfers/search-recipient?identifier=${identifier}`),
    getHistory: (params = {}) => api.get('/transfers/history', { params }),
    getDetail: (id) => api.get(`/transfers/${id}`),
    calculateCommission: (amount, isInterbank = false) => 
        api.get(`/transfers/calculate/commission?amount=${amount}&is_interbank=${isInterbank}`),
};

// Servicios de Recargas
export const rechargeService = {
    getProviders: () => api.get('/recharges/providers'),
    recharge: (data) => api.post('/recharges', data),
    getHistory: (params = {}) => api.get('/recharges/history', { params }),
    getSuggestedAmounts: (methodId) => api.get(`/recharges/suggested-amounts?provider_id=${methodId}`),
    calculateCommission: (methodId, amount) => 
        api.get(`/recharges/calculate-commission?method_id=${methodId}&amount=${amount}`),
};

// Servicios de QR
export const qrService = {
    generateQR: (data) => api.post('/qr/generate', data),
    getInfo: (uuid) => api.get(`/qr/info/${uuid}`),
    validateQR: (code) => api.get(`/qr/info/${code}`),
    payQR: (data) => api.post('/qr/pay', data),
    getMyQRs: (status) => api.get('/qr/my-codes', { params: { status } }),
    getMyCodes: (status) => api.get('/qr/my-codes', { params: { status } }),
    cancel: (id) => api.delete(`/qr/${id}`),
};

// Servicios de Notificaciones
export const notificationService = {
    getAll: (unreadOnly = false) => api.get(`/notifications?unread_only=${unreadOnly}`),
    getUnreadCount: () => api.get('/notifications/unread-count'),
    markAsRead: (id) => api.put(`/notifications/${id}/read`),
    markAllAsRead: () => api.put('/notifications/mark-all-read'),
    delete: (id) => api.delete(`/notifications/${id}`),
};

export default api;
