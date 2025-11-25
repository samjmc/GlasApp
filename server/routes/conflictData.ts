import { Router, Request, Response } from "express";
import { z } from "zod";

const router = Router();

// Sample conflict data
// In a real implementation, this would be fetched from a database
const sampleConflictData = [
  {
    id: "ukraine-russia",
    name: "Russia-Ukraine War",
    location: "Eastern Europe",
    coordinates: [31.1656, 48.3794], // [longitude, latitude]
    intensity: 8,
    type: "active",
    description: "Military invasion of Ukraine by Russian forces that began in February 2022. The conflict has resulted in widespread destruction of Ukrainian infrastructure and thousands of casualties.",
    lastUpdated: new Date().toISOString(),
    casualties: {
      civilian: 9000,
      military: 45000
    },
    countries: ["Ukraine", "Russia"],
    sources: ["UN Reports", "OSCE Monitoring", "Media Sources"]
  },
  {
    id: "gaza-israel",
    name: "Israel-Gaza Conflict",
    location: "Middle East",
    coordinates: [34.3088, 31.3547],
    intensity: 9,
    type: "active",
    description: "Ongoing conflict between Israel and Hamas in Gaza following the October 7, 2023 attacks. Humanitarian concerns have been raised due to the high number of civilian casualties.",
    lastUpdated: new Date().toISOString(),
    casualties: {
      civilian: 16000,
      military: 5000
    },
    countries: ["Israel", "Palestine"],
    sources: ["UN Reports", "Human Rights Watch", "Media Sources"]
  },
  {
    id: "sudan-civil-war",
    name: "Sudan Civil War",
    location: "Africa",
    coordinates: [30.2176, 12.8628],
    intensity: 7,
    type: "escalating",
    description: "Civil war between the Sudanese Armed Forces and the Rapid Support Forces that began in April 2023. The conflict has led to a severe humanitarian crisis.",
    lastUpdated: new Date().toISOString(),
    casualties: {
      civilian: 12000,
      military: 6000
    },
    countries: ["Sudan"],
    sources: ["UN Reports", "African Union", "Media Sources"]
  },
  {
    id: "myanmar-civil-war",
    name: "Myanmar Civil War",
    location: "Southeast Asia",
    coordinates: [95.9560, 21.9162],
    intensity: 6,
    type: "active",
    description: "Civil conflict following the 2021 military coup. Multiple armed groups are fighting against the military junta, with increasing fragmentation of the country.",
    lastUpdated: new Date().toISOString(),
    casualties: {
      civilian: 3000,
      military: 2000
    },
    countries: ["Myanmar"],
    sources: ["UN Reports", "ASEAN", "Human Rights Organizations"]
  },
  {
    id: "ethiopia-tigray",
    name: "Tigray Conflict",
    location: "Africa",
    coordinates: [39.4699, 13.4966],
    intensity: 5,
    type: "deescalating",
    description: "Civil conflict in the Tigray region of Ethiopia that began in November 2020. A peace agreement was signed in November 2022, but tensions remain.",
    lastUpdated: new Date().toISOString(),
    casualties: {
      civilian: 5000,
      military: 8000
    },
    countries: ["Ethiopia"],
    sources: ["African Union", "UN Reports", "Ethiopian Government"]
  },
  {
    id: "yemen-civil-war",
    name: "Yemen Civil War",
    location: "Middle East",
    coordinates: [44.2064, 15.3522],
    intensity: 7,
    type: "frozen",
    description: "Multi-sided civil war that has been ongoing since 2014. Despite truces and peace efforts, the humanitarian situation remains critical.",
    lastUpdated: new Date().toISOString(),
    casualties: {
      civilian: 14000,
      military: 10000
    },
    countries: ["Yemen", "Saudi Arabia", "Iran"],
    sources: ["UN Reports", "Media Sources", "International Crisis Group"]
  },
  {
    id: "drc-conflict",
    name: "Eastern DRC Conflict",
    location: "Africa",
    coordinates: [28.9000, -2.5000],
    intensity: 6,
    type: "escalating",
    description: "Ongoing conflict in eastern Democratic Republic of Congo involving multiple armed groups. The M23 rebel group has been increasingly active.",
    lastUpdated: new Date().toISOString(),
    casualties: {
      civilian: 6000,
      military: 3000
    },
    countries: ["Democratic Republic of Congo", "Rwanda"],
    sources: ["UN MONUSCO", "African Union", "Media Sources"]
  },
  {
    id: "syria-civil-war",
    name: "Syrian Civil War",
    location: "Middle East",
    coordinates: [38.9968, 34.8021],
    intensity: 6,
    type: "frozen",
    description: "Multi-sided civil war that began in 2011. While major combat operations have decreased, the country remains divided with foreign powers involved.",
    lastUpdated: new Date().toISOString(),
    casualties: {
      civilian: 300000,
      military: 100000
    },
    countries: ["Syria", "Russia", "Turkey", "Iran", "United States"],
    sources: ["UN Reports", "Syrian Observatory for Human Rights", "Media Sources"]
  },
  {
    id: "burkina-faso-insurgency",
    name: "Burkina Faso Insurgency",
    location: "Africa",
    coordinates: [-1.5616, 12.2383],
    intensity: 5,
    type: "active",
    description: "Ongoing jihadist insurgency in Burkina Faso that has displaced millions. The security situation continues to deteriorate.",
    lastUpdated: new Date().toISOString(),
    casualties: {
      civilian: 3000,
      military: 1200
    },
    countries: ["Burkina Faso"],
    sources: ["UN Reports", "ECOWAS", "Media Sources"]
  },
  {
    id: "mozambique-insurgency",
    name: "Mozambique Insurgency",
    location: "Africa",
    coordinates: [39.8144, -12.8858],
    intensity: 4,
    type: "deescalating",
    description: "Islamist insurgency in Cabo Delgado province that began in 2017. Regional forces have helped push back insurgents.",
    lastUpdated: new Date().toISOString(),
    casualties: {
      civilian: 2000,
      military: 800
    },
    countries: ["Mozambique"],
    sources: ["UN Reports", "SADC", "Media Sources"]
  }
];

// Get all conflicts
router.get("/conflicts", async (req: Request, res: Response) => {
  try {
    // In a real implementation, fetch from database
    const conflicts = sampleConflictData;
    
    res.json({
      success: true,
      data: conflicts
    });
  } catch (error) {
    console.error("Error fetching conflict data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch conflict data"
    });
  }
});

// Get specific conflict by ID
router.get("/conflicts/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // In a real implementation, fetch from database
    const conflict = sampleConflictData.find(c => c.id === id);
    
    if (!conflict) {
      return res.status(404).json({
        success: false,
        message: "Conflict not found"
      });
    }
    
    res.json({
      success: true,
      data: conflict
    });
  } catch (error) {
    console.error("Error fetching conflict data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch conflict data"
    });
  }
});

// Get conflicts by region
router.get("/conflicts/region/:region", async (req: Request, res: Response) => {
  try {
    const { region } = req.params;
    
    // Map region names to coordinates and zoom levels for filtering
    const regionBounds: Record<string, { 
      center: [number, number], 
      radius: number 
    }> = {
      "europe": { center: [15, 50], radius: 30 },
      "middle-east": { center: [45, 30], radius: 20 },
      "africa": { center: [20, 0], radius: 40 },
      "asia": { center: [100, 30], radius: 40 },
      "americas": { center: [-80, 0], radius: 60 }
    };
    
    if (!regionBounds[region]) {
      return res.status(400).json({
        success: false,
        message: "Invalid region specified"
      });
    }
    
    // Calculate distance from region center and filter
    const { center, radius } = regionBounds[region];
    
    // Simple filtering based on rough distance calculation
    // In a real implementation, use proper geospatial queries
    const conflicts = sampleConflictData.filter(conflict => {
      const [lon, lat] = conflict.coordinates;
      const [centerLon, centerLat] = center;
      
      // Simple distance calculation (not accurate for large distances but works for demonstration)
      const distance = Math.sqrt(
        Math.pow((lon - centerLon) * Math.cos((lat + centerLat) * Math.PI / 360), 2) + 
        Math.pow(lat - centerLat, 2)
      ) * 111; // Rough conversion to kilometers
      
      return distance <= radius;
    });
    
    res.json({
      success: true,
      data: conflicts
    });
  } catch (error) {
    console.error("Error fetching conflict data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch conflict data"
    });
  }
});

// Get conflicts by intensity level
router.get("/conflicts/intensity/:level", async (req: Request, res: Response) => {
  try {
    const level = parseInt(req.params.level);
    
    if (isNaN(level) || level < 1 || level > 10) {
      return res.status(400).json({
        success: false,
        message: "Invalid intensity level. Must be between 1 and 10."
      });
    }
    
    // Filter conflicts by intensity level
    const conflicts = sampleConflictData.filter(c => c.intensity >= level);
    
    res.json({
      success: true,
      data: conflicts
    });
  } catch (error) {
    console.error("Error fetching conflict data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch conflict data"
    });
  }
});

// Get conflicts by type
router.get("/conflicts/type/:type", async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    
    if (!['active', 'frozen', 'escalating', 'deescalating'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid conflict type. Must be 'active', 'frozen', 'escalating', or 'deescalating'."
      });
    }
    
    // Filter conflicts by type
    const conflicts = sampleConflictData.filter(c => c.type === type);
    
    res.json({
      success: true,
      data: conflicts
    });
  } catch (error) {
    console.error("Error fetching conflict data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch conflict data"
    });
  }
});

export default router;