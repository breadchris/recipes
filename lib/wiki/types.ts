/**
 * Wiki content types for static rendering from Supabase backups
 */

/**
 * A single page within a wiki backup
 */
export interface WikiBackupPage {
  /** Page path (e.g., "index", "guide/intro") */
  path: string;
  /** Page title */
  title: string;
  /** Full HTML content */
  html: string;
  /** Markdown content */
  markdown: string;
}

/**
 * Data stored in content.data for wiki backups
 */
export interface WikiBackupData {
  pages: WikiBackupPage[];
}

/**
 * Metadata for a wiki backup
 */
export interface WikiBackupMetadata {
  wiki_id: string;
  wiki_title: string;
  backup_date: string;
  page_count: number;
}

/**
 * Navigation tree item for sidebar
 */
export interface WikiNavItem {
  path: string;
  title: string;
  children?: WikiNavItem[];
}

/**
 * Complete wiki data with indexed pages and navigation tree
 */
export interface WikiData {
  metadata: WikiBackupMetadata;
  pages: Map<string, WikiBackupPage>;
  pageTree: WikiNavItem[];
}
