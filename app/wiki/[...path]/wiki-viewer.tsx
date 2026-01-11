'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Menu, X, ChevronRight, ChevronDown, FileText, Home } from 'lucide-react';
import type { WikiBackupPage, WikiNavItem } from '@/lib/wiki/types';

interface WikiViewerProps {
  page: WikiBackupPage;
  pageTree: WikiNavItem[];
  wikiTitle: string;
  currentPath: string;
}

interface PageTreeNodeProps {
  node: WikiNavItem;
  currentPath: string;
  depth?: number;
}

function PageTreeNode({ node, currentPath, depth = 0 }: PageTreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(
    currentPath === node.path || currentPath.startsWith(node.path + '/')
  );
  const hasChildren = node.children && node.children.length > 0;
  const isActive = currentPath === node.path;
  const isIndex = node.path === 'index';

  return (
    <div>
      <div className="flex items-center">
        {hasChildren && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="w-3 h-3 text-zinc-500" />
            ) : (
              <ChevronRight className="w-3 h-3 text-zinc-500" />
            )}
          </button>
        )}
        <Link
          href={`/wiki/${node.path}`}
          className={`flex-1 flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${
            isActive
              ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 font-medium'
              : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          } ${!hasChildren ? 'ml-5' : ''}`}
        >
          {isIndex ? (
            <Home className="w-4 h-4 flex-shrink-0" />
          ) : (
            <FileText className="w-4 h-4 flex-shrink-0" />
          )}
          <span className="truncate">{node.title}</span>
        </Link>
      </div>
      {hasChildren && isExpanded && (
        <div className="ml-4 mt-1 space-y-1">
          {node.children!.map((child) => (
            <PageTreeNode
              key={child.path}
              node={child}
              currentPath={currentPath}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PageTree({ nodes, currentPath }: { nodes: WikiNavItem[]; currentPath: string }) {
  return (
    <div className="space-y-1">
      {nodes.map((node) => (
        <PageTreeNode key={node.path} node={node} currentPath={currentPath} />
      ))}
    </div>
  );
}

export function WikiViewer({ page, pageTree, wikiTitle, currentPath }: WikiViewerProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();

  // Handle clicks on internal wiki links
  const handleContentClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const link = target.closest('a');
    if (link) {
      const href = link.getAttribute('href');
      // Handle internal wiki links (relative paths without http/https)
      if (href && !href.startsWith('http://') && !href.startsWith('https://') && !href.startsWith('#')) {
        e.preventDefault();
        // Normalize the path
        const normalizedPath = href.startsWith('/wiki/')
          ? href
          : `/wiki/${href.replace(/^\//, '')}`;
        router.push(normalizedPath);
      }
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      {/* Mobile header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white dark:bg-black border-b border-zinc-200 dark:border-zinc-800 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
        >
          <Menu className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
        </button>
        <Link href="/" className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
          <Home className="w-5 h-5" />
        </Link>
        <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
          {page.title}
        </span>
      </header>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/50"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-72
          bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800
          transform transition-transform duration-200 lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
          <Link
            href="/wiki/index"
            className="font-semibold text-zinc-900 dark:text-zinc-100 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
          >
            {wikiTitle}
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
          </button>
        </div>

        {/* Back to recipes link */}
        <div className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-800">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
          >
            <Home className="w-4 h-4" />
            <span>Back to Recipes</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="p-3 overflow-y-auto h-[calc(100%-120px)]">
          <PageTree nodes={pageTree} currentPath={currentPath} />
        </nav>
      </aside>

      {/* Main content */}
      <main className="lg:ml-72 pt-16 lg:pt-0">
        <article className="max-w-4xl mx-auto px-6 py-8">
          {/* Page title */}
          <header className="mb-8">
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
              {page.title}
            </h1>
            {currentPath !== 'index' && (
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                {currentPath}
              </p>
            )}
          </header>

          {/* Content */}
          <div
            className="prose prose-zinc dark:prose-invert max-w-none
              prose-headings:font-semibold
              prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-4
              prose-h3:text-xl prose-h3:mt-6 prose-h3:mb-3
              prose-p:leading-relaxed
              prose-a:text-orange-600 dark:prose-a:text-orange-400 prose-a:no-underline hover:prose-a:underline
              prose-code:bg-zinc-100 dark:prose-code:bg-zinc-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
              prose-pre:bg-zinc-100 dark:prose-pre:bg-zinc-800
              prose-img:rounded-lg
              prose-ul:my-4 prose-ol:my-4
              prose-li:my-1"
            onClick={handleContentClick}
            dangerouslySetInnerHTML={{ __html: page.html }}
          />
        </article>
      </main>
    </div>
  );
}
