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
      name: 'Occurrences',
      areaRequired: true
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
    dataKinds: () => `PREFIX skos: <http://www.w3.org/2004/02/skos/core#>

        SELECT DISTINCT ?iri ?name ?topConcept ?topConceptName
        WHERE {
           ?topConcept skos:topConceptOf <https://linked.data.gov.au/eia-dk> ;
                       skos:prefLabel ?topConceptName .
           ?iri skos:broader ?topConcept ;
                            skos:prefLabel ?name .
        }`,
    taxons: (text) => `PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
        PREFIX text: <http://jena.apache.org/text#>

        SELECT DISTINCT ?iri ?name
        WHERE {
          (?iri ?score ?name) text:query ( skos:prefLabel '${text}*') .
          ?iri
            skos:inScheme <https://linked.data.gov.au/dataset/eiatest/nsl> ;
            skos:narrower* ?iri ;
          .
        }`,
    traits: () => `PREFIX skos: <http://www.w3.org/2004/02/skos/core#>

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

  async function executeSearchQuery(searchQuery, text) {
    let queryResults = await axios.get(apiEndpoint + '/sparql?query=' + encodeURIComponent(searchQuery(text || '*')));
    if (queryResults?.data?.results?.bindings) {
      return queryResults.data.results.bindings.map((r) => {
        let resultData = {};
        for (const key of Object.keys(r)) {
          resultData[key] = r[key].value;
        }
        let feature = {
          name: r.name.value,
          iri: r.iri.value,
          data: resultData
        };
        if (r.date) {
          feature.date = new Date(r.date.value);
        }
        return feature;
      });
    } else {
      return [];
    }
  }
  const searchText = ref<string>("");
  const datakindSearchResults = ref<any[]>([]);
  const taxonSearchResults = ref<any[]>([]);
  const traitsSearchResults = ref<any[]>([]);
  const selectedTaxon = ref<string>();
  const selectedTraits = ref<string[]>([]);
  async function searchDataKinds() {
    // data kinds
    datakindSearchResults.value = await executeSearchQuery(searchQueries.dataKinds);
    getDataKinds(true);
  }
  async function searchTaxons() {
    // taxons
    selectedTaxon.value = null;
    taxonSearchResults.value = await executeSearchQuery(searchQueries.taxons, searchText.value);
  }
  async function searchTraits() {
    // traits
    selectedTraits.value = [];
    traitsSearchResults.value = await executeSearchQuery(searchQueries.traits);
  }
  async function executeSearchQueries(next) {
    await searchDataKinds();
    await searchTaxons();
    await searchTraits();

    if (typeof next === 'function') {
      next();
    }
  }

  const selectedDataKinds = ref<string[]>([]);
  const selectedTopConcepts = ref<string[]>([]);
  const topDataKindConcepts = ref<any[]>([]);
  // process the flat list of datakindSearchResults into a hierarchical list of concepts
  function getDataKinds(selectAll) {
    let topDataKindConceptsMap = {};
    selectedTopConcepts.value = [];
    selectedDataKinds.value = [];
    if (datakindSearchResults?.value?.length) {
      for (const narrowerConcept of datakindSearchResults.value) {
        if (!topDataKindConceptsMap[narrowerConcept.data.topConcept]) {
          topDataKindConceptsMap[narrowerConcept.data.topConcept] = {
            iri: narrowerConcept.data.topConcept,
            name: narrowerConcept.data.topConceptName,
            narrowerConcepts: []
          };
          if (selectAll) {
            selectedTopConcepts.value.push(narrowerConcept.data.topConcept);
          }
        }
        topDataKindConceptsMap[narrowerConcept.data.topConcept].narrowerConcepts.push(narrowerConcept);
        if (selectAll) {
          selectedDataKinds.value.push(narrowerConcept.iri);
        }
      }
      topDataKindConcepts.value = Object.keys(topDataKindConceptsMap).map((topConceptIri) => {
        return topDataKindConceptsMap[topConceptIri];
      });
    }
  }

  function toggleTopConcept(topConcept) {
    if (selectedTopConcepts.value.includes(topConcept.iri)) {
      // select all narrower concepts
      for (const narrowerConcept of topConcept.narrowerConcepts) {
        if (!selectedDataKinds.value.includes(narrowerConcept.iri)) {
          selectedDataKinds.value.push(narrowerConcept.iri);
        }
      }
    } else {
      for (const narrowerConcept of topConcept.narrowerConcepts) {
        let i = selectedDataKinds.value.indexOf(narrowerConcept.iri);
        if (i > -1) {
          selectedDataKinds.value.splice(i, 1);
        }
      }
    }
  }

  function toggleDatakind(dataKind) {
    // recalculate the selectedTopConcepts
    for (const topConcept of topDataKindConcepts.value) {
      let selectTopConcept = true;
      for (const narrowerConcept of topConcept.narrowerConcepts) {
        if (!selectedDataKinds.value.includes(narrowerConcept.iri)) {
          selectTopConcept = false;
        }
      }
      let i = selectedTopConcepts.value.indexOf(topConcept.iri);
      if (selectTopConcept) {
        if (i === -1) {
          selectedTopConcepts.value.push(topConcept.iri);
        }
      } else {
        if (i > -1) {
          selectedTopConcepts.value.splice(i, 1);
        }
      }
    }
  }

  // scenario GeoSPARQL queries

  const sparqlQueries = {
    1: (latestDrawnPolygon) => `PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
        PREFIX geo: <http://www.opengis.net/ont/geosparql#>
        PREFIX geof: <http://www.opengis.net/def/function/geosparql/>
        PREFIX schema: <https://schema.org/>

        SELECT DISTINCT ?iri ?name (GROUP_CONCAT(DISTINCT ?keywordLabel; SEPARATOR="; ") AS ?keywords) ?description ?wktGeometry
        WHERE {
          VALUES ?dataKind {
            ${selectedDataKinds.value.map(dataKind => `<${dataKind}>`).join(' ')}
          }
          ?iri
              a schema:Dataset ;
              schema:keywords ?dataKind ;
              schema:name ?name ;
              schema:keywords ?kw ;
              geo:hasBoundingBox/geo:asWKT ?wktGeometry ;
          .

          OPTIONAL { ?iri schema:description ?description . }

          ?kw skos:prefLabel ?keywordLabel ;
              skos:inScheme <http://vocabs.lter-europe.net/EnvThes> .

          BIND ("${latestDrawnPolygon}"^^geo:wktLiteral AS ?input_area)

          FILTER geof:sfIntersects(?input_area, ?wktGeometry)
        } GROUP BY ?iri ?name ?description ?wktGeometry
        ORDER BY ?name`,
    2: (latestDrawnPolygon) => {
      let queryString = `PREFIX dwc: <http://rs.tdwg.org/dwc/terms/>
          PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
          PREFIX geo: <http://www.opengis.net/ont/geosparql#>
          PREFIX geof: <http://www.opengis.net/def/function/geosparql/>
          PREFIX schema: <https://schema.org/>
          PREFIX time: <http://www.w3.org/2006/time#>
          PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
          PREFIX ex: <http://example.com/>

          SELECT ?iri ?name ?vernacularName ?date ?wktGeometry (GROUP_CONCAT(DISTINCT ?datasetKeyword; SEPARATOR="; ") AS ?envthesKeywords)`
      if (selectedTraits?.value?.length) {
        queryString += ` (GROUP_CONCAT(DISTINCT ?otherTraitName; SEPARATOR="; ") AS ?traits)`
      }
      queryString += `
          WHERE {
            ?iri a geo:Feature ;
                schema:name ?name ;
                ^rdfs:member ?dataset ;
                geo:hasGeometry / geo:asWKT ?wktGeometry ;
                schema:isPartOf <https://linked.data.gov.au/dataset/eiatest/bdr-act/incidental-occurrences> ;
                time:hasTime / time:inXSDDateTime ?date .
            BIND ("${latestDrawnPolygon}"^^geo:wktLiteral AS ?input_area)
            FILTER(geof:sfWithin(?wktGeometry, ?input_area))
            {
              SELECT ?topLevelDataset WHERE {
                VALUES ?dataKind {
                  ${selectedDataKinds.value.map(dataKind => `<${dataKind}>`).join(' ')}
                }
                ?topLevelDataset a schema:Dataset ;
                     schema:keywords ?dataKind .
              }
            }
        ?iri dwc:scientificNameID ?taxon .`;

      if (selectedTaxon && selectedTaxon.value) {
        queryString += `
                {
                  SELECT ?taxon ?vernacularName
                  WHERE {
                    BIND (<${selectedTaxon.value}> AS ?c)
                      ?c
                        skos:inScheme <https://linked.data.gov.au/dataset/eiatest/nsl> ;
                        skos:narrower* ?taxon ;
                      .
                    OPTIONAL { ?taxon dwc:vernacularName ?vernacularName }
                  }
                }`;
      }
      if (selectedTraits?.value?.length) {
        queryString += `VALUES ?trait {
          ${selectedTraits.value.map(trait => `<${trait}>`).join(' ')}
        }

        ?trait ex:exhibitorOfTrait ?taxon .
        ?otherTrait ex:exhibitorOfTrait ?taxon ;
                    skos:definition ?otherTraitName .`;
      }
      queryString += `

            ?topLevelDataset rdfs:member ?dataset ;
                     schema:keywords ?kw .
            ?kw skos:prefLabel ?datasetKeyword ;
                skos:inScheme <http://vocabs.lter-europe.net/EnvThes> .
          } GROUP BY ?iri ?name ?vernacularName ?date ?wktGeometry`
      return queryString;
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

  const minHeight = ref<Number>(25);
  function onChangeMinHeight(newVal) {
    console.log(newVal);
    console.log(minHeight.value);

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

  executeSearchQueries();
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
                <div class="bg-gray-100 p-4 cursor-pointer flex justify-between items-center" @click="() => { toggleAccordion(1); }">
                  <h3 class="font-semibold text-lg">Q1: What kind of data is present?</h3>
                  <span class="transform transition-transform rotate-180" id="arrow-icon-1">▼</span>
                </div>
                <div ref="accordion-content-1" class="p-4" id="accordion-content-1">
                  <!-- Content for Accordion Item 1 -->
                  <p>Discover datasets per kind in a given area, categorized using a single vocabulary environmental domain classification of all EIA datasets.</p>
                  <ol class="flex flex-col gap-4">
                    <li>Select an area on the map by enabling draw mode using the polygon icon (&#9186;) at the top of the map.</li>
                    <li class="flex flex-row"><span>Click GO</span><span class="ml-5"><button class="bg-gray-500 hover:bg-blue-700 text-white font-bold px-2 rounded" type="button" name="go-button" @click="executeQuery(1)">GO</button></span></li>
                    <li>Click on indicated data on the map or list below the map for details. The results will indicate the data for the last selected area</li>
                    <li>Results can be filtered by dataset kind:</li>
                    <li class="flex flex-col">
                      <fieldset v-if="topDataKindConcepts && topDataKindConcepts.length" class="fieldset bg-base-100 border-base-300 rounded-box w-64 border p-4">
                        <legend class="fieldset-legend">Available kinds:</legend>
                        <div class="top-concept" v-for="topDataKind in topDataKindConcepts">
                          <input
                            type="checkbox"
                            :name="topDataKind.iri"
                            :value="topDataKind.iri"
                            v-model="selectedTopConcepts"
                            class="checkbox mr-2"
                            @change="toggleTopConcept(topDataKind); executeQuery(1);"
                            />
                          <label>
                              {{topDataKind.name}}
                          </label>
                          <div class="narrower-concept ml-4" v-for="narrowerDataKind in topDataKind.narrowerConcepts">
                            <input
                              type="checkbox"
                              :name="narrowerDataKind.iri"
                              :value="narrowerDataKind.iri"
                              v-model="selectedDataKinds"
                              class="checkbox mr-2"
                              @change="toggleDatakind(narrowerDataKind); executeQuery(1);"
                              />
                            <label>
                                {{narrowerDataKind.name}}
                            </label>
                          </div>
                        </div>
                      </fieldset>
                    </li>
                  </ol>
                </div>
                <div class="bg-gray-100 p-4 cursor-pointer flex justify-between items-center" @click="() => { toggleAccordion(2); }">
                  <h3 class="font-semibold text-lg">Q2: How can I find observations?</h3>
                  <span class="transform transition-transform" id="arrow-icon-2">▼</span>
                </div>
                <div ref="accordion-content-2" class="p-4 hidden" id="accordion-content-2">
                  <!-- Content for Accordion Item 2 -->
                  <p>This scenario describes the observations in a given area.</p>
                  <p>The National Species List can be used to search for occurrences by species or genus or informal grouping name.</p>
                  <h3 class="underline mt-4">Steps</h3>
                  <ol class="flex flex-col gap-4">
                    <li class="flex flex-col">Select an area on the map by enabling draw mode using the polygon icon at the top of the map</li>
                    <li class="flex flex-row"><button class="bg-gray-500 hover:bg-blue-700 text-white font-bold px-2 rounded" type="button" name="go-button" @click="executeQuery(2)">Show Occurrences</button></li>
                    <li class="flex flex-col">Several filters are available:</li>
                    <li class="flex flex-col">
                      <label class="block text-gray-700 text-sm font-bold mb-2">Filter by data kind:</label>
                      <fieldset v-if="topDataKindConcepts && topDataKindConcepts.length" class="fieldset bg-base-100 border-base-300 rounded-box w-64 border p-4">
                        <legend class="fieldset-legend">Available kinds:</legend>
                        <div class="top-concept" v-for="topDataKind in topDataKindConcepts">
                          <input
                            type="checkbox"
                            :name="topDataKind.iri"
                            :value="topDataKind.iri"
                            v-model="selectedTopConcepts"
                            class="checkbox mr-2"
                            @change="toggleTopConcept(topDataKind); executeQuery(2);"
                            />
                          <label>
                              {{topDataKind.name}}
                          </label>
                          <div class="narrower-concept ml-4" v-for="narrowerDataKind in topDataKind.narrowerConcepts">
                            <input
                              type="checkbox"
                              :name="narrowerDataKind.iri"
                              :value="narrowerDataKind.iri"
                              v-model="selectedDataKinds"
                              class="checkbox mr-2"
                              @change="toggleDatakind(narrowerDataKind); executeQuery(2);"
                              />
                            <label>
                                {{narrowerDataKind.name}}
                            </label>
                          </div>
                        </div>
                      </fieldset>
                    </li>
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
                          @input="searchTaxons()">
                      </div>
                      <div class="flex-1 mt-4 mb-4" v-if="taxonSearchResults && taxonSearchResults.length">
                        <label class="block text-gray-700 text-sm font-bold mb-2" for="genus-select">
                          Select an NLS genus/species/subspecies:
                        </label>
                        <select class="flex-1 block appearance-none w-full bg-gray-200 border border-gray-200 text-gray-700 py-3 px-4 pr-8 rounded leading-tight focus:outline-none focus:bg-white focus:border-gray-500"
                          name="genus-select"
                          v-model="selectedTaxon"
                        >
                          <option v-for="searchResult in taxonSearchResults" :value="searchResult.iri">{{searchResult.name}}</option>
                        </select>
                      </div>
                    </li>
                    <li class="flex flex-col">
                      <p>This demonstrator links the AusTraits datasets to the BDR ACT occurrences by linking traits to taxa in the National Species List dataset, to which occurrences are also linked via the scientific name of the taxon they observed.</p>
                      <label for="">Select one or more traits from the available subset:</label>
                      <fieldset v-if="traitsSearchResults && traitsSearchResults.length" class="fieldset bg-base-100 border-base-300 rounded-box w-64 border p-4">
                        <legend class="fieldset-legend">Available traits:</legend>
                        <div class="" v-for="searchResult in traitsSearchResults">
                          <input
                            type="checkbox"
                            :name="searchResult.iri"
                            :value="searchResult.iri"
                            v-model="selectedTraits"
                            class="checkbox mr-2"
                            @change="executeQuery(2)"
                            />
                          <label>
                              {{searchResult.name}}
                          </label>
                        </div>
                      </fieldset>
                    </li>
                    <li>When multiple traits are selected, all results with at least one of the selected traits will be shown.</li>
                    <li>Click on indicated data on the map or list below the map for details. The results will indicate the data for the last selected area</li>
                    <!-- <li>
                      <div class="relative mb-6">
                          <label for="labels-range-input" class="sr-only">Min. Height (cm)</label>
                          <input id="labels-range-input" type="range" v-model="minHeight" min="0" max="100" @change="onChangeMinHeight" class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700">
                          <span class="text-sm text-gray-500 dark:text-gray-400 absolute start-0 -bottom-6">0</span>
                          <span class="text-sm text-gray-500 dark:text-gray-400 absolute start-1/2 -translate-x-1/2 rtl:translate-x-1/2 -bottom-6">50</span>
                          <span class="text-sm text-gray-500 dark:text-gray-400 absolute end-0 -bottom-6">100</span>
                      </div>
                    </li> -->
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

<style lang="scss" scoped>
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
