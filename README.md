# DEUNA - Módulo de Transferencias y Recargas
## Banco Pichincha

Sistema de pagos digitales con funcionalidades de transferencias inmediatas, recargas y pagos QR.

## Requisitos

- Node.js 18+
- MySQL (XAMPP con puerto 3096)
- npm o yarn

## Configuración de Base de Datos

1. Iniciar XAMPP y asegurarse que MySQL está corriendo en el puerto **3096**
2. La base de datos `deuna_pichincha` se crea automáticamente al iniciar el backend

## Instalación

### Backend

```bash
cd backend
npm install
```

### Frontend

```bash
cd frontend
npm install
```

## Ejecución

### 1. Primero iniciar el Backend

```bash
cd backend
npm run dev
```

El servidor se iniciará en **http://localhost:3001**

La primera vez que se ejecute:
- Creará la base de datos `deuna_pichincha`
- Creará todas las tablas necesarias
- Insertará 10 registros de prueba en cada tabla

### 2. Luego iniciar el Frontend

```bash
cd frontend
npm run dev
```

La aplicación web estará disponible en **http://localhost:5173**

## Credenciales de Prueba

| Email | Contraseña |
|-------|------------|
| juan.perez@email.com | 123456 |
| maria.lopez@email.com | 123456 |
| carlos.ramirez@email.com | 123456 |

## Funcionalidades Implementadas

### 1. Transferencias Inmediatas
- Búsqueda de destinatario por email, teléfono o cédula
- Validación de saldo disponible
- Cálculo automático de comisiones
- Estados: PENDIENTE → CONFIRMADA / FALLIDA / REVERSADA
- Límites diarios por cuenta

### 2. Recargas
- Operadoras móviles: CLARO, MOVISTAR, CNT
- Servicios: DIRECTV, SPOTIFY, NETFLIX
- Montos sugeridos y personalizados
- Validación de números telefónicos

### 3. Pagos QR
- Generación de códigos QR para recibir pagos
- Escaneo/validación de códigos QR
- Expiración automática de QR (24 horas)
- Estados: ACTIVO, PAGADO, EXPIRADO, CANCELADO

### 4. Gestión de Cuentas
- Múltiples cuentas por cliente
- Vinculación de tarjetas
- Identificadores de pago (teléfono, email, cédula)

### 5. Auditoría y Trazabilidad
- Log de todas las acciones del sistema
- Registro de comisiones
- Notificaciones en tiempo real

## Estructura de Base de Datos

### Tablas

| Tabla | Descripción |
|-------|-------------|
| `clients` | Clientes registrados |
| `accounts` | Cuentas bancarias |
| `cards` | Tarjetas vinculadas |
| `payment_identifiers` | Identificadores de pago |
| `transactions` | Transacciones realizadas |
| `qr_payments` | Pagos QR generados |
| `commissions` | Comisiones cobradas |
| `audit_logs` | Registro de auditoría |
| `notifications` | Notificaciones |
| `daily_limits` | Control de límites diarios |

## API Endpoints

### Autenticación
- `POST /api/auth/register` - Registro de nuevo cliente
- `POST /api/auth/login` - Inicio de sesión
- `GET /api/auth/me` - Información del usuario actual

### Transferencias
- `POST /api/transfers/search-recipient` - Buscar destinatario
- `POST /api/transfers/calculate-commission` - Calcular comisión
- `POST /api/transfers/send` - Realizar transferencia

### Recargas
- `GET /api/recharges/providers` - Listar proveedores
- `GET /api/recharges/providers/:id/amounts` - Montos sugeridos
- `POST /api/recharges/recharge` - Realizar recarga

### Pagos QR
- `POST /api/qr/generate` - Generar código QR
- `GET /api/qr/validate/:code` - Validar código QR
- `POST /api/qr/pay` - Pagar con código QR
- `GET /api/qr/my-qrs` - Mis códigos QR

### Cuentas
- `GET /api/accounts` - Listar cuentas
- `GET /api/accounts/:id/transactions` - Historial de transacciones
- `GET /api/accounts/cards` - Listar tarjetas
- `GET /api/accounts/payment-identifiers` - Listar identificadores
- `POST /api/accounts/payment-identifiers` - Agregar identificador

### Notificaciones
- `GET /api/notifications` - Listar notificaciones
- `PUT /api/notifications/:id/read` - Marcar como leída

## Tecnologías Utilizadas

### Backend
- Node.js + Express
- MySQL2
- JWT para autenticación
- bcryptjs para encriptación
- node-cron para tareas programadas
- qrcode para generación de QR
- uuid para identificadores únicos

### Frontend
- React 18
- Vite
- Tailwind CSS
- React Router DOM
- Axios
- react-hot-toast
- react-icons
- qrcode.react

## Arquitectura

```
backend/
├── src/
│   ├── config/         # Configuración de BD
│   ├── controllers/    # Lógica de negocio
│   ├── database/       # Scripts de inicialización
│   ├── middlewares/    # Autenticación
│   ├── models/         # Modelos de datos
│   ├── routes/         # Rutas API
│   └── server.js       # Punto de entrada

frontend/
├── src/
│   ├── components/     # Componentes reutilizables
│   ├── context/        # Estado global (Auth)
│   ├── pages/          # Páginas de la aplicación
│   ├── services/       # Cliente API
│   └── App.jsx         # Configuración de rutas
```

## Estados de Transacciones

```
PENDIENTE → CONFIRMADA (éxito)
         → FALLIDA (error)
         → REVERSADA (cancelación)
```

## Comisiones

- Transferencias entre cuentas propias: $0.00
- Transferencias a terceros: $0.25 (fijo) + 0.5% del monto
- Pagos QR: 0.3% del monto (mínimo $0.10)
- Recargas: Sin comisión

## Autor

Desarrollado para el Examen de Bases de Datos - Módulo DEUNA
