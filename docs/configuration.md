# 設定ファイル (Configuration)

`spec-tools` は、リポジトリのルートに配置された設定ファイル（`spec-tools.config.ts`, `spec-tools.config.js`, または `spec-tools.config.mjs`）から設定を読み込みます。

以下は、利用可能なすべての設定項目を含む設定例です。

```typescript
export default {
  // --- 仕様カバレッジ (spec:coverage) 関連 ---
  specCoverage: {
    // 条項IDが必須となるルートディレクトリのリスト
    conformanceRoots: ['packages', 'examples'],
    
    // コードやテスト内の条項IDを走査する対象のルートディレクトリ
    scanRoots: ['packages', 'tools', 'examples', 'apps'],
    
    // ソースコードとして走査する拡張子
    sourceExtensions: ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'],
    
    // テストファイルとみなす接尾辞
    testSuffixes: ['.test.ts'],
    
    // テスト名から ID 等を抽出する際の正規表現
    testNamePatterns: [
      '\\b(?:it|test)(?:\\.\\w+)?\\(\\s*(?:"((?:[^"\\\\]|\\\\.)*)"|\'((?:[^\'\\\\]|\\\\.)*)\')'
    ],
    
    // 条項仕様ファイルが含まれるルート（省略時は動的に発見される）
    specRoots: undefined,
  },

  // --- 文書参照 (doc-ref) 関連 ---
  docRef: {
    // decision ドキュメントが格納されるディレクトリ
    decisionDir: 'docs/decisions',
    
    // task ドキュメントが格納されるディレクトリ
    taskDir: 'docs/task',
    
    // namespaced 参照の抽出・解決用パターン
    namespacePattern: '(@kata2\\/[a-z0-9_-]+|kata2)',
    
    // 参照チェックを無視する過去ドキュメントの接頭辞
    historicalPrefixes: [
      'docs/acceptance/',
      'docs/plan/0_1/done/',
      'docs/history/'
    ],
  },

  // --- 雛形生成 (scaffold) 関連 ---
  scaffold: {
    // テンプレート(decision.md 等)が置かれている上書き用ディレクトリのパス
    templateDir: 'templates',
    
    // 採番する連番の最低開始番号
    startNumber: 200,
  },

  // --- spec 索引 (spec-index) 関連 ---
  specIndex: {
    // 索引のヘッダとして出力する文字列、または .md ファイルへの相対パス
    header: 'docs/custom-index-header.md',
  },

  // --- 条項フォーマット (Clause Format) 関連 ---
  clauseFormat: {
    // 条項IDにマッチする正規表現
    idPattern: '(K-[A-Z0-9]+(?:-[A-Z0-9]+)*)',
    
    // 条項の直後に続く属性(status, since, kind, impl)を抽出する正規表現
    attrPattern: '\\*\\*属性\\*\\*:\\s*`status:\\s*([^`]+)`(?:,\\s*`since:\\s*([^`]+)`)?(?:,\\s*`kind:\\s*([^`]+)`)?(?:,\\s*`impl:\\s*([^`]+)`)?',
    
    // "規範"（Must要件）として扱う kind の文字列リスト
    normativeKinds: ['規範'],
    
    // "アクティブ" として扱う status の文字列リスト
    activeStatuses: ['active'],
  },

  // --- ミラーリング (check-mirror) 関連 ---
  checkMirror: {
    // 比較するルートの組 (2つのディレクトリ名)
    mirrorRoots: ['.claude', '.agents'],
    
    // 比較対象とするサブツリー（ディレクトリ）のリスト
    mirroredSubtrees: ['skills'],
    
    // ディレクトリ外で比較するファイルのペアリスト
    mirroredFilePairs: [
      ['CLAUDE.md', 'AGENTS.md']
    ],
  }
};
```
