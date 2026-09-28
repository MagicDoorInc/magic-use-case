import path from 'node:path';

export type Layer = 'useCases' | 'presenters' | 'gateways' | 'state' | 'types' | 'ui';

export interface LayerSettings {
  src: string;
  aliases: string[];
  folders: Record<Layer, string[]>;
}

export interface ArchitectureOptions {
  src?: string;
  aliases?: string[];
  folders?: Partial<Record<Layer, string | string[]>>;
}

export const DEFAULT_FOLDERS: Record<Layer, string[]> = {
  useCases: ['use-cases'],
  presenters: ['presenters'],
  gateways: ['gateways'],
  state: ['state'],
  types: ['types', 'entities'],
  ui: ['components', 'routes', 'screens', 'pages', 'global-contexts'],
};

export const SETTINGS_KEY = '@magicdoor';

export function layerSettings(options: ArchitectureOptions = {}): LayerSettings {
  const folders = { ...DEFAULT_FOLDERS };
  for (const [layer, value] of Object.entries(options.folders ?? {}) as [Layer, string | string[] | undefined][]) {
    if (value !== undefined) folders[layer] = Array.isArray(value) ? value : [value];
  }
  return { src: options.src ?? 'src', aliases: options.aliases ?? ['~/', '@/', 'src/'], folders };
}

export function readLayerSettings(settings: Record<string, unknown>): LayerSettings {
  return (settings[SETTINGS_KEY] as { layers?: LayerSettings } | undefined)?.layers ?? layerSettings();
}

function layerOfSegment(settings: LayerSettings, segment: string | undefined): Layer | undefined {
  if (!segment) return undefined;
  return (Object.keys(settings.folders) as Layer[]).find((layer) => settings.folders[layer].includes(segment));
}

export function segmentsUnderSrc(settings: LayerSettings, filename: string, cwd: string): string[] | undefined {
  const relative = path.relative(cwd, filename).split(path.sep);
  const start = relative.indexOf(settings.src);
  return start === -1 ? undefined : relative.slice(start + 1);
}

export function layerOfFile(settings: LayerSettings, filename: string, cwd: string): { layer?: Layer; inSrc: boolean } {
  const segments = segmentsUnderSrc(settings, filename, cwd);
  if (!segments) return { inSrc: false };
  return { layer: layerOfSegment(settings, segments[0]), inSrc: true };
}

export interface ImportTarget {
  layer: Layer;
  rest: string[];
}

export function layerOfImport(
  settings: LayerSettings,
  source: string,
  filename: string,
  cwd: string,
): ImportTarget | undefined {
  let segments: string[] | undefined;
  if (source.startsWith('.')) {
    segments = segmentsUnderSrc(settings, path.resolve(path.dirname(filename), source), cwd);
  } else {
    const alias = settings.aliases.find((prefix) => source.startsWith(prefix));
    if (alias !== undefined) segments = source.slice(alias.length).split('/');
  }
  if (!segments) return undefined;
  const layer = layerOfSegment(settings, segments[0]);
  return layer ? { layer, rest: segments.slice(1) } : undefined;
}
