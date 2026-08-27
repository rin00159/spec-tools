# Configuration

`spec-tools` loads its configuration from a file named `spec-tools.config.json` located at the root of your repository.
*Note: Because this is a JSON file, regular expressions must use double-escaped backslashes (e.g., `\\b`).*

Below is an example configuration that includes all available settings.

```json
{
  "specRoots": ["spec", "packages"],
  
  "checkCurrentTask": {
    "file": "docs/task/README.md",
    "maxLines": 30,
    "headings": ["Current Work", "Next Steps"]
  },

  "checkPlanLayout": {
    "planDir": "docs/plan",
    "scanRoots": ["docs", "packages"],
    "rootFiles": ["README.md"]
  },

  "specCoverage": {
    "conformanceRoots": ["packages", "examples"],
    "scanRoots": ["packages", "tools", "examples", "apps"],
    "sourceExtensions": [".ts", ".tsx", ".js", ".mjs", ".cjs", ".json"],
    "testSuffixes": [".test.ts"],
    "testNamePatterns": [
      "\\b(?:it|test)(?:\\.\\w+)?\\(\\s*(?:\"((?:[^\"]|\\\\.)*)\"|'((?:[^']|\\\\.)*)')"
    ]
  },

  "docRef": {
    "decisionDir": "docs/decisions",
    "taskDir": "docs/task",
    "namespacePattern": "(@kata2\\/[a-z0-9_-]+|kata2)",
    "historicalPrefixes": [
      "docs/acceptance/",
      "docs/plan/0_1/done/",
      "docs/history/"
    ],
    "examplePatterns": [
      "(?:例|例:|e\\.g\\.|Example|使い方:)\\s*[`(]?@kata2\\/"
    ],
    "indexHeader": "docs/custom-index-header.md",
    "statePattern": "^\\*\\*(?:状態|State)\\*\\*:\\s*(.+)$",
    "stubPattern": "\\*\\*(?:移設先|Moved To)\\*\\*:\\s*`([^`]+)`"
  },

  "scaffold": {
    "templateDir": "templates",
    "startNumber": 200,
    "planDirTemplate": "docs/plan/{{major}}_{{minor}}",
    "planFileTemplate": "{{planDir}}/phase{{phase}}.md",
    "acceptanceFileTemplate": "docs/acceptance/phase-v{{major}}_{{minor}}-{{phase}}.md"
  },

  "specIndex": {
    "header": "docs/custom-spec-index-header.md"
  },

  "clauseFormat": {
    "idPattern": "(K-[A-Z0-9]+(?:-[A-Z0-9]+)*)",
    "headingPattern": "^##\\s+(?<id>(?:K-[A-Z0-9]+(?:-[A-Z0-9]+)*))\\s+(?<title>.+)$",
    "attrPattern": "\\*\\*Attributes\\*\\*:\\s*`status:\\s*([^`]+)`(?:,\\s*`since:\\s*([^`]+)`)?(?:,\\s*`kind:\\s*([^`]+)`)?(?:,\\s*`impl:\\s*([^`]+)`)?",
    "normativeKinds": ["Normative"],
    "activeStatuses": ["active"]
  },

  "checkMirror": {
    "mirrorRoots": [".claude", ".agents"],
    "mirroredSubtrees": ["skills"],
    "mirroredFilePairs": [
      ["CLAUDE.md", "AGENTS.md"]
    ]
  }
}
```
