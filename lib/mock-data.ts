// Mock data for RepoLens — swap these with live API responses later

export const EXAMPLE_REPOS = [
  'vercel/next.js',
  'facebook/react',
  'microsoft/vscode',
  'sequelize/sequelize',
];

export const MOCK_REPO = {
  owner: 'vercel',
  name: 'next.js',
  fullName: 'vercel / next.js',
  description: 'The React Framework for the Web',
  url: 'https://nextjs.org',
  stars: '125k',
  forks: '24.3k',
  defaultBranch: 'canary',
  license: 'MIT',
  fileCount: 2104,
  directoryCount: 593,
  linesOfCode: '1.2M',
  primaryLanguage: 'TypeScript',
  about:
    'Next.js is a React framework that gives you building blocks to create fast, full-stack web applications.',
};

export const MOCK_ANALYSIS_STEPS = [
  { id: 1, label: 'Connecting to GitHub', status: 'done' as const },
  { id: 2, label: 'Fetching Repository', status: 'done' as const },
  { id: 3, label: 'Indexing Files', status: 'done' as const },
  { id: 4, label: 'Building Context', status: 'active' as const },
  { id: 5, label: 'Generating Insights', status: 'pending' as const },
];

export const MOCK_ANALYSIS_PROGRESS = {
  percent: 87,
  elapsed: '00:00:28',
  analyzed: 1842,
  total: 2104,
};

export const MOCK_LANGUAGES = [
  { name: 'TypeScript', percent: 60.1, color: '#3178C6' },
  { name: 'JavaScript', percent: 20.4, color: '#F7DF1E' },
  { name: 'CSS', percent: 8.7, color: '#F59E0B' },
  { name: 'MDX', percent: 5.2, color: '#A855F7' },
  { name: 'Other', percent: 5.6, color: '#9CA3AF' },
];

export const MOCK_REPO_STRUCTURE = [
  {
    name: 'next.js',
    type: 'folder' as const,
    children: [
      { name: '.github', type: 'folder' as const },
      { name: '.next', type: 'folder' as const },
      { name: 'apps', type: 'folder' as const },
      { name: 'packages', type: 'folder' as const },
      { name: 'scripts', type: 'folder' as const },
      { name: 'test', type: 'folder' as const },
      { name: 'tools', type: 'folder' as const },
    ],
  },
];

export const MOCK_COMMITS = [
  { id: 'a1b2c3d', message: 'Update turbopack configuration', author: 'ljk', avatar: 'L', time: '2 hours ago' },
  { id: 'd4e5f6g', message: 'Fix: handle edge runtime headers', author: 'huuchi', avatar: 'H', time: '5 hours ago' },
  { id: 'h7i8j9k', message: 'Docs: update getStaticProps docs', author: 'icy.joseph', avatar: 'I', time: '7 hours ago' },
  { id: 'l0m1n2o', message: 'Refactor: improve build output', author: 'timneudkens', avatar: 'T', time: '1 day ago' },
  { id: 'p3q4r5s', message: 'Test: add missing edge cases', author: 'styfile', avatar: 'S', time: '1 day ago' },
];

export const MOCK_INDEXED_FILES = [
  { path: 'packages/next/src/server/app-render/app-render.tsx', lang: 'TSX' },
  { path: 'packages/next/src/server/request/index.ts', lang: 'TS' },
  { path: 'packages/next/src/client/app-index.tsx', lang: 'TSX' },
  { path: 'packages/next/build/index.ts', lang: 'TS' },
  { path: 'packages/next/package.json', lang: 'JSON' },
  { path: 'packages/next/README.md', lang: 'MD' },
  { path: 'packages/next/src/shared/lib/utils.ts', lang: 'TS' },
  { path: 'packages/next/src/server/base-server.ts', lang: 'TS' },
];

export const MOCK_FEATURES = [
  { icon: 'Zap', title: 'Fast Analysis', description: 'Analyze repositories in seconds with our optimized engine.' },
  { icon: 'Bot', title: 'AI-Powered Answers', description: 'Get accurate, context-aware answers to your questions.' },
  { icon: 'Files', title: 'Smart File Ranking', description: 'We rank and select the most relevant files for better answers.' },
  { icon: 'LayoutTemplate', title: 'Architecture Insights', description: 'Understand the overall structure and design patterns.' },
  { icon: 'Search', title: 'Context-Aware Search', description: 'Search and explore with deep understanding of the codebase.' },
  { icon: 'Globe', title: 'Public Repos Only', description: 'Works with any public GitHub repository instantly.' },
];
