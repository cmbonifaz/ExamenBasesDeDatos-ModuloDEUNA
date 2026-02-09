import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
    FiHome, FiSend, FiSmartphone, FiGrid, FiClock, 
    FiUser, FiLogOut, FiMenu, FiX, FiBell 
} from 'react-icons/fi';

const Layout = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const navItems = [
        { to: '/dashboard', icon: FiHome, label: 'Inicio' },
        { to: '/transfer', icon: FiSend, label: 'Transferir' },
        { to: '/recharge', icon: FiSmartphone, label: 'Recargas' },
        { to: '/qr', icon: FiGrid, label: 'Pagar con QR' },
        { to: '/history', icon: FiClock, label: 'Historial' },
        { to: '/profile', icon: FiUser, label: 'Mi Perfil' },
    ];

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Sidebar para móvil */}
            <div 
                className={`fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden transition-opacity ${
                    sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
                onClick={() => setSidebarOpen(false)}
            />

            {/* Sidebar */}
            <aside className={`fixed top-0 left-0 z-50 h-full w-64 bg-white shadow-xl transform transition-transform lg:translate-x-0 ${
                sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            }`}>
                {/* Logo */}
                <div className="h-16 flex items-center justify-between px-6 border-b">
                    <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-deuna-primary to-deuna-secondary flex items-center justify-center">
                            <span className="text-white font-bold text-lg">D</span>
                        </div>
                        <div>
                            <h1 className="font-bold text-lg text-gray-900">DEUNA</h1>
                            <p className="text-xs text-gray-500">Banco Pichincha</p>
                        </div>
                    </div>
                    <button 
                        className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
                        onClick={() => setSidebarOpen(false)}
                    >
                        <FiX className="w-5 h-5" />
                    </button>
                </div>

                {/* User info */}
                <div className="p-4 border-b">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-deuna-primary to-deuna-secondary flex items-center justify-center">
                            <span className="text-white font-semibold text-lg">
                                {user?.first_name?.charAt(0)}{user?.last_name?.charAt(0)}
                            </span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 truncate">
                                {user?.first_name} {user?.last_name}
                            </p>
                            <p className="text-sm text-gray-500 truncate">{user?.email}</p>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="p-4 flex-1">
                    <ul className="space-y-1">
                        {navItems.map(({ to, icon: Icon, label }) => (
                            <li key={to}>
                                <NavLink
                                    to={to}
                                    onClick={() => setSidebarOpen(false)}
                                    className={({ isActive }) =>
                                        `flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                                            isActive
                                                ? 'bg-gradient-to-r from-deuna-primary to-deuna-secondary text-white'
                                                : 'text-gray-600 hover:bg-gray-100'
                                        }`
                                    }
                                >
                                    <Icon className="w-5 h-5" />
                                    <span className="font-medium">{label}</span>
                                </NavLink>
                            </li>
                        ))}
                    </ul>
                </nav>

                {/* Logout */}
                <div className="p-4 border-t">
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-red-500 hover:bg-red-50 transition-all"
                    >
                        <FiLogOut className="w-5 h-5" />
                        <span className="font-medium">Cerrar Sesión</span>
                    </button>
                </div>
            </aside>

            {/* Main content */}
            <div className="lg:ml-64">
                {/* Top bar */}
                <header className="h-16 bg-white shadow-sm flex items-center justify-between px-4 lg:px-8">
                    <button 
                        className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
                        onClick={() => setSidebarOpen(true)}
                    >
                        <FiMenu className="w-6 h-6" />
                    </button>

                    <div className="flex-1 lg:flex-none">
                        <h2 className="text-lg font-semibold text-gray-900 hidden lg:block">
                            Bienvenido, {user?.first_name}
                        </h2>
                    </div>

                    <div className="flex items-center gap-4">
                        <button className="p-2 hover:bg-gray-100 rounded-lg relative">
                            <FiBell className="w-6 h-6 text-gray-600" />
                            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                        </button>
                    </div>
                </header>

                {/* Page content */}
                <main className="p-4 lg:p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default Layout;
