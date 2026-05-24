/**
 * @module services/geofence
 * @description Geofence zone definitions and spatial utilities for the
 *   Shuttle Tracker app.  Uses the Haversine formula to check whether a
 *   GPS coordinate falls within a predefined campus zone.
 */

"use strict";

// ── Zone definitions ────────────────────────────────────────────────────────
/**
 * Predefined geofence zones.
 * Each zone has a center (lat/lng) and a radius in meters.
 *
 * @readonly
 * @enum {{ lat: number, lng: number, radiusM: number }}
 */
const ZONES = {
  COLLEGE: { lat: 18.6217359, lng: 73.9119325, radiusM: 150 },
  YS2: { lat: 18.6141596, lng: 73.9116837, radiusM: 150 },
  YS1: { lat: 18.6119308, lng: 73.9117003, radiusM: 150 },
};

// ── Constants ───────────────────────────────────────────────────────────────
/** Mean radius of the Earth in meters. */
const EARTH_RADIUS_M = 6_371_000;

/** Helper – convert degrees to radians. */
const toRad = (deg) => (deg * Math.PI) / 180;

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Calculate the great-circle distance between two points using the
 * Haversine formula.
 *
 * @param {number} lat1 - Latitude of the first point (degrees).
 * @param {number} lng1 - Longitude of the first point (degrees).
 * @param {number} lat2 - Latitude of the second point (degrees).
 * @param {number} lng2 - Longitude of the second point (degrees).
 * @returns {number} Distance in **meters**.
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_M * c;
}

/**
 * Check whether a coordinate falls within a named geofence zone.
 *
 * @param {number} lat - Latitude of the point to check (degrees).
 * @param {number} lng - Longitude of the point to check (degrees).
 * @param {string} zoneName - Key of the zone in {@link ZONES} (e.g. `"COLLEGE"`).
 * @returns {boolean} `true` if the point is within the zone's radius.
 * @throws {Error} If `zoneName` does not exist in {@link ZONES}.
 */
function isInZone(lat, lng, zoneName) {
  const zone = ZONES[zoneName];
  if (!zone) {
    throw new Error(`Unknown geofence zone: "${zoneName}"`);
  }
  const distance = haversineDistance(lat, lng, zone.lat, zone.lng);
  return distance <= zone.radiusM;
}

/**
 * Return the names of **all** zones that the given coordinate falls within.
 *
 * @param {number} lat - Latitude of the point to check (degrees).
 * @param {number} lng - Longitude of the point to check (degrees).
 * @returns {string[]} Array of zone names (may be empty).
 */
function checkAllZones(lat, lng) {
  const matchedZones = [];

  for (const [name, zone] of Object.entries(ZONES)) {
    const distance = haversineDistance(lat, lng, zone.lat, zone.lng);
    if (distance <= zone.radiusM) {
      matchedZones.push(name);
    }
  }

  return matchedZones;
}

// ── Exports ─────────────────────────────────────────────────────────────────
module.exports = {
  ZONES,
  haversineDistance,
  isInZone,
  checkAllZones,
};
