const { createClient } = require('redis');

// Almacenar clientes por número de base de datos
const clientCache = {};
const memoryStore = {};

// Clase para almacenar datos en RAM como fallback
class MemoryStore {
    constructor(prefix = "") {
        this.prefix = prefix;
        this.data = {};
        this.expiry = {};
    }

    async set(key, value) {
        const fullKey = `${this.prefix}-${key}`;
        this.data[fullKey] = value;
        // Limpiar expiración anterior si existe
        if (this.expiry[fullKey]) {
            clearTimeout(this.expiry[fullKey]);
        }
    }

    async get(key) {
        const fullKey = `${this.prefix}-${key}`;
        return this.data[fullKey] || null;
    }

    async del(key) {
        const fullKey = `${this.prefix}-${key}`;
        delete this.data[fullKey];
        if (this.expiry[fullKey]) {
            clearTimeout(this.expiry[fullKey]);
            delete this.expiry[fullKey];
        }
    }

    async exists(key) {
        const fullKey = `${this.prefix}-${key}`;
        return fullKey in this.data ? 1 : 0;
    }

    async keys() {
        return Object.keys(this.data);
    }

    async flushDb() {
        Object.keys(this.expiry).forEach(key => clearTimeout(this.expiry[key]));
        this.data = {};
        this.expiry = {};
    }

    async quit() {
        await this.flushDb();
    }

    async expire(key, seconds) {
        const fullKey = `${this.prefix}-${key}`;
        if (this.expiry[fullKey]) {
            clearTimeout(this.expiry[fullKey]);
        }
        this.expiry[fullKey] = setTimeout(() => {
            delete this.data[fullKey];
            delete this.expiry[fullKey];
        }, seconds * 1000);
    }

    async sendCommand(args) {
        throw new Error('sendCommand no está disponible en MemoryStore');
    }
}

class DB {
    constructor(database, prefix = "") {
        // Reutilizar cliente existente si ya está conectado a esta base de datos
        if (!clientCache[database]) {
            const client = createClient({
                url: process.env.REDIS_URL + "/" + database,
                socket: {
                    reconnectStrategy: (retries) => {
                        if (retries > 3) {
                            console.warn(`⚠️  Redis reconexión fallida después de ${retries} intentos. Usando memoria RAM como fallback.`);
                            return false;
                        }
                        return Math.min(retries * 50, 500);
                    }
                }
            });

            let isRedisConnected = false;

            client.on('error', (error) => {
                if (!isRedisConnected) {
                    console.error(`❌ Error conectando a Redis (DB ${database}):`, error.message);
                }
            });

            client.on('connect', () => {
                isRedisConnected = true;
                console.log(`✅ Redis conectado exitosamente (DB ${database})`);
            });

            client.on('reconnecting', () => {
                console.warn(`🔄 Intentando reconectar a Redis (DB ${database})...`);
            });

            // Conectar el cliente solo una vez con timeout
            client.connect()
                .then(() => {
                    isRedisConnected = true;
                    console.log(`✅ Conexión a Redis establecida (DB ${database})`);
                })
                .catch((err) => {
                    console.warn(`⚠️  No se pudo conectar a Redis (DB ${database}). Usando memoria RAM temporalmente.`);
                    console.warn(`⚠️  ADVERTENCIA: La memoria RAM no persiste. Por favor, asegúrate de que Redis esté disponible.`);
                    isRedisConnected = false;
                    // Crear un MemoryStore como fallback
                    clientCache[database] = new MemoryStore("");
                    return;
                });

            clientCache[database] = client;
        }

        this.client = clientCache[database];
        this.prefix = prefix;
    }

    async set(key, value) {
        try {
            await this.client.set(`${this.prefix}-${key}`, JSON.stringify(value));
        } catch (err) {
            console.warn(`⚠️  Error al guardar en Redis, usando memoria RAM:`, err.message);
            // Fallback a MemoryStore si Redis falla
            if (!(this.client instanceof MemoryStore)) {
                this.client = new MemoryStore(this.prefix);
            }
            await this.client.set(key, JSON.stringify(value));
        }
    }

    async get(key) {
        try {
            return JSON.parse(await this.client.get(`${this.prefix}-${key}`));
        } catch (err) {
            console.warn(`⚠️  Error al obtener de Redis, usando memoria RAM:`, err.message);
            if (!(this.client instanceof MemoryStore)) {
                this.client = new MemoryStore(this.prefix);
            }
            const data = await this.client.get(key);
            return data ? JSON.parse(data) : null;
        }
    }

    async delete(key) {
        try {
            await this.client.del(`${this.prefix}-${key}`);
        } catch (err) {
            console.warn(`⚠️  Error al eliminar de Redis:`, err.message);
            if (!(this.client instanceof MemoryStore)) {
                this.client = new MemoryStore(this.prefix);
            }
            await this.client.del(key);
        }
    }

    async exists(key) {
        try {
            return await this.client.exists(`${this.prefix}-${key}`);
        } catch (err) {
            console.warn(`⚠️  Error al verificar existencia en Redis:`, err.message);
            if (!(this.client instanceof MemoryStore)) {
                this.client = new MemoryStore(this.prefix);
            }
            return await this.client.exists(key);
        }
    }

    async keys() {
        try {
            return await this.client.keys('*');
        } catch (err) {
            console.warn(`⚠️  Error al obtener keys de Redis:`, err.message);
            if (!(this.client instanceof MemoryStore)) {
                this.client = new MemoryStore(this.prefix);
            }
            return await this.client.keys();
        }
    }

    async flush() {
        try {
            await this.client.flushDb();
        } catch (err) {
            console.warn(`⚠️  Error al limpiar Redis:`, err.message);
            if (!(this.client instanceof MemoryStore)) {
                this.client = new MemoryStore(this.prefix);
            }
            await this.client.flushDb();
        }
    }

    async close() {
        try {
            await this.client.quit();
        } catch (err) {
            console.warn(`⚠️  Error al cerrar conexión a Redis:`, err.message);
        }
    }

    async expire(key, seconds) {
        try {
            await this.client.expire(`${this.prefix}-${key}`, seconds);
        } catch (err) {
            console.warn(`⚠️  Error al establecer expiración en Redis:`, err.message);
            if (!(this.client instanceof MemoryStore)) {
                this.client = new MemoryStore(this.prefix);
            }
            await this.client.expire(key, seconds);
        }
    }

    async sendCommand(args) {
        try {
            return await this.client.sendCommand(args);
        } catch (err) {
            console.warn(`⚠️  Error al ejecutar comando en Redis:`, err.message);
            throw err;
        }
    }
}	

module.exports = {
    DB
};