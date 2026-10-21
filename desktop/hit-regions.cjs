'use strict';

function validRegions(value) {
  if (!Array.isArray(value) || value.length > 32) return [];
  return value.filter(region => {
    if (!region || !Number.isFinite(region.x) || !Number.isFinite(region.y)) return false;
    if (region.kind === 'circle') return Number.isFinite(region.radius) && region.radius > 0 && region.radius <= 20000;
    return region.kind === 'rect' && Number.isFinite(region.width) && Number.isFinite(region.height)
      && region.width > 0 && region.height > 0 && region.width <= 20000 && region.height <= 20000;
  });
}

function containsPoint(regions, point) {
  return regions.some(region => region.kind === 'circle'
    ? Math.hypot(point.x - region.x, point.y - region.y) <= region.radius
    : point.x >= region.x && point.x <= region.x + region.width
      && point.y >= region.y && point.y <= region.y + region.height);
}

module.exports = { validRegions, containsPoint };
