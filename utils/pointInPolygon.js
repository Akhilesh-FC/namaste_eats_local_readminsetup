exports.isPointInsidePolygon = (point, polygon) => {
  let x = point.lat, y = point.lng;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    let xi = polygon[i].lat,
        yi = polygon[i].lng;
    let xj = polygon[j].lat,
        yj = polygon[j].lng;

    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);

    if (intersect) inside = !inside;
  }

  return inside;
};
