/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MAPBOX_TOKEN: string;
  readonly VITE_PERPLEXITY_API_KEY: string;
  readonly VITE_OPENROUTER_API_KEY: string;
  readonly VITE_IMAGE_MODEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
