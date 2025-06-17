<script lang="ts" setup>
import { ItemTable, type ItemTableProps } from "prez-components";
import Map from "@/components/map/Map.vue";

const runtimeConfig = useRuntimeConfig();

const props = defineProps<ItemTableProps>();
const itemTableRow = resolveComponent("ItemTableRow") as Component;

const properties = props.term?.properties;
let wkt = ref<string>(null);
let objectLayers = ref<Array<any>>([]);
if (properties) {
  const wktTriple = properties["http://www.opengis.net/ont/geosparql#asWKT"];
  if (wktTriple?.objects?.length) {
    for (const wktObject of wktTriple?.objects) {
      wkt = wktObject.value;
      objectLayers.value = [{
        "type": "FeatureCollection",
        "features": [{
            type: 'Feature',
            wkt: wkt
          }]
      }];
    }
  }
}
</script>

<template>
    <div class="" v-if="wkt">
      <Map class="object-map"
          :center="[133.7751, -25.2744]"
          :zoom="4"
          :rotation="0"
          :projection="'EPSG:4326'"
          :layers="objectLayers"
          :drawEnabled="false"
          :clearDrawingsOnLayerChange="false"
          :fitAddedLayersToExtent="true" />
    </div>
    <ItemTable
        v-bind="props"
        :_components="{itemTableRow}"
        :renderMarkdown="!!runtimeConfig.public.prezAutoDetectMarkdown"
        :renderHtml="!!runtimeConfig.public.prezAutoDetectHtml"
    />
</template>

<style lang="scss" scoped>
  .object-map {
      height: 600px;
      width: 100%;
  }
</style>