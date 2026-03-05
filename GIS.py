import numpy as np
import matplotlib.pyplot as plt
import rasterio
from rasterio.plot import show

# ==============================================================================
# PART 1: AHP WEIGHT CALCULATION
# ==============================================================================
# These are the weights we calculated for Mymensingh in the previous step.
# Lithology is highest due to Madhupur Clay vs. Floodplain difference.

weights = {
    'lithology': 0.36,
    'rainfall': 0.24,
    'geomorphology': 0.17,
    'soil': 0.11,
    'lulc': 0.07,
    'drainage': 0.05
}

print("--- AHP Weights Loaded ---")
for key, val in weights.items():
    print(f"{key.capitalize()}: {val * 100}%")

# ==============================================================================
# PART 2: MOCK DATA GENERATOR (For Demonstration)
# ==============================================================================
# Since I cannot access your hard drive, I am creating 'fake' raster data 
# that mimics the Mymensingh area (100x100 pixels) so you can see the code work.
# ------------------------------------------------------------------------------

def create_mock_raster(name):
    """Generates a random 100x100 raster to simulate GIS layers."""
    # Create random data between 1 (Low potential) and 5 (High potential)
    data = np.random.randint(1, 6, size=(100, 100)).astype('float32')
    return data

print("\n--- Generating Mock Data for Mymensingh ---")
# In a real project, you would read these files using rasterio.open('file.tif')
lithology_layer = create_mock_raster('lithology')
rainfall_layer = create_mock_raster('rainfall')
geomorph_layer = create_mock_raster('geomorphology')
soil_layer = create_mock_raster('soil')
lulc_layer = create_mock_raster('lulc')
drainage_layer = create_mock_raster('drainage')

# ==============================================================================
# PART 3: THE GIS ANALYSIS (Weighted Overlay)
# ==============================================================================

def calculate_gwpz(lith, rain, geo, soil, lu, drain, w):
    """
    Performs the Weighted Linear Combination (WLC).
    Formula: GW_Potential = Σ (Factor_Rank * AHP_Weight)
    """
    gwpz = (
        (lith * w['lithology']) +
        (rain * w['rainfall']) +
        (geo * w['geomorphology']) +
        (soil * w['soil']) +
        (lu * w['lulc']) +
        (drain * w['drainage'])
    )
    return gwpz

# Run the calculation
print("Calculating Groundwater Potential Zones...")
final_map = calculate_gwpz(
    lithology_layer, rainfall_layer, geomorph_layer, 
    soil_layer, lulc_layer, drainage_layer, weights
)

# ==============================================================================
# PART 4: ZONING & VISUALIZATION
# ==============================================================================

# Define thresholds for zones (Very Low to Very High)
# This classifies the continuous output into 4 distinct zones
zones = np.zeros_like(final_map)
zones[final_map < 2.5] = 1        # Low
zones[(final_map >= 2.5) & (final_map < 3.5)] = 2 # Moderate
zones[(final_map >= 3.5) & (final_map < 4.5)] = 3 # High
zones[final_map >= 4.5] = 4       # Very High

# Plotting
plt.figure(figsize=(12, 8))
plt.title("Groundwater Potential Zones: Mymensingh District\n(Simulation)", fontsize=15)

# Use a color map: Red (Low) to Blue (High)
im = plt.imshow(zones, cmap='jet_r', interpolation='nearest') 

# Add a legend
cbar = plt.colorbar(im, ticks=[1, 2, 3, 4])
cbar.ax.set_yticklabels(['Low', 'Moderate', 'High', 'Very High']) 
cbar.set_label('Potentiality Index')

plt.xlabel('Longitude (Pixels)')
plt.ylabel('Latitude (Pixels)')
plt.show()

print("Process Complete. Map Generated.")
