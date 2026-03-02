# API Trucky - Documentación

## Rutas disponibles

### `/v2/peruserver/trucky/top-km/monthly`
Devuelve estadísticas mensuales de empresas Trucky para un mes y año específico.

**Query parameters:**
- `month` o `mes`: Mes (1-12). Default: mes actual
- `year`, `año` o `anio`: Año. Default: año actual
- `limit`: Límite de empresas (1-200). Default: 50

**Ejemplo:**
```
GET /v2/peruserver/trucky/top-km/monthly?month=3&year=2026&limit=35
```

**Caché:** 30 minutos

---

### `/v2/peruserver/trucky/top-km` (acumulado)
Devuelve kilómetros acumulados desde un mes inicial hasta el mes actual.

**Query parameters:**
- `month` o `mes`: **OBLIGATORIO**. Mes de inicio (1-12)
- `year`, `año` o `anio`: Año de inicio. **Opcional**
  - Si no se especifica:
    - Si `month` > mes actual → usa año pasado
    - Si `month` ≤ mes actual → usa año actual
  - Ejemplo en marzo 2026:
    - `month=1` → enero 2026
    - `month=5` → mayo 2025 (porque mayo 2026 no ha llegado)
- `limit`: Límite de empresas (1-200). Default: 50

**Ejemplo:**
```
GET /v2/peruserver/trucky/top-km?month=1&limit=35
# Acumula desde enero 2026 hasta marzo 2026 (mes actual)

GET /v2/peruserver/trucky/top-km?month=1&year=2025
# Acumula desde enero 2025 hasta marzo 2026
```

**Caché:**
- Meses pasados completos: 24 horas
- Mes actual: 30 minutos
- Caché completa de la consulta: 30 minutos

**Respuesta:**
```json
{
  "ok": true,
  "limit": 35,
  "period": {
    "from": { "month": 1, "year": 2026 },
    "to": { "month": 3, "year": 2026 },
    "total_months": 3
  },
  "count_companies_total": 35,
  "count_companies_processed": 35,
  "items": [
    {
      "id": 41374,
      "name": "TRANSPORTES SALAZAR [PSV]",
      "tag": "[SLZ]",
      "members": 9,
      "total_distance": 125430,
      "total_jobs": 856,
      "months_processed": 3,
      "months_with_errors": 0
    },
    ...
  ],
  "timestamp": 1709342618,
  "timestamp_human": "2026-03-02 02:43:38",
  "note": "Kilómetros acumulados desde el mes/año inicial hasta el mes actual"
}
```

---

## Caché strategy

### Meses individuales
- **Mes actual**: 30 minutos (datos cambian frecuentemente)
- **Meses pasados**: 24 horas (datos no cambian)

### Consultas completas
- **Monthly**: 30 minutos
- **Acumulado**: 30 minutos (pero reutiliza caché de meses individuales)

### Comportamiento ante errores
- Si Trucky falla, se mantiene la última respuesta válida en caché
- Solo se reintenta después del TTL correspondiente
- Si no hay caché previa, responde 503 con detalle del error
