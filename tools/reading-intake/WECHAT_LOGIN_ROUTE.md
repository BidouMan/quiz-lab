# 公众号批量采集：登录态历史列表路线（调研，未实现）

**结论先行**：搜狗索引路线实测被本机 IP 限流（50 条候选只成功 2 条，第 3 条起全部跳
antispider），不适合作为放量主路线。稳定批量需要用户提供自己的公众号后台登录态，
按账号从 `profile_ext` 历史列表往前翻。本文只写清需要用户做什么、技术上怎么调、
风险和替代方案；不实现绕过登录、不伪造凭证。

## 需要用户做什么

1. 在桌面 Chrome 登录 `https://mp.weixin.qq.com/`（用户自己的账号即可，不需要目标
   公众号的管理员权限；目标是读取公开文章）。
2. 打开任意一个目标公众号的历史消息页，或直接访问一次文章列表。
3. 打开 DevTools → Network，筛选 `profile_ext`。
4. 复制该请求的完整 URL。URL 里应包含：
   - `__biz`：目标公众号的唯一 id
   - `uin`：当前登录用户标识
   - `key`：本次会话密钥
   - `pass_ticket`：登录票据（部分接口需要）
   - `appmsg_token`、`x5` 等可选参数
5. 再复制该请求的 Cookie（至少 `slave_sid`、`slave_user`、`bizuin` 等）。
6. 把 URL 与 Cookie 放到本机文件（例如 `data/reading-catalog/wechat-session.json`），
   不要提交到仓库，也不要贴到聊天里。

## 技术上怎么调

历史列表接口是公开的公众号后台接口，拿到登录态后按偏移翻页：

```
GET https://mp.weixin.qq.com/mp/profile_ext
  ?action=getmsg
  &__biz=<__biz>
  &f=json
  &offset=<offset>
  &count=10
  &uin=<uin>
  &key=<key>
  &pass_ticket=<pass_ticket>
```

- 请求头：正常浏览器 `User-Agent` + `Referer: https://mp.weixin.qq.com/` + 用户 Cookie。
- 响应是 JSON，正文在 `general_msg_list`（需要二次 `JSON.parse`）。
- 每条消息取 `comm_msg_info.datetime`（发布时间）与
  `app_msg_ext_info.content_url`（文章地址）；多图文在 `multi_app_msg_item_list`。
- 翻页：用响应里的 `next_offset` 作为下一次 `offset`，直到 `can_msg_continue=0`。
- 拿到 `content_url` 后，按现有 `wechat_probe.fetch_article` 的方式抓正文：
  `#js_content` 容器、`#activity-name` 标题，走同一套提取/定位/校验/入库。
- 频率：每篇间隔 3–5 秒，每 30 条休息 1–2 分钟；撞验证码或“环境异常”立即停。

## 风险

- `key` / `pass_ticket` 会过期，通常几十分钟到数小时；过期后需要用户重新复制。
- 频繁访问会触发验证码或临时封禁，不能硬闯；出现验证就停并记录。
- 同一账号短时间内大量拉取历史列表，存在账号风控风险；建议用用户自己的小号或
  低频、分批执行。
- Cookie 属于敏感凭证，只存本机、不入库、不进 git。

## 替代方案

1. **开发阶段一次性批量导入**：用户在浏览器里把目标账号历史文章逐页滚完，用
   浏览器插件/控制台导出 `content_url` 列表为一个 txt，执行器按列表低频抓取。
   这仍是“批量”，不需要一篇篇手工发链接。
2. **换出口 IP + 放慢搜狗索引**：先验证是否只是 IP 限流；若换网络后 50 条命中率
   回到三成以上，可继续用索引路线，但需限速和验证即停。
3. **换其他可公开枚举的来源**：人教社样章、地方教研网、公版书库，作为补充。

## 验收标准

- 登录态有效时，单账号一次能连续翻 3 页以上、拿到 30+ 条 `content_url`。
- 文章正文成功率 ≥ 80%，失败能区分 403 / 验证 / 404 / 正文为空。
- 全过程有频率控制与失败即停，不出现账号被风控或 IP 被封的情况。
