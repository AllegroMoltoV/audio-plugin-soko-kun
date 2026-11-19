-- カテゴリを版ごとに保存する (jtl.42)。表の定義と意味は docs/design/data-model.md に記載している。
-- 掲載中の版の行の値を表示し、掲載されていない新しい版の宣言で、掲載中の版のカテゴリが変わらないようにする。
-- 表示名と宣言の配布物は、版ごとに保存している config_json から読むため、列は足さない。
ALTER TABLE release_checks ADD COLUMN category TEXT;

-- 判定を終えた既存の行には plugins の今のカテゴリを写し、今の表示を変えない。
-- pending の行には写さない。このマイグレーションと deploy の間に旧いコードが判定した行に、古い値が残らないようにするため。
-- 新しいコードが pending の行を判定するときに、推定したカテゴリを書く。
UPDATE release_checks SET
  category = (SELECT p.category FROM plugins p JOIN releases r ON r.plugin_id = p.id WHERE r.github_release_id = release_checks.github_release_id)
WHERE config_state != 'pending';
