/**
 * 已验证可用的公众号文章（下拉选择用）。
 * 数据来源：docs/公众号候选清单-2026-11-07.md。
 * 以后增减公众号只改这个文件，不要在模板里硬编码。
 */

export interface WechatSource {
  id: string
  /** 公众号账号名 */
  accountName: string
  /** 用于校验链接是否可用的那篇文章标题 */
  title: string
  /** 分享链；签名会过期，过期时面板会提示换一条 */
  url: string
  /** 实际打开验证的日期 */
  verifiedAt: string
}

export const WECHAT_SOURCES: readonly WechatSource[] = [
  {
    id: 'sannianji-yuwen-shuxue',
    accountName: '三年级语文数学',
    title: '三年级语文上册阅读题含答案，新学期孩子练习！',
    url: 'https://mp.weixin.qq.com/s?src=11&timestamp=1794047171&ver=7074&signature=vAr1ngs*77DqZ-NKNpYgKJZ5kNV-igbDkkGEQ8MFhbl*gXUdZAxIKqpstKJ34aOVHdN7jkyzWHrkPVZ2s7m8zG*c8s-5MRoxLRGDeUmey9ib*n*a9p*D8-DF6fqotJN8&new=1',
    verifiedAt: '2026-11-07',
  },
  {
    id: 'xiaoxue-sannianji-jiazhang',
    accountName: '小学三年级家长',
    title: '三年级语文上册课内阅读专项练习附答案，收藏备用！',
    url: 'https://mp.weixin.qq.com/s?src=11&timestamp=1794047188&ver=7074&signature=JFs-6CWLx1-wbv8OHtKIF6yYvEk3PLPCWoOFEdxrNCgaanja4OXdce8RBrUdtciWCJtoRWQWbhkBq44zxPrPxryy0aNrHkx9XxxjPi2lbM2ooaJsbUcj1K7wGWXP10wt&new=1',
    verifiedAt: '2026-11-07',
  },
  {
    id: 'diyuan-xiaoxue-yingyu-ke',
    accountName: '帝源小学英语课',
    title: '部编版三年级语文上册课内+课外阅读理解练习及答案，给孩子下载练习！',
    url: 'https://mp.weixin.qq.com/s?src=11&timestamp=1794046788&ver=7074&signature=AVRs5miB2Fd9HeGzTu-jqu6eMpylqbwsy9gLlMWwb2dPa42kExiWGl6qdAL6KgijenCaU0Bq3w0lFvhSVBnZjrKJQJ0JCQ3B4F03przGNKEKGpiSaYuR9DiK4vXJShgK&new=1',
    verifiedAt: '2026-11-07',
  },
  {
    id: 'yinmiao-jy',
    accountName: '茵苗JY',
    title: '期中复习：三年级上册语文课内阅读理解，附答案',
    url: 'https://mp.weixin.qq.com/s?src=11&timestamp=1794046810&ver=7074&signature=M8pN87sQEs57h0asWjqRISwXBNlflzDa2GZtdKLrIwl17lann46RhYJz36H0teGXhwwL6LFDBGIEvYpK22*clGmcnDQ*O0feCU8eaWj522EvrvKHJnYzGMdEt7CRtHc0&new=1',
    verifiedAt: '2026-11-07',
  },
  {
    id: 'bianbian-xiaoxue-yuwen-shijuan',
    accountName: '部编小学语文试卷',
    title: '三年级上册语文阅读理解13篇',
    url: 'https://mp.weixin.qq.com/s?src=11&timestamp=1794046780&ver=7074&signature=F7avzCjywcD5u1xHd1HknPti2a6ZrJP*CR8ZR3CMiAi*dWS0ubNR04SCxjsvKCx5IEQQTv9ch-eQS5lFTbD1uzFsulOB3I897U-RMnmfvhBKCVUUgqURoj3gA6kMekoq&new=1',
    verifiedAt: '2026-11-07',
  },
  {
    id: 'xiaoxue-yushuwai',
    accountName: '小学语数外',
    title: '部编版三年级语文上册课内阅读专项练习及答案',
    url: 'https://mp.weixin.qq.com/s?src=11&timestamp=1794046801&ver=7074&signature=Accq9oXaEuOBtNHuyuTthbMGxPuscUAYNBlp6aSUhsGO*S5bDM0RFzHEuNFCBAwZTRY4i228aV6YIe*MjUgeIK0o5Iu-U*PI0TQci2inBxoV7FI249z2lqVqy0qvm*96&new=1',
    verifiedAt: '2026-11-07',
  },
  {
    id: 'sannianji-yuwen-shuxue-yingyu',
    accountName: '三年级语文数学英语',
    title: '三年级语文上册课外阅读题11套【电子版】',
    url: 'https://mp.weixin.qq.com/s?src=11&timestamp=1794046788&ver=7074&signature=SGEHpOHCn35qLwPSA*LZzlWQbiBYnbzxUSOqxQeC1RcAapuJyR7phXqikWt0KIWj8EQiaX361rjzLh6pE228mttQjayCwoMQSdVHysIkKhGQmkGf9t4vYHuTCLreqvux&new=1',
    verifiedAt: '2026-11-07',
  },
  {
    id: 'sannianji-zhishi',
    accountName: '三年级知识',
    title: '三年级语文上册期中测试练习题3套带答案，给孩子练习！',
    url: 'https://mp.weixin.qq.com/s?src=11&timestamp=1794047205&ver=7074&signature=yDcYbqM6ADtq5lguiM0rp*rkqLZ1sXuQpDSE8kGxL38dga1hkzvEipEBo1Dy77aUZ6CV7VdpZ7quVfoi8ToNxIQHYoERuvVWpPZhFGV5dYjLeom9*uz774TsZw33wEJ8&new=1',
    verifiedAt: '2026-11-07',
  },
  {
    id: 'bianban-xiaoxue-yuwen-jingjiang',
    accountName: '部编版小学语文精讲',
    title: '收藏：部编三年级语文上册课内阅读理解练习附参考答案',
    url: 'https://mp.weixin.qq.com/s?src=11&timestamp=1794046836&ver=7074&signature=*o1JTLSH4JzgKhzBIHpaJ3nltxLn8o0cahswCh9ImhQPi7wd6eEweZfzVs3GQEMdFE1Yuw6PWv2em8JzZxMHjFRci5MJzFyF*0KHTX5f-JO5ccqSJaoxuRManOtDRKed&new=1',
    verifiedAt: '2026-11-07',
  },
  {
    id: 'xiaoxue-sannianji',
    accountName: '小学三年级',
    title: '3套：三年级语文上册期中测试练习题带答案',
    url: 'https://mp.weixin.qq.com/s?src=11&timestamp=1794047210&ver=7074&signature=6H-noKi0qKyX9CCB4f4hrrsogkgwe8GCJ5SH7s*l9f3KGJTFmNvFmrL6PbPwWgo4LsDYxG0LokCdf51KXDiyKvtxVt1G9HEdghXTaDgHeIsHHdWAqE4a*j8mfLZf3ELI&new=1',
    verifiedAt: '2026-11-07',
  },
  {
    id: 'xiaoxue-yuwen-wang',
    accountName: '小学语文网',
    title: '四十篇三年级上册语文课外阅读练习题及答案',
    url: 'https://mp.weixin.qq.com/s?src=11&timestamp=1794046788&ver=7074&signature=Gv8BfR6-yOXgz53dU2v9qxhCbBORcLULwtLLx9jbA-V*FWLjea*HLHRy-jx01RMGY*nJ8*6E8vBMR86qjAV6R9MKcA*oayHGdasVXWHoV-zYzEbwuVmM*OtLKOIrBHq*&new=1',
    verifiedAt: '2026-11-07',
  },
  {
    id: 'xiaoxue-sannianji-yuwen-xuexi',
    accountName: '小学三年级语文学习',
    title: '人教版三年级语文上册课外阅读理解专项练习含答案（可打印下载）',
    url: 'https://mp.weixin.qq.com/s?src=11&timestamp=1794046793&ver=7074&signature=JB3HGJzs9JvcZz8Qd1F7XLzSyjtODKN1m6k0r-oZdaFg5wedvo3elv7cpeboPtfCkg134SYHXANdPRUEVkPTOiKeytLU0hXlv7UhU8b2pImQi7N8Th0cG3ti6qB7G6fC&new=1',
    verifiedAt: '2026-11-07',
  },
]

export function findWechatSource(id: string): WechatSource | null {
  return WECHAT_SOURCES.find((source) => source.id === id) ?? null
}
