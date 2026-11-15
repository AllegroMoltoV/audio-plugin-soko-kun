// 審査の基準と推奨のうち、ファイルを見れば機械的に決まる項目の判定 (docs/design/review-criteria.md)。
// 同じ入力には同じ結果を返す純粋な関数にする。LLM には、ここで計算した事実を渡し、文章の意図を読む項目だけを判定させる。
import type { RulesetSnapshot } from '../github';
import type { Finding, FindingResult } from './llm';
import type { NetworkScan } from './network';

export interface RepositorySnapshot {
  // ref の時点のファイルのパスの一覧。
  paths: string[];
  // 一覧が切り詰められたか、得られなかった。ファイルの有無で決める判定を unclear にする。
  truncated: boolean;
  files: Array<{ path: string; content: string }>;
  // 上限のため読まなかったファイル。
  unreadFiles: string[];
  // 通信の API の検出の結果。null か未設定なら、検出していない (確認のモード、待つ期限の超過、検出の失敗)。
  network?: NetworkScan | null;
  // 有効な ruleset。未設定か readable が false なら、読めなかった。
  rulesets?: ({ readable: true } & RulesetSnapshot) | { readable: false };
}

type Evidence = Finding['evidence'][number];

const SHA = /^[0-9a-f]{40}$/;
const WORKFLOW = /^\.github\/workflows\//;
const BINARY = /\.(dll|lib|so|dylib|a|exe)$/i;
// ルールが読むビルドの設定。取得するのはリポジトリのルートのファイルだけ (docs/design/scanning.md)。
const BUILD_CONFIGS = ['CMakeLists.txt', 'meson.build', 'Cargo.toml'];

function finding(id: string, result: FindingResult, explanation: string, evidence: Evidence[] = []): Finding {
  return { id, result, serious: false, explanation, evidence: evidence.slice(0, 5) };
}

// 正規表現に当たる行の番号 (1 始まり) と、その行の文字列。
function matchingLines(content: string, pattern: RegExp): Array<{ line: number; text: string }> {
  const result: Array<{ line: number; text: string }> = [];
  content.split('\n').forEach((text, index) => {
    if (pattern.test(text)) result.push({ line: index + 1, text });
  });
  return result;
}

function at(file: string, line: number): Evidence {
  return { file, lines: `${line}-${line}` };
}

function file(snapshot: RepositorySnapshot, path: string): string | undefined {
  return snapshot.files.find((entry) => entry.path === path)?.content;
}

function readme(snapshot: RepositorySnapshot): { path: string; content: string } | undefined {
  return snapshot.files.find((entry) => entry.path === 'README.md');
}

function buildFiles(snapshot: RepositorySnapshot): Array<{ path: string; content: string }> {
  return snapshot.files.filter((entry) => BUILD_CONFIGS.includes(entry.path));
}

function workflows(snapshot: RepositorySnapshot): Array<{ path: string; content: string }> {
  return snapshot.files.filter((entry) => WORKFLOW.test(entry.path));
}

function unreadWorkflows(snapshot: RepositorySnapshot): boolean {
  return snapshot.unreadFiles.some((path) => WORKFLOW.test(path));
}

function ciHardening(snapshot: RepositorySnapshot): Finding {
  const id = 'ci-hardening';
  const flows = workflows(snapshot);
  if (snapshot.truncated)
    return finding(id, 'unclear', 'Checked by rules: the repository file list was too large to read in full.');
  if (flows.length === 0 && !unreadWorkflows(snapshot))
    return finding(id, 'not_applicable', 'The repository has no GitHub Actions workflows.');
  const problems: Evidence[] = [];
  const reasons = new Set<string>();
  for (const flow of flows) {
    if (!/^\s*permissions\s*:/m.test(flow.content)) {
      problems.push({ file: flow.path });
      reasons.add('a workflow does not set permissions');
    }
    for (const { line } of matchingLines(flow.content, /write-all/)) {
      problems.push(at(flow.path, line));
      reasons.add('a workflow grants write-all');
    }
    for (const { line, text } of matchingLines(flow.content, /^\s*-?\s*uses\s*:/)) {
      const ref = /uses\s*:\s*['"]?([^\s'"#]+)/.exec(text)?.[1] ?? '';
      if (ref.startsWith('./') || ref.startsWith('docker://')) continue;
      if (!SHA.test(ref.split('@')[1] ?? '')) {
        problems.push(at(flow.path, line));
        reasons.add('an action is not pinned to a full commit SHA');
      }
    }
    const checkouts = matchingLines(flow.content, /uses\s*:\s*['"]?actions\/checkout@/).length;
    const persist = matchingLines(flow.content, /persist-credentials\s*:\s*['"]?false/).length;
    if (persist < checkouts) {
      problems.push({ file: flow.path });
      reasons.add('a checkout step does not set persist-credentials: false');
    }
  }
  if (!snapshot.paths.some((path) => /^\.github\/dependabot\.ya?ml$/.test(path)))
    reasons.add('Dependabot is not configured');
  if (reasons.size > 0) return finding(id, 'not_met', `Checked by rules: ${[...reasons].join('; ')}.`, problems);
  if (unreadWorkflows(snapshot))
    return finding(
      id,
      'unclear',
      'Checked by rules: the workflows that were read meet the rules, but some workflows were not read.',
    );
  return finding(
    id,
    'met',
    'Checked by rules: every workflow sets permissions, pins actions, and disables persisted credentials.',
  );
}

function lineOf(content: string, index: number): number {
  return content.slice(0, index).split('\n').length;
}

function dependencyPinning(snapshot: RepositorySnapshot): Finding {
  const id = 'dependency-pinning';
  const problems: Evidence[] = [];
  const reasons = new Set<string>();
  for (const path of snapshot.paths.filter((entry) => BINARY.test(entry)).slice(0, 5)) {
    problems.push({ file: path });
    reasons.add('binaries are committed to the repository');
  }
  const cmake = file(snapshot, 'CMakeLists.txt');
  if (cmake !== undefined) {
    for (const block of cmake.matchAll(/FetchContent_Declare\s*\(([^)]*)\)/gi)) {
      const body = block[1] ?? '';
      const tag = /GIT_TAG\s+(\S+)/i.exec(body)?.[1] ?? '';
      if (!SHA.test(tag) && !/URL_HASH/i.test(body)) {
        problems.push(at('CMakeLists.txt', lineOf(cmake, block.index)));
        reasons.add('a FetchContent dependency is not pinned to a commit or hash');
      }
    }
    for (const block of cmake.matchAll(/file\s*\(\s*DOWNLOAD([^)]*)\)/gi)) {
      if (!/EXPECTED_HASH/i.test(block[1] ?? '')) {
        problems.push(at('CMakeLists.txt', lineOf(cmake, block.index)));
        reasons.add('a download has no expected hash');
      }
    }
  }
  // Cargo の git の依存は、rev か Cargo.lock のどちらかで固定する。
  const cargo = file(snapshot, 'Cargo.toml');
  if (cargo !== undefined && !snapshot.paths.includes('Cargo.lock')) {
    for (const { line } of matchingLines(cargo, /\bgit\s*=\s*["']/).filter(({ text }) => !/\brev\s*=/.test(text))) {
      problems.push(at('Cargo.toml', line));
      reasons.add('a Cargo git dependency has no rev and Cargo.lock is not committed');
    }
  }
  const vcpkg = file(snapshot, 'vcpkg.json');
  if (
    vcpkg !== undefined &&
    !/"builtin-baseline"/.test(vcpkg) &&
    !snapshot.paths.includes('vcpkg-configuration.json')
  ) {
    problems.push({ file: 'vcpkg.json' });
    reasons.add('vcpkg.json has no builtin-baseline');
  }
  if (reasons.size > 0) return finding(id, 'not_met', `Checked by rules: ${[...reasons].join('; ')}.`, problems);
  if (snapshot.truncated)
    return finding(id, 'unclear', 'Checked by rules: the repository file list was too large to read in full.');
  return finding(id, 'met', 'Checked by rules: no committed binaries and no unpinned downloads were found.');
}

function buildHardening(snapshot: RepositorySnapshot): Finding {
  const id = 'build-hardening';
  const builds = buildFiles(snapshot).filter((build) => build.path !== 'Cargo.toml');
  if (builds.length === 0) {
    if (file(snapshot, 'Cargo.toml') !== undefined)
      return finding(
        id,
        'not_applicable',
        'Checked by rules: the build is a Rust (Cargo) build without CMake or Meson.',
      );
    return finding(
      id,
      'unclear',
      'Checked by rules: no CMakeLists.txt or meson.build was read at the repository root.',
    );
  }
  const sanitizer = builds.flatMap((build) =>
    matchingLines(build.content, /[-/]fsanitize|b_sanitize/i).map(({ line }) => at(build.path, line)),
  );
  const stack = builds.flatMap((build) =>
    matchingLines(build.content, /-fstack-protector|\/GS\b/).map(({ line }) => at(build.path, line)),
  );
  if (sanitizer.length > 0 && stack.length > 0)
    return finding(id, 'met', 'Checked by rules: the build sets sanitizer and stack protection options.', [
      ...sanitizer,
      ...stack,
    ]);
  return finding(
    id,
    'not_met',
    `Checked by rules: the build files that were read do not set ${[
      sanitizer.length === 0 ? 'a sanitizer option (-fsanitize or b_sanitize)' : '',
      stack.length === 0
        ? 'stack protection (-fstack-protector or /GS; MSVC enables /GS by default, but the criterion asks for the setting to be explicit)'
        : '',
    ]
      .filter(Boolean)
      .join(' or ')}.`,
  );
}

function cpuCompatibility(snapshot: RepositorySnapshot): Finding {
  const id = 'cpu-compatibility';
  const sources = [...buildFiles(snapshot), ...workflows(snapshot)];
  if (buildFiles(snapshot).length === 0)
    return finding(
      id,
      'unclear',
      'Checked by rules: no CMakeLists.txt, meson.build, or Cargo.toml was read at the repository root.',
    );
  const forced = sources.flatMap((source) =>
    matchingLines(source.content, /\/arch:AVX(2|512)|-mavx(2|512)|-march=native|target-cpu=native/i).map(({ line }) =>
      at(source.path, line),
    ),
  );
  if (forced.length > 0)
    return finding(id, 'not_met', 'Checked by rules: the build forces an instruction set such as AVX2.', forced);
  return finding(
    id,
    'met',
    'Checked by rules: the build does not force AVX2, AVX-512, -march=native, or target-cpu=native.',
  );
}

function userVerificationGuide(snapshot: RepositorySnapshot): Finding {
  const id = 'user-verification-guide';
  const doc = readme(snapshot);
  const hits = doc
    ? matchingLines(doc.content, /gh attestation verify|sha-?256|checksum|get-filehash|ハッシュ/i).map(({ line }) =>
        at(doc.path, line),
      )
    : [];
  if (hits.length > 0) return finding(id, 'met', 'Checked by rules: the README shows how to verify a download.', hits);
  return finding(
    id,
    'not_met',
    'Checked by rules: the README does not mention gh attestation verify, a SHA-256 hash, or a checksum.',
  );
}

// 規格ごとの標準の導入先。%COMMONPROGRAMFILES% の書き方も同じ場所を指す。
const INSTALL_FOLDER =
  /common ?files%?[\\/]+(vst3|clap|lv2)|commonprogramfiles%?[\\/]+(vst3|clap|lv2)|library[\\/]+audio[\\/]+plug-ins|(~|\$home)[\\/]+\.(vst3|clap|lv2)\b/i;

function installLocation(snapshot: RepositorySnapshot): Finding {
  const id = 'install-location';
  const doc = readme(snapshot);
  const hits = doc ? matchingLines(doc.content, INSTALL_FOLDER).map(({ line }) => at(doc.path, line)) : [];
  if (hits.length > 0)
    return finding(id, 'met', 'Checked by rules: the README shows a standard install folder of a plugin format.', hits);
  return finding(
    id,
    'not_met',
    'Checked by rules: the README does not mention a standard install folder such as Common Files\\VST3, Common Files\\CLAP, or ~/Library/Audio/Plug-Ins.',
  );
}

function contributionCompliance(snapshot: RepositorySnapshot): Finding {
  const id = 'contribution-compliance';
  const docs = snapshot.files.filter((entry) => /(^|\/)CONTRIBUTING\.md$|pull_request_template\.md$/i.test(entry.path));
  const hits = docs.flatMap((doc) =>
    matchingLines(doc.content, /\bDCO\b|Developer Certificate of Origin|Signed-off-by|sign-?off/i).map(({ line }) =>
      at(doc.path, line),
    ),
  );
  if (hits.length > 0) return finding(id, 'met', 'Checked by rules: contributors are asked for a DCO sign-off.', hits);
  if (docs.length === 0 && snapshot.truncated)
    return finding(id, 'unclear', 'Checked by rules: the repository file list was too large to read in full.');
  return finding(
    id,
    'not_met',
    docs.length === 0
      ? 'Checked by rules: the repository has no CONTRIBUTING.md or pull request template.'
      : 'Checked by rules: CONTRIBUTING.md and the pull request template do not ask for a DCO sign-off.',
    docs.map((doc) => ({ file: doc.path })),
  );
}

function hermeticBuild(snapshot: RepositorySnapshot): Finding {
  const id = 'hermetic-build';
  const flows = workflows(snapshot);
  if (snapshot.truncated)
    return finding(id, 'unclear', 'Checked by rules: the repository file list was too large to read in full.');
  if (flows.length === 0 && !unreadWorkflows(snapshot))
    return finding(id, 'not_applicable', 'The repository has no GitHub Actions workflows.');
  const latest = flows.flatMap((flow) =>
    matchingLines(flow.content, /\b(ubuntu|windows|macos)-latest\b/).map(({ line }) => at(flow.path, line)),
  );
  if (latest.length > 0)
    return finding(
      id,
      'not_met',
      'Checked by rules: a workflow uses a runner image whose version is not fixed (-latest).',
      latest,
    );
  if (unreadWorkflows(snapshot))
    return finding(
      id,
      'unclear',
      'The workflows that were read fix runner versions, but some workflows were not read.',
    );
  return finding(id, 'met', 'Checked by rules: every workflow uses runner images with fixed versions.');
}

const RULE_TYPES = (rules: RulesetSnapshot['items'][number]['rules']) => new Set(rules.map((rule) => rule.type));

function repositoryProtection(snapshot: RepositorySnapshot): Finding {
  const id = 'repository-protection';
  const rulesets = snapshot.rulesets;
  if (!rulesets?.readable)
    return finding(id, 'unclear', 'Checked by rules: the repository rulesets could not be read.');
  // 既定のブランチの名前は入力に無いため、名前を直接指定した ruleset は数えない。
  const branch = rulesets.items.some((item) => {
    if (item.target !== 'branch') return false;
    if (!item.include.some((name) => name === '~DEFAULT_BRANCH' || name === '~ALL')) return false;
    const types = RULE_TYPES(item.rules);
    const review = item.rules.find((rule) => rule.type === 'pull_request')?.parameters.required_approving_review_count;
    return types.has('deletion') && types.has('non_fast_forward') && typeof review === 'number' && review >= 1;
  });
  const tag = rulesets.items.some((item) => {
    if (item.target !== 'tag' || item.include.length === 0) return false;
    const types = RULE_TYPES(item.rules);
    return types.has('creation') && types.has('update') && types.has('deletion');
  });
  const note = 'Bypass lists are not visible to the catalog and are not checked.';
  if (branch && tag)
    return finding(
      id,
      'met',
      `Checked by rules: a branch ruleset protects the default branch and requires a reviewed pull request, and a tag ruleset restricts creating, updating, and deleting tags. ${note}`,
    );
  if (rulesets.truncated)
    return finding(id, 'unclear', 'Checked by rules: the repository has more active rulesets than the catalog reads.');
  const missing = [
    branch
      ? ''
      : 'a branch ruleset for the default branch that blocks deletion and force pushes and requires a pull request with at least one approval',
    tag ? '' : 'a tag ruleset that restricts creating, updating, and deleting tags',
  ].filter(Boolean);
  return finding(id, 'not_met', `Checked by rules: the repository does not have ${missing.join(' or ')}. ${note}`);
}

// README の案内の型。否定の文脈 (「〜しないでください」) も当たるが、重大の指摘は管理者が根拠の行を見て判断する。
const SECURITY_BYPASS: RegExp[] = [
  // xattr -d com.apple.quarantine、xattr -rd、xattr -c、xattr -cr による隔離属性の除去。-l や -p の表示は当たらない。
  /\bxattr\s+(?:-[a-z]+\s+)*-[a-z]*[cd][a-z]*\b/i,
  /\bspctl\s+--(?:master|global)-disable\b/i,
  /open anyway|このまま開く/i,
  /\b(?:Add|Set)-MpPreference\b[^\n]*-(?:Exclusion|Disable)/i,
];
const WINDOWS_PROTECTION = /smartscreen|defender|smart app control/i;
const TURN_OFF = /disabl|turn(?:ing)? off|switch(?:ing)? off|deactivat|exclu|whitelist|allowlist|無効|オフ|除外/i;

const TERMINAL_PASTE: RegExp[] = [
  // 取得した内容をシェルや osascript へパイプで渡す。
  /\b(?:curl|wget)\b[^\n]*\|\s*(?:sudo\s+)?(?:(?:ba|z|da|k)?sh|osascript|python3?|perl|ruby)\b/i,
  // シェルにコマンド置換やプロセス置換で渡す。
  /\b(?:ba|z)?sh\s+(?:-c\s+["']?\$\(|<\()\s*(?:curl|wget)\b/i,
  // PowerShell の irm | iex と、iex (New-Object Net.WebClient).DownloadString(...)。
  /\b(?:irm|iwr|invoke-restmethod|invoke-webrequest)\b[^\n]*\|\s*(?:iex|invoke-expression)\b/i,
  /\b(?:iex|invoke-expression)\b[^\n]*(?:\birm\b|\biwr\b|invoke-restmethod|invoke-webrequest|downloadstring|net\.webclient)/i,
  // base64 で埋め込んだ文字列を復号して実行する。
  /\bbase64\s+(?:-d|-D|--decode)\b[^\n]*\|\s*(?:sudo\s+)?(?:(?:ba|z)?sh|osascript)\b/i,
  /\bpowershell(?:\.exe)?\b[^\n]*\s-(?:e|ec|enc|encodedcommand)\s+[A-Za-z0-9+/=]{16,}/i,
  /frombase64string[^\n]*(?:iex|invoke-expression)|(?:iex|invoke-expression)[^\n]*frombase64string/i,
  /\bosascript\b[^\n]*(?:curl|wget|https?:\/\/)/i,
];

// README の行に案内の型を当てる。当たれば重大の not_met とし、当たった行を根拠に返す。
function readmePattern(
  snapshot: RepositorySnapshot,
  id: string,
  matches: (text: string) => boolean,
  found: string,
  none: string,
): Finding {
  const doc = readme(snapshot);
  if (!doc) {
    // 読めなかった README を、無い README と同じに扱わない。大きな README で照合を逃れられないようにするため。
    if (snapshot.unreadFiles.includes('README.md')) {
      return {
        ...finding(
          id,
          'not_met',
          'Checked by rules: README.md is larger than 128 KB or could not be read, so the rules could not check it.',
        ),
        serious: true,
      };
    }
    if (snapshot.truncated)
      return finding(id, 'unclear', 'Checked by rules: the repository file list was too large to read in full.');
    return finding(id, 'met', 'Checked by rules: the repository has no README.md.');
  }
  const hits = doc.content
    .split('\n')
    .map((text, index) => ({ text, line: index + 1 }))
    .filter(({ text }) => matches(text))
    .map(({ line }) => at(doc.path, line));
  if (hits.length === 0) return finding(id, 'met', `Checked by rules: ${none}`);
  return { ...finding(id, 'not_met', `Checked by rules: ${found}`, hits), serious: true };
}

function noSecurityBypass(snapshot: RepositorySnapshot): Finding {
  return readmePattern(
    snapshot,
    'no-security-bypass',
    (text) =>
      SECURITY_BYPASS.some((pattern) => pattern.test(text)) || (WINDOWS_PROTECTION.test(text) && TURN_OFF.test(text)),
    'the README contains an instruction that removes the quarantine attribute, disables Gatekeeper, uses Open Anyway, or turns off or excludes SmartScreen, Microsoft Defender, or Smart App Control.',
    'the README contains no instruction that turns off a security feature.',
  );
}

function noTerminalPaste(snapshot: RepositorySnapshot): Finding {
  return readmePattern(
    snapshot,
    'no-terminal-paste',
    (text) => TERMINAL_PASTE.some((pattern) => pattern.test(text)),
    'the README contains a command that downloads content and runs it at once.',
    'the README contains no command that downloads content and runs it at once.',
  );
}

// 単語としての VST。VST3 のように数字が続く形も当たる。invest のような語の一部は当たらない。
const VST_WORD = /(?:^|[^a-z])vst(?:[^a-z]|$)/i;

function pluginName(names: string[]): Finding {
  const id = 'plugin-name';
  const hits = names.filter((name) => VST_WORD.test(name));
  if (hits.length > 0)
    return finding(
      id,
      'not_met',
      `Checked by rules: the name includes the word VST: ${hits.join(', ').slice(0, 200)}.`,
    );
  return finding(id, 'met', 'Checked by rules: the plugin and repository names do not include the word VST.');
}

// names は、リポジトリ名と、分かっていれば表示名。
export function judgeByRules(snapshot: RepositorySnapshot, names: string[] = []): Finding[] {
  return [
    noSecurityBypass(snapshot),
    noTerminalPaste(snapshot),
    ciHardening(snapshot),
    dependencyPinning(snapshot),
    buildHardening(snapshot),
    cpuCompatibility(snapshot),
    userVerificationGuide(snapshot),
    installLocation(snapshot),
    contributionCompliance(snapshot),
    hermeticBuild(snapshot),
    repositoryProtection(snapshot),
    ...(names.length > 0 ? [pluginName(names)] : []),
  ];
}

// LLM に渡すファイル。ルールだけが読むビルドの設定、vcpkg.json、.gitmodules、CONTRIBUTING は渡さない。
// README は規則が全文を照合するために大きな上限で読むため、LLM には先頭の MAX_LLM_README_CHARS 文字だけを渡す。
export function llmFiles(files: RepositorySnapshot['files']): RepositorySnapshot['files'] {
  return files
    .filter((entry) => entry.path === 'README.md' || WORKFLOW.test(entry.path))
    .map((entry) =>
      entry.path === 'README.md' && entry.content.length > MAX_LLM_README_CHARS
        ? {
            path: entry.path,
            content: `${entry.content.slice(0, MAX_LLM_README_CHARS)}\n[The rest of README.md is not provided because of the size limits.]`,
          }
        : entry,
    );
}

export const MAX_LLM_README_CHARS = 32 * 1024;

// リポジトリから取った文字列を、事実の 1 行に収まる短い文字列にする。
export function clean(text: string): string {
  return text
    .replace(/[\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

const NETWORK_WORDS = /\bAPI\b|api key|upload|send|transmit|telemetry|analytics|activat|license server|送信|外部/i;
const VALIDATORS = /\bpluginval\b|\bvalidator\b|clap-validator|\blv2lint\b|\bauval\b|\bauvaltool\b/i;

// 本サービスがファイルの一覧と中身から計算した事実。LLM が自分で探す手間と思い込みを減らすため。
// extra は、差分が上限を超えたときの変更されたファイルの一覧の事実など、呼び出し側が計算した事実の行。
export function computeFacts(snapshot: RepositorySnapshot, ruled: Finding[], extra: string[] = []): string {
  const lines: string[] = [];
  lines.push(`File list complete: ${snapshot.truncated ? 'no (too large)' : 'yes'}`);
  const scripts = snapshot.paths.filter((path) => /^\.github\/scripts\//.test(path)).slice(0, 30);
  lines.push(`Scripts under .github/scripts: ${scripts.length > 0 ? scripts.map(clean).join(', ') : 'none'}`);
  const tools = workflows(snapshot).flatMap((flow) =>
    matchingLines(flow.content, VALIDATORS).map(({ line, text }) => `${clean(flow.path)}:${line}: ${clean(text)}`),
  );
  lines.push(`Workflow lines that mention plugin validation tools: ${tools.slice(0, 20).join(' | ') || 'none'}`);
  const doc = readme(snapshot);
  if (doc) {
    const headings = matchingLines(doc.content, /^#{1,4}\s/).slice(0, 40);
    lines.push(`README headings: ${headings.map(({ line, text }) => `${line}: ${clean(text)}`).join(' | ') || 'none'}`);
    const hosts = new Map<string, number[]>();
    for (const { line, text } of matchingLines(doc.content, /https?:\/\//)) {
      for (const match of text.matchAll(/https?:\/\/([A-Za-z0-9.-]+)/g)) {
        const host = (match[1] ?? '').toLowerCase();
        hosts.set(host, [...(hosts.get(host) ?? []), line]);
      }
    }
    lines.push(
      `README URL hosts (line numbers): ${
        [...hosts.entries()]
          .slice(0, 30)
          .map(([host, at]) => `${clean(host)} (${at.slice(0, 5).join(', ')})`)
          .join(', ') || 'none'
      }`,
    );
    const network = matchingLines(doc.content, NETWORK_WORDS).map(({ line }) => line);
    lines.push(`README lines that mention APIs or sending data: ${network.slice(0, 30).join(', ') || 'none'}`);
  } else {
    lines.push('README: not present');
  }
  lines.push(networkFact(snapshot.network));
  lines.push(`Results of the rule-based items: ${ruled.map((entry) => `${entry.id}=${entry.result}`).join(', ')}`);
  lines.push(...extra);
  return lines.join('\n');
}

// 通信の API の検出の結果の事実。行の文字列はリポジトリのコードから取ったデータで、1 行に収める。
function networkFact(network: NetworkScan | null | undefined): string {
  const label = 'Network API use found in the source by the catalog';
  if (!network) return `${label}: not scanned`;
  if (network.hits.length === 0) return `${label}: none found`;
  const hits = network.hits.map((hit) => `${clean(hit.file)}:${hit.line} (${hit.api}): ${clean(hit.text)}`);
  return `${label}${network.truncated ? ' (first 50 only)' : ''}: ${hits.join(' | ')}`;
}

// 根拠として認める、検出で当たったソースのファイル。
export function networkFiles(snapshot: RepositorySnapshot): string[] {
  return [...new Set((snapshot.network?.hits ?? []).map((hit) => hit.file))];
}

// 同じ項目がルールと LLM の両方にあれば、ルールの結果を使う。
export function mergeFindings(ruled: Finding[], llm: Finding[]): Finding[] {
  const ids = new Set(ruled.map((entry) => entry.id));
  return [...ruled, ...llm.filter((entry) => !ids.has(entry.id))];
}
