import { createServerSupabaseClient } from '@/lib/clients/supabaseServer';
import type {
  WikiBackupData,
  WikiBackupMetadata,
  WikiBackupPage,
  WikiData,
  WikiNavItem,
} from './types';

/**
 * Get the parent path for a given path
 * e.g., "guide/intro/basics" -> "guide/intro"
 */
function getParentPath(path: string): string | null {
  const parts = path.split('/');
  if (parts.length <= 1) return null;
  return parts.slice(0, -1).join('/');
}

/**
 * Build a hierarchical navigation tree from flat page list
 */
function buildPageTree(pages: WikiBackupPage[]): WikiNavItem[] {
  const tree: WikiNavItem[] = [];
  const nodeMap = new Map<string, WikiNavItem>();

  // Sort pages by path depth (shorter paths first) to ensure parents exist before children
  const sortedPages = [...pages].sort((a, b) => {
    const depthA = a.path.split('/').length;
    const depthB = b.path.split('/').length;
    return depthA - depthB;
  });

  // Create nodes for all pages
  for (const page of sortedPages) {
    nodeMap.set(page.path, {
      path: page.path,
      title: page.title,
      children: [],
    });
  }

  // Build hierarchy
  for (const page of sortedPages) {
    const node = nodeMap.get(page.path)!;
    const parentPath = getParentPath(page.path);

    if (parentPath && nodeMap.has(parentPath)) {
      nodeMap.get(parentPath)!.children!.push(node);
    } else {
      tree.push(node);
    }
  }

  // Sort nodes (index first, then alphabetically)
  const sortNodes = (nodes: WikiNavItem[]) => {
    nodes.sort((a, b) => {
      // Index always first
      if (a.path === 'index') return -1;
      if (b.path === 'index') return 1;
      // Then alphabetically by title
      return a.title.localeCompare(b.title);
    });
    for (const node of nodes) {
      if (node.children && node.children.length > 0) {
        sortNodes(node.children);
      }
    }
  };
  sortNodes(tree);

  return tree;
}

/**
 * Fetch wiki data for a specific wiki ID
 * Returns the latest backup with pages indexed by path
 */
export async function getWikiData(wikiId: string): Promise<WikiData | null> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('content')
    .select('data, metadata')
    .eq('type', 'wiki-backup')
    .eq('parent_content_id', wikiId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    console.error('Failed to fetch wiki backup:', error);
    return null;
  }

  const backupData = (typeof data.data === 'string'
    ? JSON.parse(data.data)
    : data.data) as WikiBackupData;
  const metadata = data.metadata as WikiBackupMetadata;

  // Index pages by path for O(1) lookup
  const pages = new Map<string, WikiBackupPage>();
  for (const page of backupData.pages) {
    pages.set(page.path, page);
  }

  // Build navigation tree
  const pageTree = buildPageTree(backupData.pages);

  return { metadata, pages, pageTree };
}

/**
 * Get a single wiki page by path
 */
export async function getWikiPage(
  wikiId: string,
  pagePath: string
): Promise<WikiBackupPage | null> {
  const data = await getWikiData(wikiId);
  if (!data) return null;
  return data.pages.get(pagePath) || null;
}

/**
 * Get all page paths for static generation
 */
export async function getAllWikiPagePaths(wikiId: string): Promise<string[]> {
  const data = await getWikiData(wikiId);
  if (!data) return [];
  return Array.from(data.pages.keys());
}
