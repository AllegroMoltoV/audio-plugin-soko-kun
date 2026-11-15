// Workers AI の呼び出しを AI Gateway に通すための第 3 引数。ID が無い環境 (手元とテスト) ではゲートウェイを通さない。
// 本番はゲートウェイの支出の上限で、派生元の配信プラグイン倉庫くんと合わせた Workers AI の費用を止める (docs/design/architecture.md)。
// metadata の service は、派生元の配信プラグイン倉庫くんと共有するゲートウェイのログで、どちらのサービスの消費かを区別するため。

// このサービスの名前。派生元の配信プラグイン倉庫くんでは別の値にする (共通の土台で違ってよいサービス名の文字列)。
export const GATEWAY_SERVICE = 'audio-plugin-soko-kun';

export function gatewayOptions(
  gatewayId: string | undefined,
  service: string,
): { gateway: { id: string; metadata: { service: string } } } | undefined {
  return gatewayId ? { gateway: { id: gatewayId, metadata: { service } } } : undefined;
}
