# Mapeo estructura schema `report`

## Tablas y relaciones

| Tabla | Entidad dominio | Relaciones |
|-------|-----------------|------------|
| `report.divi_departamentos` | `Departamento` | PK: codigo_departamento. FK en el resto. |
| `report.divi_municipio` | `Municipio` | codigo_departamento → divi_departamentos |
| `report.congreso_resultados` | `CongresoResultado` | codigo_departamento → divi_departamentos; codigo_municipio → divi_municipio |
| `report.kpis_gestion_teridata` | `KpiGestionTeridata` | codigo_departamento → divi_departamentos |
| `report.kpis_realidad_dane` | `KpiRealidadDane` | codigo_departamento → divi_departamentos |

## API actual (congreso)

- **GET /api/congreso-report/departments** → `divi_departamentos` (codigo_departamento, nombre).
- **GET /api/congreso-report/years** → `congreso_resultados.anio_eleccion` (distinct).
- **GET /api/congreso-report/summary?year=&departments=** → agregado por codigo_departamento, partido (sum votos) en `congreso_resultados`.
- **GET /api/congreso-report/trend?departments=** → tendencia por anio_eleccion y partido.
- **GET /api/congreso-resultados?page=&limit=** → paginado sobre `congreso_resultados`.
- **GET /api/congreso-resultados/count** → total de filas (cacheado).

## Configuración

En `.env` usar **DB_SCHEMA=report** para que los adaptadores usen el schema `report`.
