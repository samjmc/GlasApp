import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { ELECTION_RESULTS } from '../assets/election-results';

// Party colors
const PARTY_COLORS: Record<string, string> = {
  "Fianna Fáil": "#10823A", // Green
  "Fine Gael": "#0051BA",   // Blue
  "Sinn Féin": "#326760",   // Dark Green
  "Green Party": "#00FF00", // Bright Green
  "Labour Party": "#CC0000", // Red
  "Social Democrats": "#752F8B", // Purple
  "Solidarity–PBP": "#8B0000", // Dark Red
  "Independent": "#666666", // Gray
  "Aontú": "#FFA500",      // Orange
  "Other": "#999999"        // Light Gray
};

// Ireland GeoJSON data
const IRELAND_GEOJSON = {
  "type": "FeatureCollection",
  "features": [
    // Kerry
    {
      "type": "Feature",
      "properties": { "name": "Kerry", "seats": 5 },
      "geometry": { 
        "type": "Polygon", 
        "coordinates": [[[-10.4, 51.7], [-10.4, 52.5], [-9.3, 52.5], [-9.3, 51.7], [-10.4, 51.7]]] 
      }
    },
    // Cork South-West
    {
      "type": "Feature",
      "properties": { "name": "Cork South-West", "seats": 3 },
      "geometry": { 
        "type": "Polygon", 
        "coordinates": [[[-9.8, 51.2], [-9.8, 51.7], [-8.8, 51.7], [-8.8, 51.2], [-9.8, 51.2]]] 
      }
    },
    // Cork North-West
    {
      "type": "Feature",
      "properties": { "name": "Cork North-West", "seats": 3 },
      "geometry": { 
        "type": "Polygon", 
        "coordinates": [[[-9.2, 51.7], [-9.2, 52.2], [-8.4, 52.2], [-8.4, 51.7], [-9.2, 51.7]]] 
      }
    },
    // Cork East
    {
      "type": "Feature",
      "properties": { "name": "Cork East", "seats": 4 },
      "geometry": { 
        "type": "Polygon", 
        "coordinates": [[[-8.4, 51.7], [-8.4, 52.2], [-7.8, 52.2], [-7.8, 51.7], [-8.4, 51.7]]] 
      }
    },
    // Dublin Central
    {
      "type": "Feature",
      "properties": { "name": "Dublin Central", "seats": 4 },
      "geometry": { 
        "type": "Polygon", 
        "coordinates": [[[-6.3, 53.34], [-6.3, 53.4], [-6.22, 53.4], [-6.22, 53.34], [-6.3, 53.34]]] 
      }
    },
    // Dublin Bay North
    {
      "type": "Feature",
      "properties": { "name": "Dublin Bay North", "seats": 5 },
      "geometry": { 
        "type": "Polygon", 
        "coordinates": [[[-6.22, 53.34], [-6.22, 53.4], [-6.1, 53.4], [-6.1, 53.34], [-6.22, 53.34]]] 
      }
    },
    // Dublin Bay South
    {
      "type": "Feature",
      "properties": { "name": "Dublin Bay South", "seats": 4 },
      "geometry": { 
        "type": "Polygon", 
        "coordinates": [[[-6.3, 53.3], [-6.3, 53.34], [-6.22, 53.34], [-6.22, 53.3], [-6.3, 53.3]]] 
      }
    },
    // Galway East
    {
      "type": "Feature",
      "properties": { "name": "Galway East", "seats": 3 },
      "geometry": { 
        "type": "Polygon", 
        "coordinates": [[[-9.0, 53.0], [-9.0, 53.5], [-8.2, 53.5], [-8.2, 53.0], [-9.0, 53.0]]] 
      }
    },
    // Galway West
    {
      "type": "Feature",
      "properties": { "name": "Galway West", "seats": 5 },
      "geometry": { 
        "type": "Polygon", 
        "coordinates": [[[-9.8, 53.0], [-9.8, 53.5], [-9.0, 53.5], [-9.0, 53.0], [-9.8, 53.0]]] 
      }
    }
  ]
};

interface D3IrelandMapProps {
  onConstituencySelect?: (name: string) => void;
  width?: number;
  height?: number;
}

const D3IrelandMap: React.FC<D3IrelandMapProps> = ({ 
  onConstituencySelect, 
  width = 600, 
  height = 800 
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedConstituency, setSelectedConstituency] = useState<string | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    // Clear any existing visualization
    d3.select(svgRef.current).selectAll("*").remove();

    // Create SVG container
    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(0, 0)`);

    // Create projection - we're using a simple Mercator projection centered on Ireland
    const projection = d3.geoMercator()
      .center([-8, 53.5]) // Center on Ireland
      .scale(4000)        // Scale to fit Ireland
      .translate([width / 2, height / 2]);

    // Create path generator
    const path = d3.geoPath().projection(projection);

    // Add constituencies
    svg.selectAll(".constituency")
      .data(IRELAND_GEOJSON.features)
      .enter()
      .append("path")
      .attr("class", "constituency")
      .attr("d", path as any)
      .attr("fill", (d) => {
        // Get constituency name
        const name = d.properties.name;
        // Get main party (first TD)
        const mainParty = ELECTION_RESULTS[`${name}1`] || "Other";
        // Return party color
        return PARTY_COLORS[mainParty] || PARTY_COLORS["Other"];
      })
      .attr("stroke", "#fff")
      .attr("stroke-width", 1)
      .style("opacity", 0.8)
      .on("mouseover", function(event, d) {
        d3.select(this)
          .attr("stroke", "#000")
          .attr("stroke-width", 2)
          .style("opacity", 1);
          
        // Show tooltip
        tooltip
          .style("opacity", 1)
          .html(`<strong>${d.properties.name}</strong><br/>Seats: ${d.properties.seats}`)
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 30) + "px");
      })
      .on("mouseout", function() {
        d3.select(this)
          .attr("stroke", "#fff")
          .attr("stroke-width", 1)
          .style("opacity", 0.8);
          
        // Hide tooltip
        tooltip.style("opacity", 0);
      })
      .on("click", function(event, d) {
        const constituencyName = d.properties.name;
        setSelectedConstituency(constituencyName);
        if (onConstituencySelect) {
          onConstituencySelect(constituencyName);
        }
      });

    // Add constituency labels
    svg.selectAll(".constituency-label")
      .data(IRELAND_GEOJSON.features)
      .enter()
      .append("text")
      .attr("class", "constituency-label")
      .attr("transform", function(d) {
        // Get centroid of constituency
        const centroid = path.centroid(d as any);
        return `translate(${centroid[0]}, ${centroid[1]})`;
      })
      .attr("text-anchor", "middle")
      .attr("font-size", "10px")
      .attr("fill", "#000")
      .text(d => d.properties.name);

    // Add tooltip
    const tooltip = d3.select("body")
      .append("div")
      .attr("class", "tooltip")
      .style("position", "absolute")
      .style("background", "#fff")
      .style("padding", "8px")
      .style("border-radius", "4px")
      .style("box-shadow", "0 0 10px rgba(0,0,0,0.2)")
      .style("pointer-events", "none")
      .style("opacity", 0);

    // Cleanup
    return () => {
      tooltip.remove();
    };
  }, [width, height, onConstituencySelect]);

  return (
    <div className="d3-map-container">
      <svg ref={svgRef}></svg>
      {selectedConstituency && (
        <div className="selected-info">
          <h3>Selected: {selectedConstituency}</h3>
        </div>
      )}
    </div>
  );
};

export default D3IrelandMap;