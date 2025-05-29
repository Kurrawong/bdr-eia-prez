<script lang="ts" setup>
  import Map from "@/components/map/Map.vue";
  import { useTemplateRef } from 'vue';
  import axios from 'axios';

  const appConfig = useAppConfig();
  const loading = ref(false);
  const drawEnabled = ref(false);
  const layers = ref<any[]>([]);

  async function loadMapData() {
      loading.value = true;
      await new Promise(r => setTimeout(r, 1000));

      layers.value = [featureCollection];
      loading.value = false;
  }

  async function clearMapData() {
      layers.value = [];
  }

  // When the user finishes drawing an area, we want to store it for the query.
  let latestDrawnPolygon = null;

  function drawend (feature) {
      console.log('The user drew a feature:');
      console.log(feature);
      if (feature) {
        try {
          latestDrawnPolygon = feature.wkt;
        } catch (error) {
          latestDrawnPolygon = null;
        }
      }
  }

  function toggleAccordion(index) {
    document.getElementById(`accordion-content-${index}`).classList.toggle("hidden");
    document.getElementById(`arrow-icon-${index}`).classList.toggle("rotate-180");
  }

  // we will put the query result geometries in here, so we can display them on the map
  const resultLayers = ref<any[]>([]);

  // Queries are sent to the SPARQL endpoint through prez API.
  const apiEndpoint = useGetPrezAPIEndpoint();
  let results = ref([]);
  async function executeQuery() {
    if (latestDrawnPolygon) {
      const sparqlQuery = `PREFIX geo: <http://www.opengis.net/ont/geosparql#>
      PREFIX geof: <http://www.opengis.net/def/function/geosparql/>

      SELECT DISTINCT ?dataset ?boundingBox
      WHERE {
        BIND("${latestDrawnPolygon}"^^geo:wktLiteral AS ?polygon)
        ?dataset geo:boundingBox / geo:asWKT ?boundingBox .
        FILTER(geof:sfWithin(?boundingBox, ?polygon))
      }`;
      let queryResults = await axios.get(apiEndpoint + '/sparql?query=' + encodeURIComponent(sparqlQuery));
      if (queryResults?.data?.results?.bindings) {
        results.value = queryResults.data.results.bindings.map((r) => r.dataset.value);
        resultLayers.value = [{
          "type": "FeatureCollection",
          "title": "IDN data",
          "features": queryResults.data.results.bindings.map((r) => {
            return {
              name: r.dataset.value,
              type: 'Feature',
              wkt: r.boundingBox.value
            };
          })
        }];
      }
    } else {
      alert('Please draw an area on the map first')
    }
  }
</script>

<template>
  <NuxtLayout>
    <template #breadcrumb>
        <slot name="breadcrumb">
            <ItemBreadcrumb :custom-items="[...appConfig.breadcrumbPrepend, {label: 'EIA Scenario Demonstrator'}]" />
        </slot>
    </template>
    <template #header-text>
        EIA Scenario Demonstrator
    </template>
    <template #default>
      <div class="flex flex-row">
        <div class="flex-1 p-4">
          <p>This web page allows you to test scenarios of data interoperability across datasets in the <a href="#">EIA Test Catalogue</a>.</p>
          <h2 class="text-2xl mt-8">Scenarios</h2>
          <div class="scenario-accordion">
            <div class="">
              <!-- Accordion Item 1 -->
              <div class="overflow-hidden shadow-md bg-white">
                <div class="bg-gray-100 p-4 cursor-pointer flex justify-between items-center" @click="toggleAccordion(1)">
                  <h3 class="font-semibold text-lg">S1: Data Presence</h3>
                  <span class="transform transition-transform" id="arrow-icon-1">▼</span>
                </div>
                <div ref="accordion-content-1" class="p-4" id="accordion-content-1">
                  <!-- Content for Accordion Item 1 -->
                  <p>This scenario descrived the kind of data that is present per dataset in a given area.</p>
                  <h3 class="underline mt-4">Steps</h3>
                  <ol class="flex flex-col gap-4">
                    <li class="flex flex-col">Select an area on the map by enabling draw mode using the polygon icon at the top of the map</li>
                    <li class="flex flex-row"><span>Click GO</span><span class="ml-5"><button class="bg-gray-500 hover:bg-blue-700 text-white font-bold px-2 rounded" type="button" name="go-button" @click="executeQuery()">GO</button></span></li>
                    <li>Click on indicated data on the map or list below the map for details. The results will indicate the data for the last selected area</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="flex-1 p-4 flex flex-col">
          <div class="flex-1">
            <Map class="eia-demo-map"
                :center="[133.7751, -25.2744]"
                :zoom="4"
                :rotation="0"
                :projection="'EPSG:4326'"
                :layers="resultLayers"
                :loading="loading"
                :drawEnabled="drawEnabled"
                @drawend="drawend" />
          </div>
          <div class="flex-1 results-list">
            <h2 class="text-2xl mt-8">Results</h2>
            <div class="results">
              <li v-for="result in results"><a :href="result" target="_blank">{{result}}</a> </li>
            </div>
          </div>
        </div>
      </div>
    </template>
  </NuxtLayout>
</template>

<style lang="css" scoped>
    .eia-demo-map {
        height: 500px;
        width: 100%;
    }
</style>
