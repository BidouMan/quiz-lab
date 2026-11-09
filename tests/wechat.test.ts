import test from 'node:test'
import assert from 'node:assert/strict'
import {
  parseWechatArticleUrl,
  safeBizDirName,
  splitWechatLinkLines,
  wechatResolveErrorText,
} from '../src/app/wechat.ts'
import { findWechatSource, WECHAT_SOURCES } from '../src/app/wechatSources.ts'

test('公众号链接：从 __biz 识别账号，并解出编码的 =', () => {
  const result = parseWechatArticleUrl(
    'https://mp.weixin.qq.com/s?__biz=MzUxNTU0NjQ2Mg%3D%3D&mid=2650000000&idx=1&sn=abc&chksm=def#rd',
  )
  assert.equal(result.ok, true)
  if (!result.ok || result.kind !== 'biz') return assert.fail('应识别为带 __biz 的链接')
  assert.equal(result.ref.biz, 'MzUxNTU0NjQ2Mg==')
  assert.equal(result.ref.mid, '2650000000')
  assert.equal(result.ref.idx, '1')
})

test('公众号链接：接受省略协议头的粘贴内容', () => {
  const result = parseWechatArticleUrl('mp.weixin.qq.com/s?__biz=MzI1MTIzNDU2Nw%3D%3D&mid=1&idx=2')
  assert.equal(result.ok, true)
  if (!result.ok || result.kind !== 'biz') return assert.fail('应识别为带 __biz 的链接')
  assert.equal(result.ref.biz, 'MzI1MTIzNDU2Nw==')
})

test('公众号链接：非 Mz 形式的 __biz（如 170001）直接拒绝', () => {
  for (const value of ['170001', 'MzU5', 'not-base64']) {
    const result = parseWechatArticleUrl(`https://mp.weixin.qq.com/s?__biz=${value}&mid=1&idx=1`)
    assert.equal(result.ok, false, `${value} 不该被当成账号标识`)
    if (!result.ok) assert.match(result.reason, /账号标识/)
  }
})

test('公众号链接：短链接与分享链标记为需要解析，保留原链接', () => {
  const short = parseWechatArticleUrl('https://mp.weixin.qq.com/s/AbCdEfGh')
  assert.equal(short.ok, true)
  if (!short.ok) return
  assert.equal(short.kind, 'resolve')
  if (short.kind === 'resolve') assert.match(short.url, /mp\.weixin\.qq\.com\/s\/AbCdEfGh/)

  const share = parseWechatArticleUrl(
    'https://mp.weixin.qq.com/s?src=11&timestamp=1794045902&ver=7074&signature=abc*def&new=1',
  )
  assert.equal(share.ok, true)
  if (!share.ok) return
  assert.equal(share.kind, 'resolve')
  if (share.kind === 'resolve') {
    assert.match(share.url, /signature=/)
    assert.ok(!share.url.includes('__biz'), '分享链本身不该带 __biz')
  }

  const other = parseWechatArticleUrl('https://example.com/s?__biz=MzUxNTU0NjQ2Mg==')
  assert.equal(other.ok, false)
  if (!other.ok) assert.match(other.reason, /mp\.weixin\.qq\.com/)

  const garbage = parseWechatArticleUrl('not a url')
  assert.equal(garbage.ok, false)

  const empty = parseWechatArticleUrl('   ')
  assert.equal(empty.ok, false)
  if (!empty.ok) assert.match(empty.reason, /粘贴/)
})

test('导出目录名：去掉路径分隔符等不安全字符', () => {
  assert.equal(safeBizDirName('MzA5/ND=='), 'MzA5_ND==')
  assert.equal(safeBizDirName('a\\b:c'), 'a_b_c')
  assert.equal(safeBizDirName('  '), 'unknown-biz')
})

test('公众号下拉数据：字段齐全、id 唯一、链接都能走解析流程', () => {
  assert.ok(WECHAT_SOURCES.length >= 5, '至少要有清单里的推荐号')
  assert.equal(new Set(WECHAT_SOURCES.map((item) => item.id)).size, WECHAT_SOURCES.length)

  for (const source of WECHAT_SOURCES) {
    assert.match(source.accountName, /\S/)
    assert.match(source.title, /\S/)
    assert.match(source.verifiedAt, /^\d{4}-\d{2}-\d{2}$/)
    const parsed = parseWechatArticleUrl(source.url)
    assert.equal(parsed.ok, true)
    if (parsed.ok) assert.equal(parsed.kind, 'resolve')
    assert.equal(findWechatSource(source.id)?.url, source.url)
  }
})

test('批量链接输入：一行一条，去空行/注释/重复，保留原顺序', () => {
  const text = [
    'https://mp.weixin.qq.com/s/abc',
    '',
    '  # 注释行  ',
    'mp.weixin.qq.com/s?__biz=MzUxNTU0NjQ2Mg==',
    'https://mp.weixin.qq.com/s/abc',
  ].join('\n')
  assert.deepEqual(splitWechatLinkLines(text), [
    'https://mp.weixin.qq.com/s/abc',
    'mp.weixin.qq.com/s?__biz=MzUxNTU0NjQ2Mg==',
  ])
  assert.deepEqual(splitWechatLinkLines('   \n\n'), [])
})

test('过期链接：单独提示，不显示为解析失败', () => {
  assert.equal(
    wechatResolveErrorText('该链接已过期，请在微信里重新分享获取新链接'),
    '该条链接已过期，请换一条或粘贴新链接',
  )
  assert.equal(
    wechatResolveErrorText('链接参数无效，可能已过期，请重新复制分享链接'),
    '该条链接已过期，请换一条或粘贴新链接',
  )
  assert.equal(
    wechatResolveErrorText('页面返回为空，链接可能已失效'),
    '解析失败：页面返回为空，链接可能已失效',
  )
})
