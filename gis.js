// ============================================================================
// PROJECT: Groundwater Potential Zone (GWPZ) Mapping - Mymensingh
// AUTHOR: Gemini (for User)
// DEPT: Agricultural Engineering, BAU
// ============================================================================

// ----------------------------------------------------------------------------
// 1. DEFINE STUDY AREA (Mymensingh District)
// ----------------------------------------------------------------------------
// We use the FAO GAUL dataset to automatically get Mymensingh boundaries
var districts = ee.FeatureCollection("FAO/GAUL/2015/level2");
var roi = districts.filter(ee.Filter.eq('ADM2_NAME', 'Mymensingh'));

Map.centerObject(roi, 9);
Map.addLayer(roi, {color: 'black'}, 'Study Area (Mymensingh)', false);

// ----------------------------------------------------------------------------
// 2. DATA ACQUISITION & PROCESSING
// ----------------------------------------------------------------------------

// --- A. SLOPE (from SRTM DEM 30m) ---
var dem = ee.Image("USGS/SRTMGL1_003").clip(roi);
var slope = ee.Terrain.slope(dem);

// Reclassify Slope (Lower slope = Higher Potential)
// 0-2 deg (5), 2-5 deg (4), 5-10 deg (3), 10-20 deg (2), >20 deg (1)
var slopeRank = ee.Image(1)
    .where(slope.lte(2), 5)
    .where(slope.gt(2).and(slope.lte(5)), 4)
    .where(slope.gt(5).and(slope.lte(10)), 3)
    .where(slope.gt(10).and(slope.lte(20)), 2)
    .where(slope.gt(20), 1).clip(roi);

// --- B. RAINFALL (from CHIRPS Daily) ---
// Mean annual rainfall over the last 5 years
var rainfallCollection = ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY")
    .filterDate('2020-01-01', '2025-01-01');
var rainfall = rainfallCollection.sum().divide(5).clip(roi); // Yearly average

// Normalize Rainfall to 1-5 scale (Higher rain = Higher Potential)
var rainMin = rainfall.reduceRegion({reducer: ee.Reducer.min(), geometry: roi, scale: 5000}).get('precipitation');
var rainMax = rainfall.reduceRegion({reducer: ee.Reducer.max(), geometry: roi, scale: 5000}).get('precipitation');
var rainRank = rainfall.unitScale(ee.Number(rainMin), ee.Number(rainMax)).multiply(4).add(1);

// --- C. LAND USE / LAND COVER (ESA WorldCover) ---
var landcover = ee.Image("ESA/WorldCover/v100/2020").clip(roi);

// Reclassify LULC based on infiltration capability
// 10=Trees(4), 40=Cropland(5), 50=Built-up(1), 80=Water(5), 90=Wetland(5)
var lulcRank = landcover.remap(
  [10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 100], 
  [ 4,  3,  3,  5,  1,  2,  1,  5,  5,  2,   1] 
).rename('lulc_rank');

// --- D. DRAINAGE DENSITY PROXY (Distance to Surface Water) ---
// Closer to water bodies = High recharge potential
var waterMask = landcover.eq(80); 
var distanceToWater = waterMask.fastDistanceTransform().sqrt().multiply(10).clip(roi); // pixel scale approx

// Reclassify: Closer is better
var distRank = ee.Image(1)
    .where(distanceToWater.lte(1000), 5)
    .where(distanceToWater.gt(1000).and(distanceToWater.lte(3000)), 4)
    .where(distanceToWater.gt(3000).and(distanceToWater.lte(5000)), 3)
    .where(distanceToWater.gt(5000), 2);

// ----------------------------------------------------------------------------
// 3. AHP WEIGHTED OVERLAY
// ----------------------------------------------------------------------------
// Weights derived from your previous request:
// Note: We are using proxies for Lithology/Soil here using Slope/Drainage for the code to run without uploads.
// Adjusted Weights for this available data: 
// Rainfall: 35%, Slope: 20%, LULC: 25%, Drainage: 20%

var W_Rain = 0.35;
var W_Slope = 0.20;
var W_LULC = 0.25;
var W_Drain = 0.20;

var GWPZ = rainRank.multiply(W_Rain)
    .add(slopeRank.multiply(W_Slope))
    .add(lulcRank.multiply(W_LULC))
    .add(distRank.multiply(W_Drain));

// ----------------------------------------------------------------------------
// 4. ZONING & VISUALIZATION
// ----------------------------------------------------------------------------
// Define Zones based on the final calculated index
var zones = ee.Image(0)
    .where(GWPZ.gt(4), 4) // Very High
    .where(GWPZ.gt(3).and(GWPZ.lte(4)), 3) // High
    .where(GWPZ.gt(2).and(GWPZ.lte(3)), 2) // Moderate
    .where(GWPZ.lte(2), 1); // Low

var visParams = {
  min: 1,
  max: 4,
  palette: ['red', 'yellow', 'green', 'blue'] // Red=Low, Blue=Very High
};

Map.addLayer(slopeRank, {min:1, max:5}, 'Slope Rank', false);
Map.addLayer(rainRank, {min:1, max:5}, 'Rainfall Rank', false);
Map.addLayer(zones.clip(roi), visParams, 'Groundwater Potential Zones');

// ----------------------------------------------------------------------------
// 5. LEGEND & EXPORT
// ----------------------------------------------------------------------------
// Create a simple legend
var legend = ui.Panel({style: {position: 'bottom-right', padding: '8px 15px'}});
var legendTitle = ui.Label({value: 'GWPZ Legend', style: {fontWeight: 'bold'}});
legend.add(legendTitle);

var makeRow = function(color, name) {
  var colorBox = ui.Label({style: {backgroundColor: color, padding: '8px', margin: '0 0 4px 0'}});
  var description = ui.Label({value: name, style: {margin: '0 0 4px 6px'}});
  return ui.Panel({widgets: [colorBox, description], layout: ui.Panel.Layout.Flow('horizontal')});
};

legend.add(makeRow('blue', 'Very High Potential'));
legend.add(makeRow('green', 'High Potential'));
legend.add(makeRow('yellow', 'Moderate Potential'));
legend.add(makeRow('red', 'Low Potential'));
Map.add(legend);

print('Project Loaded Successfully. Check the Layers tab to toggle individual factors.');
