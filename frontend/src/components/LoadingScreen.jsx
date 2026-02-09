const LoadingScreen = () => {
    return (
        <div className="min-h-screen bg-gradient-to-br from-deuna-primary to-deuna-secondary flex items-center justify-center">
            <div className="text-center">
                <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <h2 className="text-white text-xl font-semibold">Cargando...</h2>
                <p className="text-white/80 mt-2">DEUNA - Banco Pichincha</p>
            </div>
        </div>
    );
};

export default LoadingScreen;
