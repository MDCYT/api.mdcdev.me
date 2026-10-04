-- ============================================================================
-- SQL INITIALIZATION SCRIPT FOR MARIADB / MYSQL (PERU OPEN DATA)
-- ============================================================================
-- Tablas para módulos de Bomberos, IGP (Sismos), INDECI (Emergencias), e INEI
-- ============================================================================

CREATE DATABASE IF NOT EXISTS s122974_DatosFiltradosPeru
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

USE s122974_DatosFiltradosPeru;

-- 1. Tabla: bomberos_incidentes
CREATE TABLE IF NOT EXISTS bomberos_incidentes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  incident_id VARCHAR(100) UNIQUE,
  incident_type VARCHAR(150),
  description TEXT,
  address TEXT,
  district VARCHAR(100),
  province VARCHAR(100),
  department VARCHAR(100),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  occurred_at DATETIME,
  raw JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_occurred_at (occurred_at),
  INDEX idx_incident_type (incident_type),
  INDEX idx_department (department)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Tabla: igp_sismos
CREATE TABLE IF NOT EXISTS igp_sismos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sismo_id VARCHAR(100) UNIQUE,
  magnitude DECIMAL(4, 2),
  depth_km DECIMAL(6, 2),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  reference_location TEXT,
  occurred_at DATETIME,
  raw JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_occurred_at (occurred_at),
  INDEX idx_magnitude (magnitude)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Tabla: indeci_incidentes
CREATE TABLE IF NOT EXISTS indeci_incidentes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sinpad_id VARCHAR(100) UNIQUE,
  event_type VARCHAR(150),
  description TEXT,
  department VARCHAR(100),
  province VARCHAR(100),
  district VARCHAR(100),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  occurred_at DATETIME,
  raw JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_occurred_at (occurred_at),
  INDEX idx_event_type (event_type),
  INDEX idx_sinpad_id (sinpad_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Tabla: inei_crime_points
CREATE TABLE IF NOT EXISTS inei_crime_points (
  id INT AUTO_INCREMENT PRIMARY KEY,
  crime_id VARCHAR(100) UNIQUE,
  crime_type VARCHAR(150),
  department VARCHAR(100),
  province VARCHAR(100),
  district VARCHAR(100),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  occurred_at DATETIME,
  raw JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_occurred_at (occurred_at),
  INDEX idx_crime_type (crime_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
