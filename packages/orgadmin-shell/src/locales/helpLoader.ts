/**
 * Help Content Loader
 * 
 * Loads help content from individual markdown files per module/page.
 * Files are named as {moduleId}-{pageId}.md (e.g., events-overview.md, users-list.md).
 * 
 * This allows help content to be maintained in separate, easy-to-edit markdown files
 * rather than embedded as escaped strings in a single JSON file.
 * 
 * The loader builds the nested structure expected by i18n:
 *   { moduleId: { pageId: "markdown content" } }
 */

type HelpContent = Record<string, Record<string, string>>;

/**
 * Parse a help markdown filename into moduleId and pageId.
 * Filename format: {moduleId}-{pageId}.md
 * Example: "events-overview.md" -> { moduleId: "events", pageId: "overview" }
 *          "users-create.md" -> { moduleId: "users", pageId: "create" }
 */
function parseHelpFilename(filepath: string): { moduleId: string; pageId: string } | null {
  // Extract just the filename from the path
  const filename = filepath.split('/').pop()?.replace('.md', '');
  if (!filename) return null;

  // Split on first hyphen only (moduleId can't have hyphens, but pageId could in future)
  const dashIndex = filename.indexOf('-');
  if (dashIndex === -1) return null;

  return {
    moduleId: filename.substring(0, dashIndex),
    pageId: filename.substring(dashIndex + 1),
  };
}

/**
 * Build help content object from a glob import result.
 * Takes the raw markdown imports and structures them for i18n.
 */
function buildHelpContent(modules: Record<string, string>): HelpContent {
  const content: HelpContent = {};

  for (const [filepath, markdown] of Object.entries(modules)) {
    const parsed = parseHelpFilename(filepath);
    if (!parsed) continue;

    if (!content[parsed.moduleId]) {
      content[parsed.moduleId] = {};
    }
    content[parsed.moduleId][parsed.pageId] = markdown;
  }

  return content;
}

// Import all markdown help files for each locale using Vite's glob import
// The ?raw suffix imports the file content as a string
const enGBFiles = import.meta.glob('./en-GB/help/*.md', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;
const deDEFiles = import.meta.glob('./de-DE/help/*.md', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;
const frFRFiles = import.meta.glob('./fr-FR/help/*.md', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;
const esESFiles = import.meta.glob('./es-ES/help/*.md', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;
const itITFiles = import.meta.glob('./it-IT/help/*.md', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;
const ptPTFiles = import.meta.glob('./pt-PT/help/*.md', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;

// Build structured help content per locale
export const helpContent: Record<string, HelpContent> = {
  'en-GB': buildHelpContent(enGBFiles),
  'de-DE': buildHelpContent(deDEFiles),
  'fr-FR': buildHelpContent(frFRFiles),
  'es-ES': buildHelpContent(esESFiles),
  'it-IT': buildHelpContent(itITFiles),
  'pt-PT': buildHelpContent(ptPTFiles),
};

/**
 * Get help content for a specific locale, module, and page.
 * Falls back to en-GB if the requested locale doesn't have the content.
 */
export function getHelpContent(locale: string, moduleId: string, pageId: string): string | null {
  // Try requested locale first
  const content = helpContent[locale]?.[moduleId]?.[pageId];
  if (content) return content;

  // Try module overview as fallback
  const overview = helpContent[locale]?.[moduleId]?.['overview'];
  if (overview) return overview;

  // Fall back to en-GB
  const enContent = helpContent['en-GB']?.[moduleId]?.[pageId];
  if (enContent) return enContent;

  const enOverview = helpContent['en-GB']?.[moduleId]?.['overview'];
  if (enOverview) return enOverview;

  return null;
}
