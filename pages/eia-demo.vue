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

  const scenarioNames = {
    1: 'Data Presence',
    3: 'Occurence by area'
  }

  function toggleAccordion(index) {
    for (const id of Object.keys(scenarioNames)) {
      if (id == index) {
        document.getElementById(`accordion-content-${id}`).classList.toggle("hidden");
        document.getElementById(`arrow-icon-${id}`).classList.toggle("rotate-180");
      } else {
        document.getElementById(`accordion-content-${id}`).classList.add("hidden");
        document.getElementById(`arrow-icon-${id}`).classList.remove("rotate-180");
      }
    }
  }

  // we will put the query result geometries in here, so we can display them on the map
  const resultLayers = ref<any[]>([]);
  // Queries are sent to the SPARQL endpoint through prez API.
  const apiEndpoint = useGetPrezAPIEndpoint();
  let results = ref([]);
  async function executeQuery(scenarioId) {
    if (latestDrawnPolygon) {
      const sparqlQueries = {
        1: `PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
    PREFIX geo: <http://www.opengis.net/ont/geosparql#>
    PREFIX geof: <http://www.opengis.net/def/function/geosparql/>
    PREFIX schema: <https://schema.org/>

    SELECT ?iri ?name ?wktGeometry ?kw ?kw_label
    WHERE {
      ?iri
          a schema:Dataset ;
          schema:name ?name ;
          schema:keywords ?kw ;
          geo:hasBoundingBox/geo:asWKT ?wktGeometry ;
      .

      ?kw skos:prefLabel ?kw_label .

      BIND ("${latestDrawnPolygon}"^^geo:wktLiteral AS ?input_area)

      FILTER geof:sfIntersects(?input_area, ?wktGeometry)
    }
    ORDER BY ?name`,
        3: `PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
    PREFIX geo: <http://www.opengis.net/ont/geosparql#>
    PREFIX geof: <http://www.opengis.net/def/function/geosparql/>
    PREFIX schema: <https://schema.org/>

    SELECT ?iri ?name ?wktGeometry
    WHERE {
      ?iri a geo:Feature ;
          schema:name ?name ;
          geo:hasGeometry / geo:asWKT ?wktGeometry ;
          schema:isPartOf <https://linked.data.gov.au/dataset/eiatest/bdr-act/incidental-occurrences> .

      BIND ("${latestDrawnPolygon}"^^geo:wktLiteral AS ?input_area)

      FILTER(geof:sfWithin(?wktGeometry, ?input_area))
    }
    ORDER BY ?name`
      };

      let queryResults = await axios.get(apiEndpoint + '/sparql?query=' + encodeURIComponent(sparqlQueries[scenarioId]));
      if (queryResults?.data?.results?.bindings) {
        results.value = queryResults.data.results.bindings.map((r) => { return { name: r.name.value, iri: r.iri.value } });
        resultLayers.value = [{
          "type": "FeatureCollection",
          "title": scenarioNames[scenarioId],
          "features": queryResults.data.results.bindings.map((r) => {
            return {
              name: r.name.value,
              type: 'Feature',
              wkt: r.wktGeometry.value
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
                  <span class="transform transition-transform rotate-180" id="arrow-icon-1">▼</span>
                </div>
                <div ref="accordion-content-1" class="p-4" id="accordion-content-1">
                  <!-- Content for Accordion Item 1 -->
                  <p>This scenario describes the kind of data that is present per dataset in a given area.</p>
                  <h3 class="underline mt-4">Steps</h3>
                  <ol class="flex flex-col gap-4">
                    <li class="flex flex-col">Select an area on the map by enabling draw mode using the polygon icon at the top of the map</li>
                    <li class="flex flex-row"><span>Click GO</span><span class="ml-5"><button class="bg-gray-500 hover:bg-blue-700 text-white font-bold px-2 rounded" type="button" name="go-button" @click="executeQuery(1)">GO</button></span></li>
                    <li>Click on indicated data on the map or list below the map for details. The results will indicate the data for the last selected area</li>
                  </ol>
                </div>
                <div class="bg-gray-100 p-4 cursor-pointer flex justify-between items-center" @click="toggleAccordion(3)">
                  <h3 class="font-semibold text-lg">S3: Observations by area</h3>
                  <span class="transform transition-transform" id="arrow-icon-3">▼</span>
                </div>
                <div ref="accordion-content-3" class="p-4 hidden" id="accordion-content-3">
                  <!-- Content for Accordion Item 2 -->
                  <p>This scenario describes the observations in a given area.</p>
                  <h3 class="underline mt-4">Steps</h3>
                  <ol class="flex flex-col gap-4">
                    <li class="flex flex-col">Select an area on the map by enabling draw mode using the polygon icon at the top of the map</li>
                    <li class="flex flex-row"><span>Click GO</span><span class="ml-5"><button class="bg-gray-500 hover:bg-blue-700 text-white font-bold px-2 rounded" type="button" name="go-button" @click="executeQuery(3)">GO</button></span></li>
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
              <li v-for="result in results"><a :href="`/object?uri=${result.iri}`" target="_blank">{{result.name}}</a> </li>
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
