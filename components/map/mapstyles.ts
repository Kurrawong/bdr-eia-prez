// map colours
export const primaryColor = "#c14213"; // QLD gov primary
const baseOpacity = "0.5";
const hoverOpacity = "0.7";

const roadBaseColor = "0, 0, 255"; // blue
const addressBaseColor = "128, 128, 128"; // grey
const placenameBaseColor = "255, 0, 0"; // red
const lgaBaseColor = "255, 165, 0"; // orange
const localityBaseColor = "0, 128, 0"; // green

export const mapLayerStyles: {
    [key in "road" | "address" | "placename" | "lga" | "locality"]: {
        baseColor: string;
        hoverColor: string;
        selectColor: string;
        strokeWidth: number;
        hoverStrokeWidth: number;
        radius?: number;
        hoverRadius?: number;
        selectRadius?: number;
        minZoom?: number;
    }
} = {
    road: {
        baseColor: `rgba(${roadBaseColor}, ${baseOpacity})`,
        hoverColor: `rgba(${roadBaseColor}, ${hoverOpacity})`,
        selectColor: `rgb(${roadBaseColor})`,
        strokeWidth: 10,
        hoverStrokeWidth: 14,
        minZoom: 12,
    },
    address: {
        baseColor: `rgba(${addressBaseColor}, ${baseOpacity})`,
        hoverColor: `rgba(${addressBaseColor}, ${hoverOpacity})`,
        selectColor: `rgb(${addressBaseColor})`,
        strokeWidth: 4,
        hoverStrokeWidth: 8,
        radius: 4,
        hoverRadius: 6,
        selectRadius: 6,
        minZoom: 16.9,
    },
    placename: {
        baseColor: `rgba(${placenameBaseColor}, ${baseOpacity})`,
        hoverColor: `rgba(${placenameBaseColor}, ${hoverOpacity})`,
        selectColor: `rgb(${placenameBaseColor})`,
        strokeWidth: 10,
        hoverStrokeWidth: 14,
        radius: 6,
        hoverRadius: 8,
        selectRadius: 8,
        minZoom: 12,
    },
    lga: {
        baseColor: `rgba(${lgaBaseColor}, ${baseOpacity})`,
        hoverColor: `rgba(${lgaBaseColor}, ${hoverOpacity})`,
        selectColor: `rgb(${lgaBaseColor})`,
        strokeWidth: 10,
        hoverStrokeWidth: 14,
    },
    locality: {
        baseColor: `rgba(${localityBaseColor}, ${baseOpacity})`,
        hoverColor: `rgba(${localityBaseColor}, ${hoverOpacity})`,
        selectColor: `rgb(${localityBaseColor})`,
        strokeWidth: 10,
        hoverStrokeWidth: 14,
        minZoom: 10,
    },
};
export const GEOGRAPHICAL_NAME_OBJECT_PART = "https://linked.data.gov.au/def/addr-part-types/geographicName"
export const PROPERTY_NAME_PART = "https://linked.data.gov.au/def/addr-part-types/propertyName"
export const BUILDING_NAME_PART = "https://linked.data.gov.au/def/addr-part-types/buildingName"
export const SUBADDRESS_TYPE_PART = "https://linked.data.gov.au/def/addr-part-types/subaddressType"
export const SUBADDRESS_NUMBER_PART = "https://linked.data.gov.au/def/addr-part-types/subaddressNumber"
export const SUBADDRESS_NUMBER_SUFFIX_PART = "https://linked.data.gov.au/def/addr-part-types/subaddressNumberSuffix"
export const BUILDING_LEVEL_TYPE_PART = "https://linked.data.gov.au/def/addr-part-types/buildingLevelType"
export const BUILDING_LEVEL_NUMBER_PART = "https://linked.data.gov.au/def/addr-part-types/buildingLevelNumber"
export const BUILDING_LEVEL_NUMBER_SUFFIX_PART = "https://linked.data.gov.au/def/addr-part-types/buildingLevelNumberSuffix"
export const STREET_NUMBER_FIRST_PART = "https://linked.data.gov.au/def/addr-part-types/addressNumberFirst"
export const STREET_NUMBER_FIRST_SUFFIX_PART = "https://linked.data.gov.au/def/addr-part-types/addressNumberFirstSuffix"
export const STREET_NUMBER_LAST_PART = "https://linked.data.gov.au/def/addr-part-types/addressNumberLast"
export const STREET_NUMBER_LAST_SUFFIX_PART = "https://linked.data.gov.au/def/addr-part-types/addressNumberLastSuffix"
export const STREET_PART = "https://linked.data.gov.au/def/addr-part-types/road"
export const LOCALITY_PART = "https://linked.data.gov.au/def/addr-part-types/locality"
export const STATE_OR_TERRITORY_PART = "https://linked.data.gov.au/def/addr-part-types/stateOrTerritory"
export const POSTCODE_PART = "https://linked.data.gov.au/def/addr-part-types/postcode"

export const WATER_FEATURE_NUMBER_PART = "https://linked.data.gov.au/def/addr-part-types/addressNumberFirst"
export const WATER_FEATURE_NAME_PART = "https://linked.data.gov.au/def/addr-part-types/waterFeature"
export const WATER_FEATURE_TYPE_PART = "https://linked.data.gov.au/def/addr-part-types/waterFeatureType"

export const drawStyle: {
    strokeWidth: number;
    strokeColor: string;
    fillColor: string;
    radius: number;
    circleColor: string;
    circleStrokeWidth: number;
    circleStrokeColor: string;
} = {
    strokeWidth: 2,
    strokeColor: "blue",
    fillColor: "rgba(125, 125, 255, 0.4)",
    radius: 6,
    circleColor: "rgba(125, 125, 255, 0.4)",
    circleStrokeWidth: 1,
    circleStrokeColor: "black",
};
export const hoverStyle: {
    strokeWidth: number;
    strokeColor: string;
    fillColor: string;
    radius: number;
    circleColor: string;
    circleStrokeWidth: number;
    circleStrokeColor: string;
} = {
    strokeWidth: 4,
    strokeColor: "blue",
    fillColor: "rgba(125, 125, 255, 0.8)",
    radius: 6,
    circleColor: "rgba(125, 125, 255, 0.48",
    circleStrokeWidth: 1,
    circleStrokeColor: "black",
};