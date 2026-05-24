// Bengaluru Zone Manager - Geographic Data
// Boundary: approximate BBMP / Greater Bengaluru polygon outline (irregular, real-shape inspired)
// Pincodes: ~95 active Bengaluru pincodes with area name + approx centroid + main zone

// Bengaluru outer boundary polygon (clockwise) - irregular, NOT a circle/rectangle
// Coordinates as [lng, lat] (GeoJSON convention)
const BENGALURU_BOUNDARY = {
  type: "Feature",
  properties: { name: "Bengaluru" },
  geometry: {
    type: "Polygon",
    coordinates: [[
      // North - Yelahanka / airport-side bulge
      [77.585, 13.165], [77.605, 13.160], [77.625, 13.150], [77.645, 13.135],
      // North-east - Hennur / Hoskote direction
      [77.670, 13.115], [77.695, 13.090], [77.715, 13.060], [77.735, 13.030],
      // East - Whitefield bulge (extends further east)
      [77.760, 13.005], [77.778, 12.985], [77.785, 12.960], [77.778, 12.935],
      // South-east - Electronic City corridor (extends south)
      [77.755, 12.910], [77.730, 12.880], [77.705, 12.850], [77.685, 12.820],
      // South - Bommasandra / Anekal border
      [77.660, 12.805], [77.630, 12.810], [77.600, 12.825], [77.575, 12.840],
      // South-west - Bannerghatta / Kanakapura side
      [77.545, 12.855], [77.515, 12.870], [77.490, 12.885],
      // West - Kengeri / Mysore Road extends west
      [77.465, 12.905], [77.450, 12.930], [77.450, 12.955], [77.460, 12.980],
      // North-west - Peenya / Tumkur Road
      [77.480, 13.010], [77.495, 13.040], [77.510, 13.075], [77.525, 13.105],
      // Back up north
      [77.545, 13.130], [77.560, 13.145], [77.575, 13.158],
      // Close
      [77.585, 13.165]
    ]]
  }
};

// Five main zones - macro grouping
const MAIN_ZONES = [
  { id: "central", name: "Central Zone", color: "#f59e0b" },
  { id: "north",   name: "North Zone",   color: "#3b82f6" },
  { id: "south",   name: "South Zone",   color: "#10b981" },
  { id: "east",    name: "East Zone",    color: "#ef4444" },
  { id: "west",    name: "West Zone",    color: "#a855f7" }
];

// Pincode dataset - {code, area, lat, lng, zone}
const PINCODES = [
  // ---------- CENTRAL ----------
  { code: "560001", area: "Bangalore GPO",          lat: 12.9776, lng: 77.5713, zone: "central" },
  { code: "560002", area: "Chickpet",               lat: 12.9684, lng: 77.5750, zone: "central" },
  { code: "560009", area: "Bangalore City",         lat: 12.9750, lng: 77.5700, zone: "central" },
  { code: "560014", area: "Aramane Nagar",          lat: 12.9930, lng: 77.5790, zone: "central" },
  { code: "560020", area: "Sheshadripuram",         lat: 12.9920, lng: 77.5780, zone: "central" },
  { code: "560021", area: "Kumara Park",            lat: 12.9890, lng: 77.5800, zone: "central" },
  { code: "560025", area: "Richmond Town",          lat: 12.9620, lng: 77.6000, zone: "central" },
  { code: "560027", area: "Shanti Nagar",           lat: 12.9580, lng: 77.6000, zone: "central" },
  { code: "560030", area: "K. G. Road",             lat: 12.9760, lng: 77.5800, zone: "central" },
  { code: "560042", area: "M. G. Road",             lat: 12.9750, lng: 77.6080, zone: "central" },
  { code: "560047", area: "Wilson Garden",          lat: 12.9550, lng: 77.5950, zone: "central" },
  { code: "560051", area: "Halasuru (Ulsoor)",      lat: 12.9810, lng: 77.6230, zone: "central" },
  { code: "560052", area: "Race Course Road",       lat: 12.9890, lng: 77.5870, zone: "central" },
  { code: "560053", area: "Kempegowda",             lat: 12.9780, lng: 77.5660, zone: "central" },
  { code: "560055", area: "Vasanth Nagar",          lat: 12.9890, lng: 77.5950, zone: "central" },
  { code: "560084", area: "Bharathi Nagar",         lat: 12.9870, lng: 77.6160, zone: "central" },

  // ---------- NORTH ----------
  { code: "560003", area: "Malleswaram",            lat: 13.0030, lng: 77.5640, zone: "north" },
  { code: "560007", area: "Hebbal",                 lat: 13.0350, lng: 77.5970, zone: "north" },
  { code: "560012", area: "IISc Campus",            lat: 13.0210, lng: 77.5680, zone: "north" },
  { code: "560013", area: "Yeshwanthpur",           lat: 13.0270, lng: 77.5560, zone: "north" },
  { code: "560015", area: "HMT Layout",             lat: 13.0410, lng: 77.5730, zone: "north" },
  { code: "560022", area: "Mathikere",              lat: 13.0340, lng: 77.5560, zone: "north" },
  { code: "560024", area: "Ganganagar",             lat: 13.0250, lng: 77.5950, zone: "north" },
  { code: "560026", area: "Vidyaranyapura",         lat: 13.0810, lng: 77.5550, zone: "north" },
  { code: "560032", area: "HRBR Layout",            lat: 13.0200, lng: 77.6300, zone: "north" },
  { code: "560043", area: "Banaswadi",              lat: 13.0200, lng: 77.6470, zone: "north" },
  { code: "560045", area: "Hebbal Kempapura",       lat: 13.0500, lng: 77.5920, zone: "north" },
  { code: "560046", area: "Nagavara",               lat: 13.0420, lng: 77.6190, zone: "north" },
  { code: "560049", area: "Sahakara Nagar",         lat: 13.0700, lng: 77.5850, zone: "north" },
  { code: "560054", area: "Yelahanka New Town",     lat: 13.1010, lng: 77.5960, zone: "north" },
  { code: "560057", area: "JC Nagar",               lat: 13.0140, lng: 77.6080, zone: "north" },
  { code: "560063", area: "Yelahanka Town",         lat: 13.1170, lng: 77.5810, zone: "north" },
  { code: "560064", area: "Singapura Village",      lat: 13.0830, lng: 77.5500, zone: "north" },
  { code: "560065", area: "GKVK",                   lat: 13.0760, lng: 77.5700, zone: "north" },
  { code: "560077", area: "Kothanur",               lat: 13.0610, lng: 77.6510, zone: "north" },
  { code: "560080", area: "Sadashivanagar",         lat: 13.0050, lng: 77.5830, zone: "north" },
  { code: "560092", area: "Hennur",                 lat: 13.0420, lng: 77.6460, zone: "north" },
  { code: "560094", area: "Sanjay Nagar",           lat: 13.0340, lng: 77.5810, zone: "north" },
  { code: "560097", area: "Vidyaranyapura West",    lat: 13.0790, lng: 77.5470, zone: "north" },
  { code: "560106", area: "Jakkur",                 lat: 13.0790, lng: 77.6090, zone: "north" },

  // ---------- EAST ----------
  { code: "560005", area: "Frazer Town",            lat: 12.9970, lng: 77.6160, zone: "east" },
  { code: "560006", area: "HAL II Stage",           lat: 12.9620, lng: 77.6680, zone: "east" },
  { code: "560008", area: "Indiranagar",            lat: 12.9710, lng: 77.6410, zone: "east" },
  { code: "560016", area: "Krishnarajapuram",       lat: 13.0080, lng: 77.7000, zone: "east" },
  { code: "560017", area: "Vimanapura",             lat: 12.9610, lng: 77.6660, zone: "east" },
  { code: "560033", area: "C. V. Raman Nagar",      lat: 12.9870, lng: 77.6700, zone: "east" },
  { code: "560036", area: "HAL Airport Old",        lat: 12.9700, lng: 77.6770, zone: "east" },
  { code: "560037", area: "Marathahalli",           lat: 12.9550, lng: 77.7010, zone: "east" },
  { code: "560038", area: "Domlur",                 lat: 12.9620, lng: 77.6380, zone: "east" },
  { code: "560039", area: "Lingarajapuram",         lat: 13.0080, lng: 77.6260, zone: "east" },
  { code: "560048", area: "Whitefield North",       lat: 12.9820, lng: 77.7370, zone: "east" },
  { code: "560066", area: "Whitefield",             lat: 12.9690, lng: 77.7500, zone: "east" },
  { code: "560067", area: "Hoodi",                  lat: 12.9930, lng: 77.7170, zone: "east" },
  { code: "560075", area: "Bhattarahalli",          lat: 13.0020, lng: 77.7240, zone: "east" },
  { code: "560087", area: "Kadugodi",               lat: 12.9930, lng: 77.7530, zone: "east" },
  { code: "560093", area: "Kasturi Nagar",          lat: 12.9950, lng: 77.6590, zone: "east" },
  { code: "560096", area: "Doddanekkundi",          lat: 12.9750, lng: 77.7100, zone: "east" },
  { code: "560103", area: "Brookefield",            lat: 12.9650, lng: 77.7180, zone: "east" },
  { code: "560109", area: "Carmelaram",             lat: 12.9230, lng: 77.7050, zone: "east" },

  // ---------- SOUTH ----------
  { code: "560004", area: "Basavanagudi",           lat: 12.9420, lng: 77.5750, zone: "south" },
  { code: "560011", area: "Jayanagar",              lat: 12.9290, lng: 77.5830, zone: "south" },
  { code: "560018", area: "Chamarajpet",            lat: 12.9550, lng: 77.5670, zone: "south" },
  { code: "560019", area: "Gavipuram Extension",    lat: 12.9420, lng: 77.5630, zone: "south" },
  { code: "560029", area: "Bommanahalli",           lat: 12.9020, lng: 77.6200, zone: "south" },
  { code: "560034", area: "Koramangala",            lat: 12.9350, lng: 77.6240, zone: "south" },
  { code: "560035", area: "Bellandur",              lat: 12.9300, lng: 77.6780, zone: "south" },
  { code: "560041", area: "Banashankari",           lat: 12.9250, lng: 77.5470, zone: "south" },
  { code: "560050", area: "Banashankari II Stage",  lat: 12.9210, lng: 77.5550, zone: "south" },
  { code: "560061", area: "Banashankari III",       lat: 12.9050, lng: 77.5440, zone: "south" },
  { code: "560062", area: "Anjanapura",             lat: 12.8780, lng: 77.5570, zone: "south" },
  { code: "560068", area: "HSR Layout",             lat: 12.9120, lng: 77.6380, zone: "south" },
  { code: "560069", area: "BTM Layout",             lat: 12.9170, lng: 77.6100, zone: "south" },
  { code: "560070", area: "Banashankari I",         lat: 12.9320, lng: 77.5550, zone: "south" },
  { code: "560071", area: "Adugodi",                lat: 12.9430, lng: 77.6080, zone: "south" },
  { code: "560074", area: "JP Nagar 6th Phase",     lat: 12.9020, lng: 77.5680, zone: "south" },
  { code: "560076", area: "Bilekahalli",            lat: 12.8950, lng: 77.5970, zone: "south" },
  { code: "560078", area: "JP Nagar",               lat: 12.9050, lng: 77.5850, zone: "south" },
  { code: "560083", area: "Begur",                  lat: 12.8780, lng: 77.6240, zone: "south" },
  { code: "560085", area: "Girinagar",              lat: 12.9320, lng: 77.5520, zone: "south" },
  { code: "560095", area: "Koramangala VIII",       lat: 12.9320, lng: 77.6260, zone: "south" },
  { code: "560099", area: "Electronic City",        lat: 12.8450, lng: 77.6610, zone: "south" },
  { code: "560100", area: "Electronic City Phase II", lat: 12.8300, lng: 77.6770, zone: "south" },
  { code: "560102", area: "HSR Sector 7",           lat: 12.9030, lng: 77.6520, zone: "south" },
  { code: "560108", area: "Bommasandra",            lat: 12.8190, lng: 77.6900, zone: "south" },

  // ---------- WEST ----------
  { code: "560010", area: "Rajajinagar",            lat: 12.9870, lng: 77.5560, zone: "west" },
  { code: "560023", area: "Magadi Road",            lat: 12.9740, lng: 77.5400, zone: "west" },
  { code: "560040", area: "Vijayanagar",            lat: 12.9700, lng: 77.5350, zone: "west" },
  { code: "560056", area: "Kengeri",                lat: 12.9080, lng: 77.4830, zone: "west" },
  { code: "560058", area: "Peenya",                 lat: 13.0270, lng: 77.5180, zone: "west" },
  { code: "560059", area: "Subramanyapura",         lat: 12.9090, lng: 77.5460, zone: "west" },
  { code: "560060", area: "Kumbalgodu",             lat: 12.9050, lng: 77.4480, zone: "west" },
  { code: "560072", area: "Vijayanagar West",       lat: 12.9710, lng: 77.5260, zone: "west" },
  { code: "560073", area: "Sunkadakatte",           lat: 12.9970, lng: 77.5050, zone: "west" },
  { code: "560079", area: "Bagalakunte",            lat: 13.0410, lng: 77.5260, zone: "west" },
  { code: "560086", area: "Mahalakshmipuram",       lat: 13.0040, lng: 77.5340, zone: "west" },
  { code: "560089", area: "Ittamadu",               lat: 12.9220, lng: 77.5350, zone: "west" },
  { code: "560090", area: "Chikkabanavara",         lat: 13.0570, lng: 77.4960, zone: "west" },
  { code: "560091", area: "Hampinagar",             lat: 12.9530, lng: 77.5260, zone: "west" },
  { code: "560098", area: "Kengeri Satellite Town", lat: 12.8990, lng: 77.5040, zone: "west" },
  { code: "560104", area: "Doddabidarakallu",       lat: 13.0500, lng: 77.5050, zone: "west" }
];

// Geographic city centre - used for radius / "exceeds 10 km" checks against the city heart
const CITY_CENTRE = { lat: 12.9716, lng: 77.5946 };

// Operational radius limit (km) - the 10 km serving radius
const RADIUS_LIMIT_KM = 10;

// Expose globals
window.BZM_DATA = {
  BENGALURU_BOUNDARY,
  MAIN_ZONES,
  PINCODES,
  CITY_CENTRE,
  RADIUS_LIMIT_KM
};
