# Backend – Arquitectura hexagonal

Proyecto Node.js + TypeScript con **arquitectura hexagonal** (ports and adapters). La conexión a la base de datos usa las variables definidas en `.env`.

## Estructura

```
src/
├── config/           # Configuración (env)
├── domain/           # Núcleo: entidades y puertos (interfaces)
│   ├── entities/
│   └── ports/
├── application/      # Casos de uso (orquestan el dominio)
│   └── use-cases/
├── infrastructure/   # Adaptadores (PostgreSQL, Express)
│   ├── persistence/
│   └── http/
└── index.ts          # Composición y arranque
```

- **Domain**: no conoce DB ni HTTP. Define entidades (ej. `Election`) y puertos (ej. `ElectionRepository`).
- **Application**: casos de uso que dependen de los puertos (inyección por constructor).
- **Infrastructure**: implementa los puertos (PostgreSQL para el repositorio, Express para la API).

## Configuración

El archivo `.env` debe contener:

- `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`
- `DB_SCHEMA=report` (schema con divi_departamentos, divi_municipio, congreso_resultados, kpis_*)
- `PORT` (por defecto 3001)

Las tablas del schema `report` se asumen ya creadas (ver `docs/ESTRUCTURA_REPORT.md`).

## Comandos

```bash
npm install
npm run dev      # Desarrollo con recarga
npm run build
npm start        # Producción (dist/index.js)
```

## Frontend (proyecto separado)

La vista que consume esta API está en la carpeta **dev-front-appbi-v1** (mismo nivel que esta). Ahí se muestra el total de registros y la tabla de resultados unificados.

## API (schema report)

- `GET /health` – Estado del servicio
- `GET /api/congreso-report/departments` – Lista de departamentos (divi_departamentos: codigo_departamento, nombre)
- `GET /api/congreso-report/years` – Años disponibles (anio_eleccion en congreso_resultados)
- `GET /api/congreso-report/summary?year=&departments=` – Resumen por año y códigos de departamento (ganador, top 5)
- `GET /api/congreso-report/trend?departments=` – Tendencia histórica por partido
- `GET /api/congreso-resultados?page=&limit=` – Registros paginados de congreso_resultados
- `GET /api/congreso-resultados/count` – Total (cacheado 1 h)
