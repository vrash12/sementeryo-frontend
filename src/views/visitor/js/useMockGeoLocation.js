// src/views/visitor/js/useMockGeoLocation.js
import { useState, useEffect, useRef } from "react";
import mockPath from "./mockUserLocationSeries.json";

export function useMockGeoLocation({ enabled = false } = {}) {
  const [location, setLocation] = useState(null);
  const [finished, setFinished] = useState(false);
  const indexRef = useRef(0);
  const timerRef = useRef(null);

  // Reset if enabled toggles
  useEffect(() => {
    if (!enabled) {
      clearInterval(timerRef.current);
      setFinished(false);
      indexRef.current = 0;
      return;
    }

    // Set initial position immediately
    if (mockPath.length > 0) {
      setLocation(mockPath[0]);
    }

    // Start walking interval
    timerRef.current = setInterval(() => {
      const nextIndex = indexRef.current + 1;
      
      if (nextIndex >= mockPath.length) {
        clearInterval(timerRef.current);
        setFinished(true);
      } else {
        indexRef.current = nextIndex;
        setLocation(mockPath[nextIndex]);
      }
    }, 800); // Update every 800ms (brisk walk speed)

    return () => clearInterval(timerRef.current);
  }, [enabled]);

  return { location, finished };
}