import { createContext, useContext, useState, useEffect } from 'react';
import { authService, accountService } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    // Verificar token al cargar
    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const response = await authService.getProfile();
                if (response.data.success) {
                    setUser(response.data.data.client);
                    setAccounts(response.data.data.accounts || []);
                    setIsAuthenticated(true);
                }
            } catch (error) {
                console.error('Error verificando autenticación:', error);
                logout();
            }
        }
        setLoading(false);
    };

    const login = async (email, password) => {
        try {
            const response = await authService.login(email, password);
            if (response.data.success) {
                const { client, accounts, token } = response.data.data;
                localStorage.setItem('token', token);
                localStorage.setItem('user', JSON.stringify(client));
                setUser(client);
                setAccounts(accounts || []);
                setIsAuthenticated(true);
                return { success: true };
            }
            return { success: false, message: response.data.message };
        } catch (error) {
            return { 
                success: false, 
                message: error.response?.data?.message || 'Error al iniciar sesión' 
            };
        }
    };

    const register = async (userData) => {
        try {
            const response = await authService.register(userData);
            if (response.data.success) {
                const { client, account, token } = response.data.data;
                localStorage.setItem('token', token);
                localStorage.setItem('user', JSON.stringify(client));
                setUser(client);
                setAccounts([account]);
                setIsAuthenticated(true);
                return { success: true };
            }
            return { success: false, message: response.data.message };
        } catch (error) {
            return { 
                success: false, 
                message: error.response?.data?.message || 'Error al registrarse' 
            };
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        setAccounts([]);
        setIsAuthenticated(false);
    };

    const refreshAccounts = async () => {
        try {
            const response = await accountService.getAccounts();
            if (response.data.success) {
                setAccounts(response.data.data);
            }
        } catch (error) {
            console.error('Error actualizando cuentas:', error);
        }
    };

    const value = {
        user,
        accounts,
        loading,
        isAuthenticated,
        login,
        register,
        logout,
        refreshAccounts,
        checkAuth
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth debe usarse dentro de AuthProvider');
    }
    return context;
};
