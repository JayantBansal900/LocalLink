import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCATIONS_FILE = path.join(__dirname, '..', 'data', 'locations.json');

function readLocations() {
  try {
    return JSON.parse(fs.readFileSync(LOCATIONS_FILE, 'utf8') || '[]');
  } catch (err) {
    console.error('Error reading locations file:', err);
    return [];
  }
}

// Known Indian City / District Centroids across all 18 supported states in locations.json
const KNOWN_CENTROIDS = [
  // Delhi
  { state: 'Delhi', district: 'Central Delhi', city: 'Connaught Place', pincode: '110001', lat: 28.6304, lon: 77.2177 },
  { state: 'Delhi', district: 'New Delhi', city: 'Chanakyapuri', pincode: '110003', lat: 28.6139, lon: 77.2090 },
  { state: 'Delhi', district: 'South Delhi', city: 'Hauz Khas', pincode: '110016', lat: 28.5355, lon: 77.2100 },
  { state: 'Delhi', district: 'West Delhi', city: 'Janakpuri', pincode: '110058', lat: 28.6366, lon: 77.0968 },
  { state: 'Delhi', district: 'North Delhi', city: 'Civil Lines', pincode: '110054', lat: 28.7041, lon: 77.1025 },

  // Maharashtra
  { state: 'Maharashtra', district: 'Mumbai', city: 'Andheri', pincode: '400053', lat: 19.0760, lon: 72.8777 },
  { state: 'Maharashtra', district: 'Pune', city: 'Kothrud', pincode: '411038', lat: 18.5204, lon: 73.8567 },
  { state: 'Maharashtra', district: 'Nagpur', city: 'Dharampeth', pincode: '440010', lat: 21.1458, lon: 79.0882 },
  { state: 'Maharashtra', district: 'Thane', city: 'Thane West', pincode: '400601', lat: 19.2183, lon: 72.9781 },

  // Karnataka
  { state: 'Karnataka', district: 'Bengaluru Urban', city: 'Koramangala', pincode: '560034', lat: 12.9716, lon: 77.5946 },
  { state: 'Karnataka', district: 'Mysuru', city: 'Gokulam', pincode: '570002', lat: 12.2958, lon: 76.6394 },
  { state: 'Karnataka', district: 'Dakshina Kannada', city: 'Mangaluru City', pincode: '575001', lat: 12.9141, lon: 74.8560 },

  // Telangana
  { state: 'Telangana', district: 'Hyderabad', city: 'Madhapur', pincode: '500081', lat: 17.3850, lon: 78.4867 },
  { state: 'Telangana', district: 'Warangal', city: 'Hanamkonda', pincode: '506001', lat: 17.9689, lon: 79.5941 },

  // Tamil Nadu
  { state: 'Tamil Nadu', district: 'Chennai', city: 'T Nagar', pincode: '600017', lat: 13.0827, lon: 80.2707 },
  { state: 'Tamil Nadu', district: 'Coimbatore', city: 'RS Puram', pincode: '641002', lat: 11.0168, lon: 76.9558 },
  { state: 'Tamil Nadu', district: 'Madurai', city: 'Anna Nagar', pincode: '625020', lat: 9.9252, lon: 78.1198 },

  // Andhra Pradesh
  { state: 'Andhra Pradesh', district: 'Guntur', city: 'Amaravati', pincode: '522020', lat: 16.5131, lon: 80.5165 },
  { state: 'Andhra Pradesh', district: 'Visakhapatnam', city: 'MVP Colony', pincode: '530017', lat: 17.6868, lon: 83.2185 },
  { state: 'Andhra Pradesh', district: 'Krishna', city: 'Vijayawada', pincode: '520010', lat: 16.5062, lon: 80.6480 },

  // Gujarat
  { state: 'Gujarat', district: 'Ahmedabad', city: 'Navrangpura', pincode: '380009', lat: 23.0225, lon: 72.5714 },
  { state: 'Gujarat', district: 'Surat', city: 'Adajan', pincode: '395009', lat: 21.1702, lon: 72.8311 },
  { state: 'Gujarat', district: 'Vadodara', city: 'Alkapuri', pincode: '390007', lat: 22.3072, lon: 73.1812 },

  // Rajasthan
  { state: 'Rajasthan', district: 'Jaipur', city: 'Malviya Nagar', pincode: '302017', lat: 26.9124, lon: 75.7873 },
  { state: 'Rajasthan', district: 'Jodhpur', city: 'Ratanada', pincode: '342011', lat: 26.2389, lon: 73.0243 },
  { state: 'Rajasthan', district: 'Udaipur', city: 'Fatehpura', pincode: '313001', lat: 24.5854, lon: 73.7125 },

  // Uttar Pradesh
  { state: 'Uttar Pradesh', district: 'Lucknow', city: 'Gomti Nagar', pincode: '226010', lat: 26.8467, lon: 80.9462 },
  { state: 'Uttar Pradesh', district: 'Gautam Buddha Nagar', city: 'Noida Sector 62', pincode: '201309', lat: 28.5355, lon: 77.3910 },
  { state: 'Uttar Pradesh', district: 'Kanpur Nagar', city: 'Civil Lines', pincode: '208001', lat: 26.4499, lon: 80.3319 },
  { state: 'Uttar Pradesh', district: 'Varanasi', city: 'Lanka', pincode: '221005', lat: 25.3176, lon: 82.9739 },

  // West Bengal
  { state: 'West Bengal', district: 'Kolkata', city: 'Salt Lake', pincode: '700091', lat: 22.5726, lon: 88.3639 },
  { state: 'West Bengal', district: 'Howrah', city: 'Shibpur', pincode: '711102', lat: 22.5958, lon: 88.2636 },

  // Kerala
  { state: 'Kerala', district: 'Ernakulam', city: 'Kochi', pincode: '682001', lat: 9.9312, lon: 76.2673 },
  { state: 'Kerala', district: 'Thiruvananthapuram', city: 'Kowdiar', pincode: '695003', lat: 8.5241, lon: 76.9366 },

  // Madhya Pradesh
  { state: 'Madhya Pradesh', district: 'Indore', city: 'Vijay Nagar', pincode: '452010', lat: 22.7196, lon: 75.8577 },
  { state: 'Madhya Pradesh', district: 'Bhopal', city: 'Arera Colony', pincode: '462016', lat: 23.2599, lon: 77.4126 },

  // Odisha
  { state: 'Odisha', district: 'Khurda', city: 'Bhubaneswar', pincode: '751001', lat: 20.2961, lon: 85.8245 },
  { state: 'Odisha', district: 'Cuttack', city: 'Badambadi', pincode: '753012', lat: 20.4625, lon: 85.8830 },

  // Punjab
  { state: 'Punjab', district: 'Ludhiana', city: 'Model Town', pincode: '141002', lat: 30.9010, lon: 75.8573 },
  { state: 'Punjab', district: 'Amritsar', city: 'Ranjit Avenue', pincode: '143001', lat: 31.6340, lon: 74.8723 },

  // Haryana
  { state: 'Haryana', district: 'Gurugram', city: 'Cyber City', pincode: '122002', lat: 28.4595, lon: 77.0266 },
  { state: 'Haryana', district: 'Faridabad', city: 'Sector 15', pincode: '121007', lat: 28.4089, lon: 77.3178 },

  // Bihar
  { state: 'Bihar', district: 'Patna', city: 'Boring Road', pincode: '800001', lat: 25.5941, lon: 85.1376 },
  { state: 'Bihar', district: 'Gaya', city: 'Civil Lines', pincode: '823001', lat: 24.7955, lon: 85.0002 },

  // Uttarakhand
  { state: 'Uttarakhand', district: 'Dehradun', city: 'Rajpur Road', pincode: '248001', lat: 30.3165, lon: 78.0322 },
  { state: 'Uttarakhand', district: 'Haridwar', city: 'Ranipur', pincode: '249401', lat: 29.9457, lon: 78.1642 },

  // Assam
  { state: 'Assam', district: 'Kamrup Metropolitan', city: 'Guwahati', pincode: '781001', lat: 26.1445, lon: 91.7362 },
  { state: 'Assam', district: 'Dibrugarh', city: 'Graham Bazaar', pincode: '786001', lat: 27.4728, lon: 94.9120 }
];

function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const locationService = {
  getAll: () => {
    return readLocations();
  },

  getStates: () => {
    const list = readLocations();
    return list.map(l => l.state);
  },

  getDistrictsByState: (stateName) => {
    if (!stateName) return [];
    const list = readLocations();
    const found = list.find(l => l.state.toLowerCase() === stateName.toLowerCase().trim());
    return found ? found.districts.map(d => d.name) : [];
  },

  getCities: (stateName, districtName) => {
    const list = readLocations();
    if (!stateName) return [];
    const foundState = list.find(l => l.state.toLowerCase() === stateName.toLowerCase().trim());
    if (!foundState) return [];

    if (districtName) {
      const foundDistrict = foundState.districts.find(d => d.name.toLowerCase() === districtName.toLowerCase().trim());
      return foundDistrict ? foundDistrict.cities : [];
    }

    // All cities in state
    const allCities = [];
    foundState.districts.forEach(d => {
      allCities.push(...d.cities);
    });
    return [...new Set(allCities)];
  },

  getPincodes: (stateName, districtName, cityName) => {
    const list = readLocations();
    if (!stateName) {
      // Return top pincodes
      const all = [];
      list.forEach(s => s.districts.forEach(d => all.push(...d.pincodes)));
      return [...new Set(all)];
    }

    const foundState = list.find(l => l.state.toLowerCase() === stateName.toLowerCase().trim());
    if (!foundState) return [];

    if (districtName) {
      const foundDistrict = foundState.districts.find(d => d.name.toLowerCase() === districtName.toLowerCase().trim());
      return foundDistrict ? foundDistrict.pincodes : [];
    }

    const statePincodes = [];
    foundState.districts.forEach(d => statePincodes.push(...d.pincodes));
    return [...new Set(statePincodes)];
  },

  /**
   * Resolves GPS latitude and longitude into an authentic Indian State, District, City, and Pincode.
   * Multi-tiered strategy:
   * 1. Validates geographic envelope to ensure coordinates are inside India.
   * 2. Attempts reverse geocoding via OpenStreetMap Nominatim.
   * 3. Falls back gracefully to India centroid distance calculation against known locations.
   */
  resolveCoordinates: async (lat, lon) => {
    if (typeof lat !== 'number' || isNaN(lat) || typeof lon !== 'number' || isNaN(lon)) {
      return {
        success: false,
        message: 'Invalid geographic coordinates provided.'
      };
    }

    // India geographic envelope: lat ~6.0 to 38.0, lon ~68.0 to 98.0
    if (lat < 6.0 || lat > 38.0 || lon < 68.0 || lon > 98.0) {
      return {
        success: false,
        inIndia: false,
        message: 'Detected coordinates are outside India. LocalLink currently operates across India. Please select your location manually.'
      };
    }

    const locations = readLocations();

    // 1. Attempt real reverse geocoding via OpenStreetMap Nominatim with 2500ms timeout
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=jsonv2`, {
        headers: { 'User-Agent': 'LocalLink-Civic-Platform/1.0' },
        signal: AbortSignal.timeout(2500)
      });
      if (res.ok) {
        const data = await res.json();
        const addr = data.address || {};
        const countryCode = (addr.country_code || '').toLowerCase();

        if (countryCode && countryCode !== 'in') {
          return {
            success: false,
            inIndia: false,
            message: 'Detected coordinates are outside India. LocalLink currently operates across India. Please select your location manually.'
          };
        }

        const rawState = addr.state || '';
        const rawDistrict = addr.state_district || addr.county || '';
        const rawCity = addr.city || addr.town || addr.municipality || addr.suburb || addr.neighbourhood || '';
        const rawPincode = addr.postcode || '';

        // Match state against locations.json
        const matchedState = locations.find(l =>
          l.state.toLowerCase() === rawState.toLowerCase() ||
          rawState.toLowerCase().includes(l.state.toLowerCase()) ||
          l.state.toLowerCase().includes(rawState.toLowerCase())
        );

        if (matchedState) {
          let matchedDistrict = null;
          if (rawDistrict) {
            matchedDistrict = matchedState.districts.find(d =>
              d.name.toLowerCase() === rawDistrict.toLowerCase() ||
              rawDistrict.toLowerCase().includes(d.name.toLowerCase()) ||
              d.name.toLowerCase().includes(rawDistrict.toLowerCase())
            );
          }

          let matchedCity = null;
          if (matchedDistrict && rawCity) {
            matchedCity = matchedDistrict.cities.find(c =>
              c.toLowerCase() === rawCity.toLowerCase() ||
              rawCity.toLowerCase().includes(c.toLowerCase()) ||
              c.toLowerCase().includes(rawCity.toLowerCase())
            );
          } else if (!matchedDistrict && rawCity) {
            for (const d of matchedState.districts) {
              const c = d.cities.find(city =>
                city.toLowerCase() === rawCity.toLowerCase() ||
                rawCity.toLowerCase().includes(city.toLowerCase()) ||
                city.toLowerCase().includes(rawCity.toLowerCase())
              );
              if (c) {
                matchedCity = c;
                matchedDistrict = d;
                break;
              }
            }
          }

          const finalDistrict = matchedDistrict ? matchedDistrict.name : matchedState.districts[0].name;
          const distObj = matchedState.districts.find(d => d.name === finalDistrict);
          const finalCity = matchedCity || (distObj ? distObj.cities[0] : (rawCity || 'Local Area'));
          const finalPincode = rawPincode || (distObj && distObj.pincodes ? distObj.pincodes[0] : '');

          return {
            success: true,
            inIndia: true,
            state: matchedState.state,
            district: finalDistrict,
            city: finalCity,
            pincode: finalPincode,
            formatted: `${finalCity}, ${matchedState.state}`,
            source: 'reverse-geocoded'
          };
        }
      }
    } catch (e) {
      // Fall through to centroid calculation
    }

    // 2. Safe Fallback: Calculate nearest Indian location centroid
    let closest = null;
    let minDistance = Infinity;

    for (const c of KNOWN_CENTROIDS) {
      const dist = haversineDistanceKm(lat, lon, c.lat, c.lon);
      if (dist < minDistance) {
        minDistance = dist;
        closest = c;
      }
    }

    if (closest) {
      return {
        success: true,
        inIndia: true,
        state: closest.state,
        district: closest.district,
        city: closest.city,
        pincode: closest.pincode,
        formatted: `${closest.city}, ${closest.state}`,
        distanceKm: Math.round(minDistance),
        source: 'centroid-fallback'
      };
    }

    return {
      success: false,
      message: 'Unable to resolve coordinates to an Indian location. Please select manually.'
    };
  }
};
