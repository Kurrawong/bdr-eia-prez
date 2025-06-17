<script lang="ts" setup>
  import Map from "@/components/map/Map.vue";
  import { useTemplateRef } from 'vue';
  import axios from 'axios';

  const appConfig = useAppConfig();
  const loading = ref(false);
  const drawEnabled = ref(false);

  // When the user finishes drawing an area, we want to store it for the query.
  let latestDrawnPolygon = null;

  function drawend (feature) {
      if (feature) {
        try {
          latestDrawnPolygon = feature.wkt;
        } catch (error) {
          latestDrawnPolygon = null;
        }
      }
  }

  const scenarios = {
    1: {
      name: 'Data Presence',
      areaRequired: true
    },
    2: {
      name: 'Datasets by Kind',
      areaRequired: true
    },
    3: {
      name: 'Occurence by Area',
      areaRequired: true
    },
    4: {
      name: 'Occurrences by Taxon',
      areaRequired: false
    },
    5: {
      name: 'Occurrences by Trait',
      areaRequired: false
    }
  }

  function toggleAccordion(index) {
    for (const id of Object.keys(scenarios)) {
      if (id == index) {
        document.getElementById(`accordion-content-${id}`).classList.toggle("hidden");
        document.getElementById(`arrow-icon-${id}`).classList.toggle("rotate-180");
      } else {
        document.getElementById(`accordion-content-${id}`).classList.add("hidden");
        document.getElementById(`arrow-icon-${id}`).classList.remove("rotate-180");
      }
    }
  }
  // queries to search for preliminary results before applying them to the map
  const searchQueries = {
    4: (searchText) => `PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
        PREFIX text: <http://jena.apache.org/text#>

        SELECT DISTINCT ?iri ?name
        WHERE {
          (?iri ?score ?name) text:query ( skos:prefLabel '${searchText}*') .
          ?iri
            skos:inScheme <https://linked.data.gov.au/dataset/eiatest/nsl> ;
            skos:narrower* ?iri ;
          .
        }`,
    5: () => `PREFIX skos: <http://www.w3.org/2004/02/skos/core#>

        SELECT *
        WHERE {
          ?iri
          	skos:inScheme <https://w3id.org/APD/traits> ;
            ^skos:member <https://linked.data.gov.au/dataset/eiatest/eia-demo-collection> ;
             skos:definition ?name
          .
        }
        ORDER BY ?name`
  }

  const searchText = ref<string>("");
  const searchResults = ref<any[]>([]);
  const selectedTaxon = ref<string>();
  const selectedTraits = ref<string[]>([]);
  async function executeSearchQuery(scenarioId) {
    selectedTaxon.value = null;
    selectedTraits.value = [];
    searchResults.value = [];
    if (searchQueries[scenarioId]) {
      let queryResults = await axios.get(apiEndpoint + '/sparql?query=' + encodeURIComponent(searchQueries[scenarioId](searchText.value || '*')));
      if (queryResults?.data?.results?.bindings) {
        searchResults.value = queryResults.data.results.bindings.map((r) => {
          let feature = {
            name: r.name.value,
            iri: r.iri.value,
          };
          if (r.date) {
            feature.date = new Date(r.date.value);
          }
          return feature;
        });
      }
    }
  }

  // scenario GeoSPARQL queries

  const sparqlQueries = {
    1: (latestDrawnPolygon) => `PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
        PREFIX geo: <http://www.opengis.net/ont/geosparql#>
        PREFIX geof: <http://www.opengis.net/def/function/geosparql/>
        PREFIX schema: <https://schema.org/>

        SELECT ?iri ?name ?wktGeometry ?keywords
        WHERE {
          ?iri
              a schema:Dataset ;
              schema:name ?name ;
              schema:keywords ?kw ;
              geo:hasBoundingBox/geo:asWKT ?wktGeometry ;
          .

          ?kw skos:prefLabel ?keywords .

          BIND ("${latestDrawnPolygon}"^^geo:wktLiteral AS ?input_area)

          FILTER geof:sfIntersects(?input_area, ?wktGeometry)
        }
        ORDER BY ?name`,
    3: (latestDrawnPolygon) => `PREFIX dwc: <http://rs.tdwg.org/dwc/terms/>
        PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
        PREFIX geo: <http://www.opengis.net/ont/geosparql#>
        PREFIX geof: <http://www.opengis.net/def/function/geosparql/>
        PREFIX schema: <https://schema.org/>
        PREFIX time: <http://www.w3.org/2006/time#>

        SELECT ?iri ?name ?vernacularName ?date ?wktGeometry
        WHERE {
          ?iri a geo:Feature ;
              schema:name ?name ;
              geo:hasGeometry / geo:asWKT ?wktGeometry ;
              schema:isPartOf <https://linked.data.gov.au/dataset/eiatest/bdr-act/incidental-occurrences> ;
              time:hasTime / time:inXSDDateTime ?date .
          BIND ("${latestDrawnPolygon}"^^geo:wktLiteral AS ?input_area)
          OPTIONAL {
            ?iri dwc:scientificNameID ?taxon .
            ?taxon dwc:vernacularName ?vernacularName .
          }

          FILTER(geof:sfWithin(?wktGeometry, ?input_area))
        }
        ORDER BY DESC(?date) ?name`,
    4: () => {
      if (selectedTaxon && selectedTaxon.value) {
        return `PREFIX dwc: <http://rs.tdwg.org/dwc/terms/>
            PREFIX geo: <http://www.opengis.net/ont/geosparql#>
            PREFIX schema: <https://schema.org/>
            PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
            PREFIX time: <http://www.w3.org/2006/time#>

            SELECT ?iri ?name ?vernacularName ?date ?wktGeometry
            WHERE {
              {
                  SELECT ?taxon ?name ?vernacularName
                  WHERE {
                    BIND (<${selectedTaxon.value}> AS ?c)
                      ?c
                        skos:inScheme <https://linked.data.gov.au/dataset/eiatest/nsl> ;
                        skos:narrower* ?taxon ;
                      .

                    ?taxon skos:prefLabel ?name .
                    OPTIONAL { ?taxon dwc:vernacularName ?vernacularName }
                  }
                }
                ?iri
                  a dwc:Occurrence ;
                  dwc:scientificNameID ?taxon ;
                  geo:hasGeometry/geo:asWKT ?wktGeometry ;
                  time:hasTime/time:inXSDDateTime ?date ;
                .
            } ORDER BY DESC(?date) ?name`;
      }
      return `PREFIX dwc: <http://rs.tdwg.org/dwc/terms/>
          PREFIX geo: <http://www.opengis.net/ont/geosparql#>
          PREFIX schema: <https://schema.org/>
          PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
          PREFIX time: <http://www.w3.org/2006/time#>

          SELECT ?iri ?name ?vernacularName ?date ?wktGeometry
          WHERE {
              {
                SELECT ?taxon ?name ?vernacularName
                WHERE {
                  ?c
                    skos:inScheme <https://linked.data.gov.au/dataset/eiatest/nsl> ;
                    skos:narrower* ?taxon ;
                  .

                  ?taxon skos:prefLabel ?name .
                  OPTIONAL { ?taxon dwc:vernacularName ?vernacularName }
                }
              }
              ?iri
                a dwc:Occurrence ;
                dwc:scientificNameID ?taxon ;
                geo:hasGeometry/geo:asWKT ?wktGeometry ;
                time:hasTime/time:inXSDDateTime ?date ;
              .
          } ORDER BY DESC(?date) ?name`;
    },
    5: () => {
      return `PREFIX schema: <https://schema.org/>
              PREFIX time: <http://www.w3.org/2006/time#>
              PREFIX geo: <http://www.opengis.net/ont/geosparql#>
              PREFIX dwc: <http://rs.tdwg.org/dwc/terms/>
              PREFIX ex: <http://example.com/>
              PREFIX skos: <http://www.w3.org/2004/02/skos/core#>

              SELECT DISTINCT ?iri ?name ?vernacularName ?date ?wktGeometry (GROUP_CONCAT(DISTINCT ?otherTraitName; SEPARATOR="; ") AS ?traits)
              WHERE {
                VALUES ?trait {
                  ${selectedTraits.value.map(trait => `<${trait}>`).join(' ')}
                }

                ?trait ex:exhibitorOfTrait ?taxa .
                ?otherTrait ex:exhibitorOfTrait ?taxa ;
                            skos:definition ?otherTraitName .
                ?taxa dwc:vernacularName ?vernacularName .

                ?iri
                  dwc:scientificNameID ?taxa ;
                  geo:hasGeometry/geo:asWKT ?wktGeometry ;
                  time:hasTime/time:inXSDDateTime ?date ;
                  schema:name ?name ;
                .

                ?ds schema:hasPart* ?iri .

              } GROUP BY ?iri ?name ?vernacularName ?date ?wktGeometry`;
    }
  };
  // we will put the query result geometries in here, so we can display them on the map
  const resultLayers = ref<any[]>([]);
  // Queries are sent to the SPARQL endpoint through prez API.
  const apiEndpoint = useGetPrezAPIEndpoint();
  let results = ref([]);
  async function executeQuery(scenarioId) {
    if (!scenarios[scenarioId].areaRequired || latestDrawnPolygon) {
      loading.value = true;

      let queryResults = await axios.get(apiEndpoint + '/sparql?query=' + encodeURIComponent(sparqlQueries[scenarioId](latestDrawnPolygon)));
      if (queryResults?.data?.results?.bindings) {
        results.value = queryResults.data.results.bindings.map((r) => {
          let feature = {
            name: r.name.value,
            iri: r.iri.value,
          };
          if (r.date) {
            feature.date = new Date(r.date.value);
          }
          return feature;
        });
        resultLayers.value = [{
          "type": "FeatureCollection",
          "title": scenarios[scenarioId].name,
          "features": queryResults.data.results.bindings.map((r) => {
            let resultData = {};
            for (const key of Object.keys(r)) {
              resultData[key] = r[key].value;
            }
            let feature = {
              name: r.name.value,
              data: resultData,
              type: 'Feature',
              wkt: r.wktGeometry.value
            };
            if (r.date) {
              feature.data.date = new Date(r.date.value);
            }
            return feature;
          })
        }];
      }
      loading.value = false;
    } else {
      alert('Please draw an area on the map first')
    }
  }

  // this little hack keeps the map where it's at after (re-)loading the layers after a query
  let currentZoom = 4.5;
  const onChangeZoom = (newZoom) => {
    currentZoom = newZoom;
  }
  let currentCenter = [133.7751, -25.2744];
  const onChangeCenter = (newCenter) => {
    currentCenter = newCenter;
  }
  let currentRotation = 0;
  const onChangeRotation = (newRotation) => {
    currentRotation = newRotation;
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
        <div class="flex-none p-4 scenarios">
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
                <div class="bg-gray-100 p-4 cursor-pointer flex justify-between items-center" @click="toggleAccordion(2)">
                  <h3 class="font-semibold text-lg">S2: Datasets By Kind</h3>
                  <span class="transform transition-transform" id="arrow-icon-2">▼</span>
                </div>
                <div ref="accordion-content-2" class="p-4 hidden" id="accordion-content-2">
                  <!-- Content for Accordion Item 1 -->
                  <p>This scenario indicates what datasets are available by kind - a single vocabulary environmental domain classification of all EIA datasets.</p>
                  <h3 class="underline mt-4"></h3>
                  <ol class="flex flex-col gap-4">
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
                <div class="bg-gray-100 p-4 cursor-pointer flex justify-between items-center" @click="() => { toggleAccordion(4); executeSearchQuery(4); }">
                  <h3 class="font-semibold text-lg">S4: Occurrences by Taxon</h3>
                  <span class="transform transition-transform" id="arrow-icon-4">▼</span>
                </div>
                <div ref="accordion-content-4" class="p-4 hidden" id="accordion-content-4">
                  <!-- Content for Accordion Item 2 -->
                  <p>This scenario shows how the National Species List can be used to search for occurrences by species or genus or informal grouping name.</p>
                  <h3 class="underline mt-4">Steps</h3>
                  <ol class="flex flex-col gap-4">
                    <li class="flex flex-col">
                      <div class="flex-1">
                        <label class="block text-gray-700 text-sm font-bold mb-2" for="genus-search-text">
                          Search for an NLS genus/species/subspecies name:
                        </label>
                        <input class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                          id="genus-search-text"
                          type="text"
                          placeholder="For example: Eucalyptus, Rosa, Felis, ..."
                          v-model="searchText"
                          @input="executeSearchQuery(4)">
                      </div>
                      <div class="flex-1 mt-4 mb-4" v-if="searchResults && searchResults.length">
                        <label class="block text-gray-700 text-sm font-bold mb-2" for="genus-select">
                          Select an NLS genus/species/subspecies:
                        </label>
                        <select class="flex-1 block appearance-none w-full bg-gray-200 border border-gray-200 text-gray-700 py-3 px-4 pr-8 rounded leading-tight focus:outline-none focus:bg-white focus:border-gray-500"
                          name="genus-select"
                          v-model="selectedTaxon"
                        >
                          <option v-for="searchResult in searchResults" :value="searchResult.iri">{{searchResult.name}}</option>
                        </select>
                      </div>
                    </li>
                    <li class="flex flex-row"><button class="bg-gray-500 hover:bg-blue-700 text-white font-bold px-2 rounded" type="button" name="go-button" @click="executeQuery(4)">Show Occurrences</button></li>
                    <li>Click on indicated data on the map or list below the map for details. The results will indicate the data for the last selected area</li>
                  </ol>
                </div>
                <div class="bg-gray-100 p-4 cursor-pointer flex justify-between items-center" @click="() => { toggleAccordion(5); executeSearchQuery(5); }">
                  <h3 class="font-semibold text-lg">S5: Occurrences by Trait</h3>
                  <span class="transform transition-transform" id="arrow-icon-5">▼</span>
                </div>
                <div ref="accordion-content-5" class="p-4 hidden" id="accordion-content-5">
                  <!-- Content for Accordion Item 2 -->
                  <p>Building on Scenario 4, this scenario allows a user to search for occurrences of taxa according to traits.</p>
                  <p>This scenario links the AusTraits datasets to the BDR ACT occurrences by linking traits to taxa in the National Species List dataset, to which occurrences are also linked via the scientific name of the taxon they observed.</p>
                  <h3 class="underline mt-4">Steps</h3>
                  <ol class="flex flex-col gap-4">
                    <li class="flex flex-col">Select one or more traits from the available subset:
                      <fieldset v-if="searchResults && searchResults.length" class="fieldset bg-base-100 border-base-300 rounded-box w-64 border p-4">
                        <legend class="fieldset-legend">Available traits:</legend>
                        <div class="" v-for="searchResult in searchResults">
                          <input
                            type="checkbox"
                            :name="searchResult.iri"
                            :value="searchResult.iri"
                            v-model="selectedTraits"
                            class="checkbox mr-2"
                            @change="executeQuery(5)"
                            />
                          <label>
                              {{searchResult.name}}
                          </label>
                        </div>
                      </fieldset>
                    </li>
                    <li>When multiple traits are selected, all results with at least one of the selected traits will be shown.</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="flex-1 p-4 flex flex-col">
          <div class="flex-1">
            <Map class="eia-demo-map"
                :center="currentCenter"
                @change:center="onChangeCenter"
                :zoom="currentZoom"
                @change:zoom="onChangeZoom"
                :rotation="currentRotation"
                @change:rotation="onChangeRotation"
                :projection="'EPSG:4326'"
                :layers="resultLayers"
                :loading="loading"
                :drawEnabled="drawEnabled"
                :clearDrawingsOnLayerChange="false"
                :fitAddedLayersToExtent="true"
                :animationDuration="1000"
                :enableCustomMapControls="true"
                @drawend="drawend" />
          </div>
          <div class="flex-1 results-list">
            <h2 class="text-2xl mt-8">Results</h2>
            <div class="results">
              <li v-for="result in results"><a :href="`/object?uri=${result.iri}`" target="_blank">{{result.name}}</a> <span v-if="result.date">{{ result.date }}</span></li>
            </div>
          </div>
        </div>
      </div>
    </template>
  </NuxtLayout>
</template>

<style lang="css" scoped>
    .eia-demo-map {
        height: 600px;
        width: 100%;
    }
    .scenarios {
      width: 500px;
    }
    .fieldset {
      width: 100%;
    }
</style>
