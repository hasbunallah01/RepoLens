/**
 * Map a file extension → human-readable language label.
 * Used for the language breakdown and file tree display.
 */

const LANG_BY_EXT: Record<string, string> = {
  ts: "TypeScript",
  tsx: "TypeScript",
  js: "JavaScript",
  jsx: "JavaScript",
  mjs: "JavaScript",
  cjs: "JavaScript",
  py: "Python",
  rb: "Ruby",
  go: "Go",
  rs: "Rust",
  java: "Java",
  kt: "Kotlin",
  kts: "Kotlin",
  swift: "Swift",
  m: "Objective-C",
  mm: "Objective-C++",
  c: "C",
  h: "C",
  cpp: "C++",
  cc: "C++",
  cxx: "C++",
  hpp: "C++",
  cs: "C#",
  php: "PHP",
  sh: "Shell",
  bash: "Shell",
  zsh: "Shell",
  ps1: "PowerShell",
  sql: "SQL",
  html: "HTML",
  htm: "HTML",
  css: "CSS",
  scss: "SCSS",
  sass: "Sass",
  less: "Less",
  vue: "Vue",
  svelte: "Svelte",
  md: "Markdown",
  mdx: "MDX",
  json: "JSON",
  yaml: "YAML",
  yml: "YAML",
  toml: "TOML",
  xml: "XML",
  ini: "INI",
  dockerfile: "Dockerfile",
  makefile: "Makefile",
  graphql: "GraphQL",
  gql: "GraphQL",
  dart: "Dart",
  lua: "Lua",
  r: "R",
  jl: "Julia",
  zig: "Zig",
  ex: "Elixir",
  exs: "Elixir",
  erl: "Erlang",
  hs: "Haskell",
  scala: "Scala",
  clj: "Clojure",
  pl: "Perl",
  tex: "TeX",
};

const LANG_BY_FILENAME: Record<string, string> = {
  Dockerfile: "Dockerfile",
  Makefile: "Makefile",
  ".bashrc": "Shell",
  ".zshrc": "Shell",
  ".gitignore": "Git",
  ".gitattributes": "Git",
  ".editorconfig": "EditorConfig",
  ".eslintrc": "JavaScript",
  ".prettierrc": "JavaScript",
  Procfile: "Procfile",
  README: "Markdown",
  LICENSE: "Text",
};

export function languageForFile(path: string): string {
  const fileName = path.split("/").pop() ?? path;
  if (LANG_BY_FILENAME[fileName]) return LANG_BY_FILENAME[fileName]!;

  const dot = fileName.lastIndexOf(".");
  if (dot <= 0) return "Other";
  const ext = fileName.slice(dot + 1).toLowerCase();
  return LANG_BY_EXT[ext] ?? "Other";
}

export function extensionOf(path: string): { ext: string; key: string } {
  const fileName = path.split("/").pop() ?? path;
  const dot = fileName.lastIndexOf(".");
  if (dot <= 0) return { ext: "", key: "" };
  const key = fileName.slice(dot + 1).toLowerCase();
  return { ext: fileName.slice(dot), key };
}
