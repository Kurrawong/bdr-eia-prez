<script lang="ts" setup>
import { onMounted, onUnmounted } from "vue";

const props = defineProps<{
    type?: string;
    iri?: string;
    selectedFeature: Feature;
}>();

const emit = defineEmits(["deselect"]);

function deselect() {
    emit("deselect");
}

function onEscape(e: KeyboardEvent) {
    if (e.key === "Escape") {
        deselect();
    }
}

// convert a camelCase property to a human readable Title Case property
function convertToTitleCase(text) {
  if (text?.length > 1) {
    return text.charAt(0).toUpperCase() + text.replace(/([A-Z])/g, " $1").slice(1);
  }
  return text;
}

onMounted(() => {
    document.addEventListener("keyup", onEscape);
});

onUnmounted(() => {
    document.removeEventListener("keyup", onEscape);
});
</script>

<template>
    <div class="overlay-content">
        <div class="title">
            <span><slot name="title">{{ props.selectedFeature.name }}</slot></span>
            <button class="map-tooltip-close-btn" aria-label="Close" @click="deselect">&times;</button>
        </div>
        <div v-if="props.selectedFeature.type" class="type">{{ props.selectedFeature.type }}</div>
        <div v-if="props.selectedFeature.data" v-for="item in Object.keys(props.selectedFeature.data)">
          <div class="tooltip-attribute" v-if="['iri', 'name', 'wktGeometry'].indexOf(item) === -1">
            {{convertToTitleCase(item)}}: <span class="metadata">{{ props.selectedFeature.data[item] }}</span>
          </div>
        </div>
        <div class="tooltip-attribute" v-if="props.selectedFeature.data.iri">
          <a class="tooltip-iri" :href="`/object?uri=${props.selectedFeature.data.iri}`" target="_blank">{{props.selectedFeature.data.iri}}</a>
        </div>
        <div class="metadata">
            <slot name="metadata"></slot>
        </div>
    </div>
</template>

<style lang="scss" scoped>
$arrow-size: 8px;

.overlay-content {
    background-color: white;
    border: 1px solid #cccccc;
    padding: 12px;
    border-radius: 0.25rem;
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: $arrow-size; // offset arrow height
    width: 400px;

    .title {
        font-weight: bold;
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        align-items: flex-start;

        a {
            color: #0284c7;

            &:hover {
                color: #0ea5e9;
            }
        }

        button.map-tooltip-close-btn {
            color: grey;
            font-size: 1rem;
            margin-top: -6px;

            &:hover {
                color: black;
            }
        }
    }

    .type {
        font-size: 0.9rem;
        color: grey;
        font-style: italic;
        font-weight: normal;
        margin-top: -8px;
    }

    .metadata {
        font-family: monospace;
        background-color: #f0f0f0;
        padding: 4px;
    }

    &:not(.loading)::after {
        content: " ";
        position: absolute;
        top: calc(100% - 1px - $arrow-size); // covers border, offset arrow height
        left: 50%;
        margin-left: -$arrow-size;
        border-width: $arrow-size;
        border-style: solid;
        border-color: white transparent transparent transparent;
    }

    .tooltip-attribute {
      .tooltip-iri {
        font-size: smaller;
      }
    }
}
</style>