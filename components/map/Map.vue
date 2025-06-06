<script lang="ts" setup>
import { ref, provide, watch } from "vue";
import { Map, Layers, Sources, Geometries, Styles, MapControls, Interactions, type Vue3OpenlayersGlobalOptions } from "vue3-openlayers";
import type Feature from "ol/Feature";
import { GeoJSON, WKT } from "ol/format";
import { bbox } from "ol/loadingstrategy";
import { pointerMove, click } from "ol/events/condition";
import { getCenter, type Extent } from "ol/extent";
import { SelectEvent } from "ol/interaction/Select";
import { mapLayerStyles, drawStyle, hoverStyle } from "./mapstyles.ts";
import 'vue3-openlayers/dist/vue3-openlayers.css';

const props = defineProps({
    center: {
        type: Array as () => number[],
        default: () => [133.7751, -25.2744]
    },
    zoom: {
        type: Number,
        default: 4
    },
    rotation: {
        type: Number,
        default: 0
    },
    projection: {
        type: String,
        default: 'EPSG:4326'
    },
    focusSourceRef: {
        type: typeof Sources.OlSourceVector,
        default: null
    },
    layers: {
        type: Array,
        default: () => []
    },
    loading: {
        type: Boolean,
        default: false
    },
    drawEnabled: {
        type: Boolean,
        default: false
    }
});
const emit = defineEmits(['drawstart', 'drawend', 'select', 'hover'])

const loading = ref(props.loading);
watch(() => props.loading, (newVal) => { loading.value = newVal; }, { immediate:true });

const zoom = ref(props.zoom);
watch(() => props.zoom, (newVal) => { zoom.value = newVal; }, { immediate:true });
const center = ref(props.center);
watch(() => props.center, (newVal) => { center.value = newVal; }, { immediate:true });
const rotation = ref(props.rotation);
watch(() => props.rotation, (newVal) => { rotation.value = newVal; }, { immediate:true });

const currentZoom = ref(zoom.value);
const currentCenter = ref(center.value);
const currentRotation = ref(rotation.value);
function resolutionChanged(event) {
  currentZoom.value = event.target.getZoom();
  emit('change:zoom', currentZoom.value);
}
function centerChanged(event) {
  currentCenter.value = event.target.getCenter();
  emit('change:center', currentCenter.value);
}
function rotationChanged(event) {
  currentRotation.value = event.target.getRotation();
  emit('change:rotation', currentRotation.value);
}

let processedLayers = ref<any[]>([]);
const wktFormat = new WKT();
const geoJSONFormat = new GeoJSON();

watch(
    () => props.layers,
    (newVal) => {
        let newProcessedLayers = [];
        for (const layer of newVal) {
            // check all features for WKT geometry and translate it to GeoJSON
            const features = layer.features;
            const geoJSONFeatures = [];
            for (const feature of features) {
                let geoJSONFeature = {};
                if (feature.geoJSON) {
                    geoJSONFeature = geoJSONFormat.readFeature(feature.geoJSON, props.projection)
                } else if (feature.wkt) {
                    geoJSONFeature = wktFormat.readFeature(feature.wkt, props.projection)
                }
                geoJSONFeature.name = feature.name;
                geoJSONFeatures.push(geoJSONFeature);
            }
            layer.geoJSONFeatures = geoJSONFeatures;
            newProcessedLayers.push(layer);
        }
        processedLayers.value = newProcessedLayers;
    },
    {
        immediate: true
    }
);

const options: Vue3OpenlayersGlobalOptions = {
    debug: false,
};

provide("ol-options", options);

const hoveredFeature = ref<Feature | null>(null);
const selectedFeature = ref<Feature | null>(null);
const selectedPosition = ref<number[]>([]);

const mapRef = ref<InstanceType<typeof Map.OlMap> | null>(null);
const viewRef = ref<InstanceType<typeof Map.OlView> | null>(null);
const clickSelectRef = ref<InstanceType<typeof Interactions.OlInteractionSelect> | null>(null);
const drawSourceRef = ref<InstanceType<typeof Sources.OlSourceVector> | null>(null);

function featureHover(e: SelectEvent) {
    let selection = null;
    if (e.selected.length === 1) {
        selection = e.selected[0];
        hoveredFeature.value = e.selected[0];
    } else {
        hoveredFeature.value = null;
    }
    if (selection) {
      emit('hover', selection);
    }
}

function featureClick(e: SelectEvent) {
    let selection = null;
    if (e.selected.length === 1) {
        selectedFeature.value = e.selected[0];
        selection = getCenter(e.selected[0].getGeometry()!.getExtent());
        selectedPosition.value = getCenter(e.selected[0].getGeometry()!.getExtent());
    } else {
        selectedFeature.value = null;
    }
    if (selection) {
      emit('select', selection);
    }
}

const drawEnabled = ref(props.drawEnabled);
const drawType = ref('Polygon');
watch(() => props.drawEnabled, (newVal) => { drawEnabled.value = newVal; }, { immediate:true });

const drawModeEnabled = ref(drawEnabled.value);

function enableDrawMode () {
  drawModeEnabled.value = !drawModeEnabled.value;
}

const drawnFeatures : any[] = ref([]);

const drawstart = (event) => {
    emit('drawstart', geoJSONFormat.writeFeature(event.feature, props.projection));
};

const drawToggle = useTemplateRef('drawToggle');

const drawend = (event) => {
    const geoJSON = geoJSONFormat.writeFeature(event.feature, props.projection)
    const wkt = wktFormat.writeFeature(event.feature, props.projection)
    drawnFeatures.value.push(event.feature);
    emit('drawend', { geoJSON, wkt });
    drawModeEnabled.value = false;
};

const clearDrawings = () => {
    if (drawSourceRef.value) {
        let s = drawSourceRef.value.source;
        for (const drawnFeature of drawnFeatures.value) {
            s.removeFeature(drawnFeature);
        }
    }
    drawnFeatures.value = [];
}

const clearAll = () => {
    processedLayers.value = [];
    if (drawSourceRef.value) {
        let s = drawSourceRef.value.source;
        for (const drawnFeature of drawnFeatures.value) {
            s.removeFeature(drawnFeature);
        }
    }
    drawnFeatures.value = [];
};
</script>

<template>
    <div class="kai-map" ref="mapRef">
        <Map.OlMap
            :loadTilesWhileAnimating="true"
            :loadTilesWhileInteracting="true"
            style="height: 100%; width: 100%; min-height: 400px; min-width: 400px;">
            <Map.OlView ref="viewRef"
              :projection="props.projection"
              :center="center"
              :rotation="rotation"
              :zoom="zoom"
              @change:center="centerChanged"
              @change:resolution="resolutionChanged"
              @change:rotation="rotationChanged"
              />

            <!-- base maps -->
            <Layers.OlTileLayer title="OpenStreetMap" :visible="true" :displayInLayerSwitcher="false">
                <Sources.OlSourceOsm />
            </Layers.OlTileLayer>

            <!-- layers -->
            <Layers.OlVectorLayer v-for="layer in processedLayers" :title="layer.title" :visible="true">
                <Sources.OlSourceVector
                    :features="layer.geoJSONFeatures"
                    format="geoJSON"
                >
                </Sources.OlSourceVector>
                <Styles.OlStyle>
                    <Styles.OlStyleStroke :color="layer.strokeColor || drawStyle.strokeColor" :width="layer.strokeWidth || drawStyle.strokeWidth"></Styles.OlStyleStroke>
                    <Styles.OlStyleFill :color="layer.fillColor || drawStyle.fillColor"></Styles.OlStyleFill>
                    <Styles.OlStyleCircle :radius="layer.radius || drawStyle.radius">
                      <Styles.OlStyleFill :color="layer.circleColor || drawStyle.circleColor"></Styles.OlStyleFill>
                    </Styles.OlStyleCircle>
                </Styles.OlStyle>
            </Layers.OlVectorLayer>

            <Layers.OlVectorLayer :displayInLayerSwitcher="false">
                <Sources.OlSourceVector :projection="props.projection" ref="drawSourceRef">
                    <Interactions.OlInteractionDraw
                        v-if="drawModeEnabled"
                        :type="drawType"
                        @drawend="drawend"
                        @drawstart="drawstart"
                    >
                        <Styles.OlStyle>
                            <Styles.OlStyleStroke color="blue" :width="2"></Styles.OlStyleStroke>
                            <Styles.OlStyleFill color="rgba(255, 255, 0, 0.4)"></Styles.OlStyleFill>
                            <Styles.OlStyleCircle :radius="5">
                                <Styles.OlStyleFill color="#00dd11" />
                                <Styles.OlStyleStroke color="blue" :width="2" />
                            </Styles.OlStyleCircle>
                        </Styles.OlStyle>
                    </Interactions.OlInteractionDraw>
                </Sources.OlSourceVector>
            </Layers.OlVectorLayer>

            <Interactions.OlInteractionSelect :condition="click" @select="featureClick" ref="clickSelectRef">
                <Styles.OlStyle>
                    <Styles.OlStyleStroke color="blue" :width="2"></Styles.OlStyleStroke>
                    <Styles.OlStyleFill color="rgba(0, 190, 110, 0.4)"></Styles.OlStyleFill>
                    <Styles.OlStyleCircle :radius="5">
                        <Styles.OlStyleFill color="#00dd11" />
                        <Styles.OlStyleStroke color="blue" :width="2" />
                    </Styles.OlStyleCircle>
                </Styles.OlStyle>
            </Interactions.OlInteractionSelect>

            <MapControls.OlLayerswitcherControl />
            <MapControls.OlFullscreenControl />
            <MapControls.OlScalelineControl />
            <MapControls.OlZoomsliderControl />

            <div class="custom-map-controls ol-unselectable ol-control ol-bar ol-group flex flex-row">
              <button type="button" name="drawButton" title="Draw an area on the map" :className="drawModeEnabled ? 'active' : ''" @click="enableDrawMode">&#9186;</button>
              <button type="button" name="clearButton" title="Clear all drawn features from the map" @click="clearDrawings">&#9003;</button>
              <button type="button" name="clearButton" title="Clear all features from the map" @click="clearAll">&#10060;</button>

            </div>

            <Map.OlOverlay v-if="loading" :position="center" positioning="center-center">
                <div class="overlay-content loading">
                    Loading...
                </div>
            </Map.OlOverlay>
        </Map.OlMap>
    </div>
</template>

<style scoped>
.kai-map {
    position: relative;
    height: 100%;
    width: 100%;
}
.overlay-content {
    background-color: white;
    border: 1px solid #cccccc;
    padding: 12px;
    border-radius: 0.25rem;
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.custom-map-controls {
  z-index: 1;
}
button.active {
  background-color: lightgrey;
}
</style>