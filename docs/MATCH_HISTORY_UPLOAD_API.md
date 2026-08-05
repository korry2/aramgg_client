# 海克斯大乱斗战绩上传接口定义

## 文件

- OpenAPI 3.1：[`api/match-history-upload.openapi.yaml`](./api/match-history-upload.openapi.yaml)
- 真实采集脱敏请求：[`samples/match-history-upload.real-sanitized.json`](./samples/match-history-upload.real-sanitized.json)

样本从本机真实 `GZ100` SGP SUMMARY 记录中选取最近 3 场生成，保留真实的对局 ID、时间、英雄、海克斯、装备、KDA、队伍和胜负数据。样本移除了 PUUID、Riot ID、召唤师名称和本地玩家表；不包含 LCU 密码、LCU Authorization、entitlements Token 或 SGP 响应正文。

## 目标

服务端接收客户端已经完成采集和规范化的 `KIWI / queue 2400 / map 12` 对局。服务端按 `platformId + gameId` upsert，因此不同客户端重复遇到同一场对局不会重复计数。

该接口只接收完成的比赛样本，不下发 PUUID 任务，也不允许通过上传结果自动扩展下一层玩家。

## 接口

### 1. 创建短期上传会话

```http
POST /api/client/v1/match-history/upload-session
Content-Type: application/json
```

```json
{
  "schemaVersion": 1,
  "clientVersion": "0.2.8",
  "platformId": "GZ100"
}
```

成功后返回短期 Bearer Token、过期时间、批量上限和请求体上限。官方开源客户端不得内置长期 API Key；该会话仍需配合 IP、区服、客户端版本和行为速率限制。

### 2. 上传比赛批次

```http
POST /api/client/v1/match-history/batches
Authorization: Bearer <short-lived-upload-session>
Content-Type: application/json
Content-Encoding: gzip
```

- 每批最多 20 场。
- `sourceKey` 固定为 `match-history:v1:{platformId}:{gameId}`。
- `idempotencyKey` 是客户端 outbox 当前版本的幂等标识。
- `payloadHash` 是客户端生成的不透明版本摘要；因为网络载荷主动移除了玩家身份字段，服务端不应根据请求 JSON 重新计算它。
- `sourceKey`、`game.platformId`、`game.gameId` 必须互相匹配。
- 服务端只接受 `gameMode=KIWI`、`queueId=2400`、`mapId=12`。

## 服务端幂等与数据库约束

至少需要以下唯一约束：

```sql
UNIQUE (platform_id, game_id)
UNIQUE (idempotency_key)
```

建议事务顺序：

1. 校验上传会话、请求大小和批量数量。
2. 逐项校验 `sourceKey` 与比赛身份。
3. 已存在相同 `idempotencyKey`：返回 `duplicate`。
4. 不存在 `platformId + gameId`：插入比赛和参与者，返回 `inserted`。
5. 已存在比赛但 `payloadHash` 不同：在完整性校验通过后更新，返回 `updated`。
6. 单项无效：返回 `rejected`，并明确 `retryable`；不要让一条坏数据回滚其他有效项。

只有收到同一 `sourceKey + idempotencyKey` 的 `inserted`、`duplicate` 或 `updated` acknowledgement 后，客户端才能把对应 outbox 项标记为 `uploaded`。

## 重试语义

| 情况 | 客户端行为 |
| --- | --- |
| `200` + `inserted/duplicate/updated` | 确认并删除/归档对应 outbox 项 |
| `200` + `rejected, retryable=false` | 停止自动重试，保留诊断状态 |
| `200` + `rejected, retryable=true` | 指数退避后重试该项 |
| `401` | 丢弃短期会话并重新申请一次 |
| `413` | 缩小批量；单项仍超限则停止重试 |
| `429` | 遵循 `Retry-After` |
| 网络错误或 `5xx` | 有上限的指数退避，不改变幂等键 |

服务端返回的 `message` 不得回显完整请求体或任何 Authorization header。

## 数据最小化

上传载荷明确不包含：

- PUUID、Riot ID、召唤师名称和 tag line
- 本地当前玩家标识
- LCU Basic Authorization、端口和安装目录
- entitlements accessToken
- SGP URL 中的玩家标识或原始响应正文
- 本地 `players` 表

中心统计所需的数据只有比赛身份、英雄、海克斯、终局装备、KDA 和胜负。若未来要实现服务端 PUUID 任务分发，应使用独立接口、独立授权和独立隐私评审，不能扩展本接口的字段。

## 上线开关

在服务端完成验签、限流、唯一约束和 acknowledgement 测试之前，客户端上传开关必须保持关闭。建议以后从同源 `/api/client/v1/config` 下发：

```json
{
  "matchHistoryUpload": {
    "enabled": false,
    "sessionPath": "/api/client/v1/match-history/upload-session",
    "batchPath": "/api/client/v1/match-history/batches",
    "maxBatchSize": 20
  }
}
```

远端配置只能启用内置受信任 HTTPS origin，不能注入任意上传域名。
