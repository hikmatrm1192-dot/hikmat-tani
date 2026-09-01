import L from 'leaflet';

export function attachDrawingMapClickCapture(
  map: L.Map,
  isDrawingModeRef: { current: boolean },
  onAddDrawingPointRef: { current?: (pt: { lat: number; lng: number }) => void }
): () => void {
  const container = map.getContainer();

  const handleNativeMapClick = (event: MouseEvent) => {
    if (!isDrawingModeRef.current || !onAddDrawingPointRef.current) return;

    const rect = container.getBoundingClientRect();
    const point = L.point(event.clientX - rect.left, event.clientY - rect.top);
    const latlng = map.containerPointToLatLng(point);
    onAddDrawingPointRef.current({ lat: latlng.lat, lng: latlng.lng });

    event.stopPropagation();
    event.stopImmediatePropagation();
  };

  container.addEventListener('click', handleNativeMapClick, true);
  return () => container.removeEventListener('click', handleNativeMapClick, true);
}
