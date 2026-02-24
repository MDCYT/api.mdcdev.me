# 📚 Ejemplos de Uso - API de Bomberos

Este directorio contiene ejemplos prácticos de cómo consumir la API de Bomberos del Perú.

## 🚀 Ejecución

### Prerequisitos
1. Asegúrate de que el servidor esté corriendo:
   ```bash
   npm start
   ```
   O en modo desarrollo:
   ```bash
   npm run dev
   ```

2. Ejecuta los ejemplos:
   ```bash
   node examples/bomberos-examples.js
   ```

## 📋 Ejemplos Incluidos

### 1. Obtener incidentes de las últimas 24 horas
```javascript
const response = await fetch('http://localhost:4200/v2/peru/bomberos/incidentes');
const data = await response.json();
console.log(`Total: ${data.count} incidentes`);
```

### 2. Obtener incidentes de los últimos 7 días
```javascript
const response = await fetch('http://localhost:4200/v2/peru/bomberos/incidentes?rango=dias&cantidad=7');
const data = await response.json();
```

### 3. Buscar por distrito
```javascript
const response = await fetch('http://localhost:4200/v2/peru/bomberos/incidentes/distrito/Lima');
const data = await response.json();
```

### 4. Estado del sistema
```javascript
const response = await fetch('http://localhost:4200/v2/peru/bomberos/incidentes/status');
const data = await response.json();
```

### 5. Análisis estadístico
```javascript
const response = await fetch('http://localhost:4200/v2/peru/bomberos/incidentes?rango=dias&cantidad=30');
const data = await response.json();

// Agrupar por tipo
const tipos = {};
data.data.forEach(inc => {
  tipos[inc.type] = (tipos[inc.type] || 0) + 1;
});
```

## 🌐 URLs de Producción

Reemplaza `http://localhost:4200` con la URL de producción:
```javascript
const BASE_URL = 'https://api.mdcdev.me';
```

## 📖 Más Información

Ver documentación completa en: `docs/API_BOMBEROS.md`
