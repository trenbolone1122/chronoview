import type * as MapboxGL from "mapbox-gl";

declare global {
  namespace mapboxgl {
    type Map = MapboxGL.Map;
    type Marker = MapboxGL.Marker;
    type MapMouseEvent = MapboxGL.MapMouseEvent;
    type NavigationControl = MapboxGL.NavigationControl;
    type AttributionControl = MapboxGL.AttributionControl;
  }

  const mapboxgl: {
    accessToken: string;
    Map: typeof MapboxGL.Map;
    Marker: typeof MapboxGL.Marker;
    NavigationControl: typeof MapboxGL.NavigationControl;
    AttributionControl: typeof MapboxGL.AttributionControl;
  };
}

export {};
