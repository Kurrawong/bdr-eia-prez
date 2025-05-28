export default defineAppConfig({
    // nav menu, name substitutions, breadcrumbs prepend & pagination config goes here
    menu: (defaultMenu) => [
        { "label": "Home", "url": "/", "active": true },
        { "label": "Catalogs", "url": "/catalogs", "active": true },
        { "label": "Search", "url": "/search", "active": true },
        { "label": "SPARQL", "url": "/sparql", "active": true },
        { "label": "Profiles", "url": "/profiles", "active": true },
        { "label": "About", "url": "/about", "active": true },
        { "label": "API Documentation", "url": "/docs", "active": true },
        { "label": "EIA Demonstrator", "url": "/eia-demo", "active": true }
    ]
});

declare module '@nuxt/schema' {
    interface AppConfigInput {
        menu?: Array<{ label: string, url: string, active?: boolean }>,
        nameSubstitutions?: Record<string, string>,
        breadcrumbPrepend?: Array<{ label: string, url: string }>,
        utilsMenu?: Array<{ label: string, url: string }>
    }
}
