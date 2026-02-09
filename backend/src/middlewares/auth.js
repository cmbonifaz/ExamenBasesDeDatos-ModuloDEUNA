const jwt = require('jsonwebtoken');
const { Client } = require('../models');

const authMiddleware = async (req, res, next) => {
    try {
        // Obtener token del header
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
            return res.status(401).json({
                success: false,
                message: 'Token de autenticación no proporcionado'
            });
        }

        // Extraer token (formato: Bearer <token>)
        const token = authHeader.startsWith('Bearer ') 
            ? authHeader.slice(7) 
            : authHeader;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Formato de token inválido'
            });
        }

        // Verificar token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Verificar que el cliente existe y está activo
        const client = await Client.findById(decoded.id);
        
        if (!client) {
            return res.status(401).json({
                success: false,
                message: 'Cliente no encontrado'
            });
        }

        if (client.status !== 'ACTIVO') {
            return res.status(401).json({
                success: false,
                message: `Tu cuenta está ${client.status.toLowerCase()}`
            });
        }

        // Agregar datos del usuario a la request
        req.user = {
            id: client.id,
            cedula: client.cedula,
            email: client.email,
            first_name: client.first_name,
            last_name: client.last_name
        };

        next();

    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Token inválido'
            });
        }
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expirado'
            });
        }

        console.error('Error en autenticación:', error);
        res.status(500).json({
            success: false,
            message: 'Error de autenticación'
        });
    }
};

module.exports = authMiddleware;
