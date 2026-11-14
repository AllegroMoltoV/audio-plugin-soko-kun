// 乗っ取りの兆候の境界。危険側 (当たるべき変更を見逃して自動で掲載する) に倒れる経路を確かめる。
import { describe, expect, it } from 'vitest';
import { type ChangedFile, checkDiff, tooLargeHits } from '../../src/review/diff-rules';

const diff = (...lines: string[]) => lines.join('\n');

describe('checkDiff', () => {
  it('ワークフローと、ワークフローが呼ぶ処理の変更に当たる。名前の変更で移した場合も当たる', () => {
    const hits = checkDiff(
      diff(
        'diff --git a/.github/workflows/push.yaml b/.github/workflows/push.yaml',
        'diff --git a/scripts/x.sh b/.github/scripts/x.sh',
        'diff --git a/.github/actions/setup/action.yml b/.github/actions/setup/action.yml',
      ),
      'owner',
      'plugin',
    );
    expect(hits.map((hit) => hit.file)).toEqual([
      '.github/workflows/push.yaml',
      '.github/scripts/x.sh',
      '.github/actions/setup/action.yml',
    ]);
  });

  it('バイナリの追加と変更に当たる', () => {
    const hits = checkDiff(
      diff(
        'diff --git a/ir/hall.wav b/ir/hall.wav',
        'new file mode 100644',
        'Binary files /dev/null and b/ir/hall.wav differ',
        'diff --git a/lib/x.dll b/lib/x.dll',
        'Binary files a/lib/x.dll and b/lib/x.dll differ',
      ),
      'owner',
      'plugin',
    );
    expect(hits).toEqual([
      { rule: 'diff-binary-added', file: 'ir/hall.wav' },
      { rule: 'diff-binary-added', file: 'lib/x.dll' },
    ]);
  });

  it('バイナリのファイルの削除は数えない', () => {
    const hits = checkDiff(
      diff(
        'diff --git a/presets/old.fxp b/presets/old.fxp',
        'deleted file mode 100644',
        'Binary files a/presets/old.fxp and /dev/null differ',
      ),
      'owner',
      'plugin',
    );
    expect(hits).toEqual([]);
  });

  it('別のホストと、同じ名前の別のリポジトリへのリンクの追加に当たる', () => {
    const hits = checkDiff(
      diff(
        'diff --git a/README.md b/README.md',
        '+Download from https://example.com/plugin.zip',
        '+Also https://github.com/attacker/plugin/releases',
      ),
      'owner',
      'plugin',
    );
    expect(hits).toEqual([{ rule: 'diff-external-link', file: 'README.md' }]);
  });

  it('このリポジトリ・本サービス・規格の文書のホストへのリンクと、削除した行には当たらない', () => {
    const hits = checkDiff(
      diff(
        'diff --git a/README.md b/README.md',
        '+See https://github.com/Owner/Plugin/releases',
        '+Listed on https://audio-soko-kun.allegromoltov.jp/plugins/owner/plugin',
        '+VST 3: https://steinbergmedia.github.io/vst3_dev_portal/ CLAP: https://cleveraudio.org/',
        '+LV2: https://lv2plug.in/ns/ AU: https://developer.apple.com/documentation/audiotoolbox',
        '-Old link https://example.com/old',
      ),
      'owner',
      'plugin',
    );
    expect(hits).toEqual([]);
  });

  it('許可していたホストの obsproject.com は、別のホストとして当たる', () => {
    const hits = checkDiff(
      diff('diff --git a/README.md b/README.md', '+https://obsproject.com/download'),
      'owner',
      'plugin',
    );
    expect(hits).toEqual([{ rule: 'diff-external-link', file: 'README.md' }]);
  });
});

const changed = (path: string, status: ChangedFile['status'] = 'modified', binary = false): ChangedFile => ({
  path,
  status,
  binary,
});

describe('tooLargeHits (差分が上限を超えたとき)', () => {
  it('ソースコードだけの変更で、一覧を取り切れたら当たらない', () => {
    expect(
      tooLargeHits(
        [changed('src/PluginProcessor.cpp'), changed('docs/manual.md', 'added'), changed('old.cpp', 'removed')],
        true,
      ),
    ).toEqual([]);
  });

  it('.github/ 配下の変更に当たる。削除と名前の変更の元も当たる', () => {
    expect(tooLargeHits([changed('.github/dependabot.yml')], true)).toEqual([
      { rule: 'diff-too-large', fact: 'github-changed', file: '.github/dependabot.yml' },
    ]);
    expect(tooLargeHits([changed('.github/workflows/build.yaml', 'removed')], true)).toHaveLength(1);
    expect(
      tooLargeHits(
        [{ path: 'ci/build.yaml', previousPath: '.github/workflows/build.yaml', status: 'renamed', binary: false }],
        true,
      ),
    ).toEqual([{ rule: 'diff-too-large', fact: 'github-changed', file: 'ci/build.yaml' }]);
  });

  it('ビルドのスクリプトの変更に当たる', () => {
    for (const path of [
      'CMakeLists.txt',
      'libs/dsp/CMakeLists.txt',
      'Cargo.toml',
      'build.rs',
      'cmake/juce.cmake',
      '.gitmodules',
      'scripts/build.sh',
      'meson.build',
    ]) {
      expect(tooLargeHits([changed(path)], true), path).toEqual([
        { rule: 'diff-too-large', fact: 'build-script-changed', file: path },
      ]);
    }
  });

  it('バイナリの追加と変更に当たり、削除と名前だけの変更には当たらない', () => {
    expect(tooLargeHits([changed('ir/hall.wav', 'added', true)], true)).toEqual([
      { rule: 'diff-too-large', fact: 'binary-added', file: 'ir/hall.wav' },
    ]);
    expect(tooLargeHits([changed('lib/x.dll', 'modified', false)], true)).toEqual([
      { rule: 'diff-too-large', fact: 'binary-added', file: 'lib/x.dll' },
    ]);
    expect(tooLargeHits([changed('lib/old.dll', 'removed', false)], true)).toEqual([]);
    expect(tooLargeHits([changed('presets/a.fxp', 'renamed', false)], true)).toEqual([]);
  });

  it('一覧を取り切れなかった、または取得できなかったら当たる', () => {
    expect(tooLargeHits([changed('src/a.cpp')], false)).toEqual([{ rule: 'diff-too-large', fact: 'list-incomplete' }]);
    expect(tooLargeHits(null, false)).toEqual([{ rule: 'diff-too-large', fact: 'list-incomplete' }]);
  });
});
