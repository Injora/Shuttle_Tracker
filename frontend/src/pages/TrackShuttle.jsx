import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useSocket } from "../contexts/SocketContext";
import { motion } from "framer-motion";
import { Navigation, Compass, Shield, MapPin } from "lucide-react";

// Predefined stop coordinates and radii (matching geofence.js)
const ZONES = {
  COLLEGE: { lat: 18.6217359, lng: 73.9119325, radius: 150, color: "#a855f7", name: "NST Campus" },
  YS2: { lat: 18.6141596, lng: 73.9116837, radius: 150, color: "#f59e0b", name: "YS2 Hostel Stop" },
  YS1: { lat: 18.6119308, lng: 73.9117003, radius: 150, color: "#3b82f6", name: "YS1 Hostel Stop" },
};

// Polyline path connecting the route: College <-> YS2 <-> YS1
const ROUTE_PATH = [
  [ZONES.COLLEGE.lat, ZONES.COLLEGE.lng],
  [ZONES.YS2.lat, ZONES.YS2.lng],
  [ZONES.YS1.lat, ZONES.YS1.lng],
];

// Helper component to center and fly map to active bus
function MapUpdater({ activeLocation }) {
  const map = useMap();
  useEffect(() => {
    if (activeLocation) {
      map.flyTo(
        [activeLocation.latitude, activeLocation.longitude],
        15,
        { animate: true, duration: 1.5 }
      );
    }
  }, [activeLocation, map]);
  return null;
}

export default function TrackShuttle({ driverLocation }) {
  const { socket } = useSocket();
  const [buses, setBuses] = useState([]);

  const mapCenter = [18.616, 73.911]; // Centered around new DY Patil / YourSpace stops

  // Handle live tracking socket subscriptions
  useEffect(() => {
    // If a driver location is passed as a prop, we are in driver preview mode
    if (driverLocation) {
      setBuses([{
        shiftId: "driver-preview",
        busNumber: "My Bus",
        latitude: driverLocation.latitude,
        longitude: driverLocation.longitude,
        heading: driverLocation.heading || 0,
        speed: driverLocation.speed || 0,
        state: "Idle",
        lastUpdate: Date.now()
      }]);
      return;
    }

    if (!socket) return;

    // Ask for all initial locations
    socket.emit("student:subscribe-tracking");

    const onAllLocations = (locations) => {
      setBuses(locations);
    };

    const onBusLocation = (data) => {
      setBuses((prev) => {
        const exists = prev.some((s) => s.shiftId === data.shiftId);
        if (exists) {
          return prev.map((s) => s.shiftId === data.shiftId ? { ...s, ...data } : s);
        } else {
          return [...prev, data];
        }
      });
    };

    const onBusOffline = (data) => {
      setBuses((prev) => prev.filter((s) => s.shiftId !== data.shiftId));
    };

    socket.on("bus:all-locations", onAllLocations);
    socket.on("bus:location", onBusLocation);
    socket.on("bus:offline", onBusOffline);

    return () => {
      socket.off("bus:all-locations", onAllLocations);
      socket.off("bus:location", onBusLocation);
      socket.off("bus:offline", onBusOffline);
    };
  }, [socket, driverLocation]);

  // Spectacular customized DivIcon for shuttles with pulsing halos!
  const createShuttleIcon = (heading = 0, state = "Idle") => {
    let colorClass = "bg-primary shadow-primary/30";
    if (state.startsWith("En_Route")) colorClass = "bg-emerald-500 shadow-emerald-500/40";
    if (state.startsWith("Waiting")) colorClass = "bg-amber-500 shadow-amber-500/40";
    if (state === "Returning_College") colorClass = "bg-cyan-500 shadow-cyan-500/40";

    return L.divIcon({
      className: "custom-leaflet-shuttle-icon",
      html: `
        <div class="relative w-10 h-10 flex items-center justify-center">
          <div class="absolute inset-0 rounded-full ${colorClass} opacity-20 animate-ping"></div>
          <div class="absolute w-8 h-8 rounded-full border border-white/20 bg-black/80 flex items-center justify-center text-white shadow-2xl relative z-10">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4 transition-transform duration-300" style="transform: rotate(${heading}deg);">
              <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
            </svg>
          </div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
      popupAnchor: [0, -20]
    });
  };

  // Pre-cached Leaflet stop icons
  const createStopIcon = (stopColor) => {
    return L.divIcon({
      className: "custom-stop-icon",
      html: `
        <div class="w-6 h-6 flex items-center justify-center rounded-full bg-black/80 border-2 shadow-lg" style="border-color: ${stopColor}">
          <div class="w-2.5 h-2.5 rounded-full" style="background-color: ${stopColor}"></div>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  };

  return (
    <div className="w-full h-full relative rounded-[2rem] overflow-hidden flex flex-col justify-start">
      {/* Interactive Map */}
      <MapContainer
        center={mapCenter}
        zoom={14}
        className="h-full w-full z-0 rounded-[2rem]"
        scrollWheelZoom={true}
        zoomControl={false}
      >
        {/* Fly to active shuttle if previewing */}
        {buses.length > 0 && <MapUpdater activeLocation={buses[0]} />}
        
        {/* Tile Provider: Sleek CartoDB Dark Matter / Voyager Map Tiles */}
        <TileLayer
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        {/* Draw Route Polyline */}
        <Polyline
          positions={ROUTE_PATH}
          pathOptions={{
            color: "#6366f1",
            weight: 5,
            opacity: 0.6,
            dashArray: "10, 10",
            lineCap: "round"
          }}
        />

        {/* Draw Geofence Visual overlays (Circles & Custom Stop Markers) */}
        {Object.entries(ZONES).map(([key, zone]) => (
          <React.Fragment key={key}>
            <Circle
              center={[zone.lat, zone.lng]}
              radius={zone.radius}
              pathOptions={{
                fillColor: zone.color,
                fillOpacity: 0.12,
                color: zone.color,
                weight: 2,
                opacity: 0.5,
              }}
            />
            <Marker
              position={[zone.lat, zone.lng]}
              icon={createStopIcon(zone.color)}
            >
              <Popup>
                <div className="text-center p-1">
                  <h4 className="font-extrabold text-sm text-foreground">{zone.name}</h4>
                  <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">
                    Geofenced Radius: {zone.radius}m
                  </p>
                </div>
              </Popup>
            </Marker>
          </React.Fragment>
        ))}

        {/* Draw Shuttle Location Markers */}
        {buses.map((bus) => (
          <Marker
            key={bus.shiftId}
            position={[bus.latitude, bus.longitude]}
            icon={createShuttleIcon(bus.heading, bus.state)}
          >
            <Popup className="glass-popup">
              <div className="text-center p-2 min-w-[120px]">
                <span className="font-extrabold text-sm text-indigo-500 block mb-1">
                  Shuttle {bus.busNumber}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-white/5 rounded-full inline-block mb-2">
                  {bus.state.replace("_", " ")}
                </span>
                <div className="space-y-1 text-[10px] text-muted-foreground font-semibold text-left border-t border-white/5 pt-2">
                  <p>Speed: {((bus.speed || 0) * 3.6).toFixed(1)} km/h</p>
                  <p>Heading: {Math.round(bus.heading || 0)}°</p>
                  <p>Last Update: {new Date(bus.lastUpdate || Date.now()).toLocaleTimeString()}</p>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Floating UI overlay counters */}
      <div className="absolute top-4 right-4 z-[400] flex flex-col gap-2">
        <div className="bg-black/80 backdrop-blur-xl border border-white/10 px-4 py-2.5 rounded-2xl text-xs font-bold text-white flex items-center gap-2 shadow-2xl">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          {buses.length} Active Shuttles
        </div>
      </div>
    </div>
  );
}
