declare module 'react-simple-maps' {
  import React from 'react';
  
  export interface GeographyProps {
    geography: unknown;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    style?: {
      default?: React.CSSProperties;
      hover?: React.CSSProperties;
      pressed?: React.CSSProperties;
    };
    onMouseEnter?: (event: React.MouseEvent) => void;
    onMouseLeave?: (event: React.MouseEvent) => void;
    onClick?: (event: React.MouseEvent) => void;
  }
  
  export interface ZoomableGroupProps {
    center?: [number, number];
    zoom?: number;
    children?: React.ReactNode;
  }
  
  export interface ComposableMapProps {
    projection?: string;
    projectionConfig?: unknown;
    width?: number;
    height?: number;
    style?: React.CSSProperties;
    children?: React.ReactNode;
  }

  export interface GeographiesProps {
    geography: string | object;
    children: (props: { geographies: Array<unknown> }) => React.ReactNode;
  }

  export interface MarkerProps {
    coordinates: [number, number];
    children?: React.ReactNode;
  }
  
  /** ComposableMap component type declaration for react-simple-maps. */
  export const ComposableMap: React.FC<ComposableMapProps>;
  /** ZoomableGroup component type declaration for react-simple-maps. */
  export const ZoomableGroup: React.FC<ZoomableGroupProps>;
  /** Geographies component type declaration for react-simple-maps. */
  export const Geographies: React.FC<GeographiesProps>;
  /** Geography component type declaration for react-simple-maps. */
  export const Geography: React.FC<GeographyProps>;
  /** Marker component type declaration for react-simple-maps. */
  export const Marker: React.FC<MarkerProps>;
}