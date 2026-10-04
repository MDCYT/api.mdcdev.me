-- ============================================================================
-- SQL INITIALIZATION SCRIPT FOR MARIADB / MYSQL (PERU OPEN DATA)
-- ============================================================================
-- Base de datos y tablas para los módulos de:
-- 1. INEI (Delitos / crime_points)
-- 2. IGP (Sismos / earthquakes)
-- 3. Bomberos (bomberos_incidentes)
-- 4. INDECI (Emergencias / indeci_incidentes)
-- ============================================================================

-- Crear base de datos si no existe (ajusta el nombre según tu .env si es necesario)
-- Por ejemplo: s122974_DatosFiltradosPeru o s21_api
CREATE DATABASE IF NOT EXISTS `s122974_DatosFiltradosPeru`
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

USE `s122974_DatosFiltradosPeru`;

-- ============================================================================
-- 1. Tabla: crime_points (INEI - Puntos de Delitos)
-- ============================================================================
CREATE TABLE IF NOT EXISTS `crime_points` (
  `id`                  INT AUTO_INCREMENT PRIMARY KEY,
  `source_id`           INT,
  `ubigeo_code`         VARCHAR(10),
  `longitude`           DECIMAL(10, 7) NOT NULL,
  `latitude`            DECIMAL(10, 7) NOT NULL,
  `crime_type`          VARCHAR(100),
  `dept_code`           VARCHAR(5),
  `dept_name`           VARCHAR(50),
  `prov_code`           VARCHAR(5),
  `prov_name`           VARCHAR(50),
  `dist_code`           VARCHAR(5),
  `dist_name`           VARCHAR(50),
  `capital_name`        VARCHAR(50),
  `geom_area`           DECIMAL(15, 8),
  `geom_length`         DECIMAL(15, 8),
  `origin_desc`         VARCHAR(100),
  `urban_nucleus`       VARCHAR(100),
  `influence_zone`      VARCHAR(100),
  `created_at`          DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at`          DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_crime_type` (`crime_type`),
  INDEX `idx_ubigeo` (`ubigeo_code`),
  INDEX `idx_dept` (`dept_code`),
  INDEX `idx_location` (`longitude`, `latitude`),
  INDEX `idx_source` (`source_id`),
  UNIQUE INDEX `idx_unique_crime` (`longitude`, `latitude`, `crime_type`(50), `urban_nucleus`(50))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 2. Tabla: earthquakes (IGP - Sismos del Instituto Geofísico del Perú)
-- ============================================================================
CREATE TABLE IF NOT EXISTS `earthquakes` (
  `id`                               INT AUTO_INCREMENT PRIMARY KEY,
  `code`                             VARCHAR(100) UNIQUE,
  `codes`                            TEXT,
  `report_number`                    VARCHAR(100),
  `list_quake_id`                    INT,
  `external_id`                      VARCHAR(100),
  `date`                             DATETIME,
  `local_date`                       DATETIME,
  `local_time`                       DATETIME,
  `utc_date`                         DATETIME,
  `utc_time`                         DATETIME,
  `datetime_utc`                     DATETIME,
  `created_at`                       DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at`                       DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `latitude`                         DECIMAL(10, 8),
  `longitude`                        DECIMAL(11, 8),
  `reference`                        TEXT,
  `reference2`                       TEXT,
  `reference3`                       TEXT,
  `magnitude`                        DECIMAL(4, 2),
  `magnitude_type`                   VARCHAR(50),
  `depth`                            INT,
  `intensity`                        TEXT,
  `intensities`                      TEXT,
  `event_type`                       VARCHAR(100),
  `surface`                          VARCHAR(100),
  `accelerometric_report_pdf`        TEXT,
  `map`                              TEXT,
  `report`                           TEXT,
  `seismic_map_url`                  TEXT,
  `accelerometric_map_url`           TEXT,
  `max_acceleration_map_url`         TEXT,
  `theoretical_acceleration_map_url` TEXT,
  `intensity_map_url`                TEXT,
  `pseudo_acceleration_map_url`      TEXT,
  `max_velocity_map_url`             TEXT,
  `published`                        BOOLEAN DEFAULT TRUE,
  `drill`                            BOOLEAN DEFAULT FALSE,
  `thematic_pdf_id`                  VARCHAR(100),
  INDEX `idx_datetime_utc` (`datetime_utc`),
  INDEX `idx_date` (`date`),
  INDEX `idx_magnitude` (`magnitude`),
  INDEX `idx_location` (`latitude`, `longitude`),
  INDEX `idx_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 3. Tabla: bomberos_incidentes (Cuerpo General de Bomberos Voluntarios del Perú)
-- ============================================================================
CREATE TABLE IF NOT EXISTS `bomberos_incidentes` (
  `id`            VARCHAR(100) PRIMARY KEY,
  `report_number` VARCHAR(100),
  `type`          VARCHAR(150),
  `district`      VARCHAR(100),
  `location`      TEXT,
  `occurred_at`   DATETIME,
  `latitude`      DECIMAL(10, 8),
  `longitude`     DECIMAL(11, 8),
  `created_at`    DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_occurred_at` (`occurred_at`),
  INDEX `idx_type` (`type`),
  INDEX `idx_district` (`district`),
  INDEX `idx_location` (`latitude`, `longitude`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 4. Tabla: indeci_incidentes (INDECI - Emergencias SINPAD)
-- ============================================================================
CREATE TABLE IF NOT EXISTS `indeci_incidentes` (
  `id`            INT AUTO_INCREMENT PRIMARY KEY,
  `sinpad_id`     VARCHAR(100) UNIQUE,
  `event_type`    VARCHAR(150),
  `description`   TEXT,
  `department`    VARCHAR(100),
  `province`      VARCHAR(100),
  `district`      VARCHAR(100),
  `occurred_at`   DATETIME,
  `latitude`      DECIMAL(10, 8),
  `longitude`     DECIMAL(11, 8),
  `raw`           JSON,
  `created_at`    DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_occurred_at` (`occurred_at`),
  INDEX `idx_event_type` (`event_type`),
  INDEX `idx_sinpad_id` (`sinpad_id`),
  INDEX `idx_location` (`latitude`, `longitude`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
