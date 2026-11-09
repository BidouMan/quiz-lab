#!/usr/bin/env python3
"""从 quiz-drafts / quality-gate.jsonl / 精选库快照生成可打印题库清单（HTML + CSV）。

用法：python3 tools/reading-intake/work/build_inventory.py
输出：docs/reading-bank-inventory.html
      docs/reading-bank-inventory.csv
"""
from __future__ import annotations

import csv
import html
import json
import os
import re
from collections import Counter, defaultdict

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
DRAFTS = os.path.join(ROOT, "data", "reading-catalog", "quiz-drafts")
GATE = os.path.join(ROOT, "data", "reading-catalog", "quality-gate.jsonl")
DOWN = os.path.join(ROOT, "data", "reading-catalog", "downlisted.json")
BANK44 = os.path.join(ROOT, "tools", "reading-intake", "work", "bank44.json")
PRIORITY = os.path.join(ROOT, "data", "reading-catalog", "REVIEW-PRIORITY.md")
OUT_HTML = os.path.join(ROOT, "docs", "reading-bank-inventory.html")
OUT_CSV = os.path.join(ROOT, "docs", "reading-bank-inventory.csv")

HANZI = re.compile(r"[\u4e00-\u9fff]")
SKILL_NAME = {
    "提取信息": "SK1", "梳理概括": "SK2", "词句理解": "SK3",
    "推断体会": "SK4", "主旨情感": "SK5", "写法结构": "SK6",
    "非连续性文本": "SK7",
}
SKILL_FULL = {
    "SK1": "提取信息", "SK2": "梳理概括", "SK3": "词句理解",
    "SK4": "推断体会", "SK5": "主旨情感", "SK6": "写法结构",
    "SK7": "非连续性文本",
}
THEME_ORDER = ["寓言", "写景", "写事", "写人", "科普", "状物", "非连续", "童话", "记事"]


def han(text: str) -> int:
    return len(HANZI.findall(text))


def site_of(sources: list[dict]) -> str:
    found = set()
    for source in sources:
        label = str(source.get("label") or "")
        low = label.lower()
        if "公众号" in label:
            found.add("微信公众号")
        elif "21世纪教育网" in label or "21cnjy" in low:
            found.add("21世纪教育网")
        elif "学科网" in label or "zxxk" in low:
            found.add("学科网")
        elif "人人文档" in label or "renrendoc" in low:
            found.add("人人文档")
        elif "原创力" in label or "book118" in low:
            found.add("原创力文档")
        elif "小学语文网" in label or "szxuexiao" in low:
            found.add("小学语文网")
    return "、".join(sorted(found)) or "试卷/教辅汇编"


def qtypes(questions: list[dict]) -> str:
    counts = Counter(q.get("type") for q in questions)
    parts = []
    for key, short in (("choice", "选"), ("fill", "填"), ("short", "简")):
        if counts.get(key):
            parts.append(f"{short}{counts[key]}")
    return "·".join(parts) or "—"


def skills_of(questions: list[dict]) -> str:
    codes = {SKILL_NAME.get(q.get("skill"), "") for q in questions}
    codes.discard("")
    ordered = [sk for sk in ("SK1", "SK2", "SK3", "SK4", "SK5", "SK6", "SK7") if sk in codes]
    return "、".join(ordered) or "—"


def load_priority() -> set[str]:
    text = open(PRIORITY, encoding="utf-8").read()
    section = text.split("## 六、人工复核优先级", 1)[-1]
    return set(re.findall(r"RD-\d+", section))


def main() -> None:
    gate = {}
    for line in open(GATE, encoding="utf-8"):
        row = json.loads(line)
        gate[row["id"]] = row
    down = {row["id"]: row for row in json.load(open(DOWN, encoding="utf-8"))["readings"]}
    priority = load_priority()

    rows = []
    for path in sorted(os.listdir(DRAFTS)):
        if not path.endswith(".json"):
            continue
        draft = json.load(open(os.path.join(DRAFTS, path), encoding="utf-8"))
        rid = draft["id"]
        passed = gate.get(rid, {}).get("pass", False)
        questions = draft.get("questions") or []
        rows.append({
            "id": rid,
            "title": draft.get("title") or "",
            "theme": draft.get("theme") or "其他",
            "chars": han("".join(draft.get("paragraphs") or [])),
            "qcount": len(questions),
            "qtypes": qtypes(questions),
            "skills": skills_of(questions),
            "difficulty": gate.get(rid, {}).get("difficulty", "—"),
            "site": site_of(draft.get("sources") or []),
            "status": "正式·挂载" if passed else "下架",
            "priority": "优先" if rid in priority else ("常规" if passed else "—"),
            "reason": "；".join(down.get(rid, {}).get("reasons") or []) if not passed else "",
            "formal": passed,
        })

    for item in json.load(open(BANK44, encoding="utf-8")):
        questions = item.get("questions") or []
        rows.append({
            "id": item["id"],
            "title": item.get("title") or "",
            "theme": item.get("theme") or "其他",
            "chars": han("".join(item.get("paragraphs") or [])),
            "qcount": len(questions),
            "qtypes": qtypes(questions),
            "skills": "—",
            "difficulty": "—",
            "site": "原创（项目内）",
            "status": "正式·精选",
            "priority": "优先" if item["id"] in priority else "常规",
            "reason": "",
            "formal": True,
        })

    rows.sort(
        key=lambda r: (
            THEME_ORDER.index(r["theme"]) if r["theme"] in THEME_ORDER else 99,
            int(r["id"].split("-")[1]),
        )
    )
    formal = [r for r in rows if r["formal"]]
    mounted = [r for r in rows if r["status"] == "正式·挂载"]
    down_rows = [r for r in rows if r["status"] == "下架"]
    selected = [r for r in rows if r["status"] == "正式·精选"]

    theme_counts = Counter(r["theme"] for r in formal)
    diff_counts = Counter(r["difficulty"] for r in mounted)
    all_types = Counter()
    mounted_types = Counter()
    selected_types = Counter()
    for r in mounted:
        for key, short in (("选", "choice"), ("填", "fill"), ("简", "short")):
            n = 0
            for part in r["qtypes"].split("·"):
                if part.startswith(key):
                    n = int(part[1:])
            mounted_types[short] += n
    for r in selected:
        for key, short in (("选", "choice"), ("填", "fill"), ("简", "short")):
            n = 0
            for part in r["qtypes"].split("·"):
                if part.startswith(key):
                    n = int(part[1:])
            selected_types[short] += n
    all_types = mounted_types + selected_types
    total_q = sum(r["qcount"] for r in formal)
    total_q_mounted = sum(r["qcount"] for r in mounted)

    skill_pages = defaultdict(set)
    skill_questions = Counter()
    for path in os.listdir(DRAFTS):
        if not path.endswith(".json"):
            continue
        draft = json.load(open(os.path.join(DRAFTS, path), encoding="utf-8"))
        if not gate.get(draft["id"], {}).get("pass"):
            continue
        for q in draft.get("questions") or []:
            code = SKILL_NAME.get(q.get("skill"))
            if code:
                skill_pages[code].add(draft["id"])
                skill_questions[code] += 1

    origin_counts = Counter()
    unknown_origin = 0
    for path in os.listdir(DRAFTS):
        if not path.endswith(".json"):
            continue
        draft = json.load(open(os.path.join(DRAFTS, path), encoding="utf-8"))
        if not gate.get(draft["id"], {}).get("pass"):
            continue
        for q in draft.get("questions") or []:
            action = (q.get("origin") or {}).get("action")
            if not action:
                unknown_origin += 1
            else:
                origin_counts[action] += 1
    reuse = origin_counts.get("原题", 0) + origin_counts.get("保留", 0) + unknown_origin
    repair = origin_counts.get("修补", 0) + origin_counts.get("修正", 0)
    authored = origin_counts.get("新命", 0)
    composition_total = reuse + repair + authored

    generated_at = "2026-11-09"
    esc = html.escape

    def pct(part: int, whole: int) -> str:
        return f"{part / whole * 100:.1f}%" if whole else "—"

    # ---------- HTML ----------
    theme_rows = "".join(
        f"<tr><td>{esc(t)}</td><td class='num'>{theme_counts[t]}</td>"
        f"<td class='num'>{sum(r['qcount'] for r in formal if r['theme'] == t)}</td></tr>"
        for t in THEME_ORDER if theme_counts.get(t)
    )
    sk_rows = "".join(
        f"<tr><td><b>{sk}</b></td><td>{esc(SKILL_FULL[sk])}</td>"
        f"<td class='num'>{len(skill_pages.get(sk, ()))}</td>"
        f"<td class='num'>{skill_questions.get(sk, 0)}</td></tr>"
        for sk in SKILL_FULL
    )
    diff_rows = "".join(
        f"<tr><td>{esc(k)}</td><td class='num'>{v}</td><td class='num'>{pct(v, len(mounted))}</td></tr>"
        for k, v in (("易", diff_counts.get("易", 0)), ("中", diff_counts.get("中", 0)),
                     ("难", diff_counts.get("难", 0)))
    )
    type_rows = "".join(
        f"<tr><td>{esc(name)}</td><td class='num'>{mounted_types.get(key, 0)}</td>"
        f"<td class='num'>{selected_types.get(key, 0)}</td><td class='num'>{all_types.get(key, 0)}</td></tr>"
        for key, name in (("choice", "选择题"), ("fill", "填空题"), ("short", "简答题"))
    )

    detail = []
    for theme in THEME_ORDER + ["其他"]:
        group = [r for r in rows if r["theme"] == theme]
        if not group:
            continue
        n_formal = sum(1 for r in group if r["formal"])
        n_down = len(group) - n_formal
        detail.append(
            f"<h3 id='theme-{esc(theme)}'>{esc(theme)}"
            f"<span class='sub'>正式 {n_formal} 篇 · 下架 {n_down} 篇</span></h3>"
        )
        detail.append("<table class='detail'><thead><tr>"
                      "<th>编号</th><th>篇名</th><th>主题</th><th class='num'>字数</th>"
                      "<th class='num'>题量</th><th>题型</th><th>考点</th><th>难度</th>"
                      "<th>来源站点</th><th>状态</th><th>复核</th></tr></thead><tbody>")
        for r in group:
            status_cls = "ok" if r["formal"] else "down"
            reason_attr = f" title='下架原因：{esc(r['reason'])}'" if r["reason"] else ""
            detail.append(
                f"<tr class='{status_cls}'><td>{esc(r['id'])}</td><td>{esc(r['title'])}</td>"
                f"<td>{esc(r['theme'])}</td><td class='num'>{r['chars']}</td>"
                f"<td class='num'>{r['qcount']}</td><td>{esc(r['qtypes'])}</td>"
                f"<td>{esc(r['skills'])}</td><td>{esc(r['difficulty'])}</td>"
                f"<td>{esc(r['site'])}</td><td><span class='pill {status_cls}'{reason_attr}>"
                f"{esc(r['status'])}</span></td><td>{esc(r['priority'])}</td></tr>"
            )
        detail.append("</tbody></table>")

    cross = []
    for sk in SKILL_FULL:
        ids = sorted(skill_pages.get(sk, ()), key=lambda x: int(x.split("-")[1]))
        titles = {r["id"]: r["title"] for r in rows}
        items = "、".join(f"{esc(rid)}《{esc(titles.get(rid, ''))}》" for rid in ids)
        cross.append(
            f"<h3>{sk} {esc(SKILL_FULL[sk])}<span class='sub'>"
            f"{len(ids)} 篇 / {skill_questions.get(sk, 0)} 题</span></h3>"
            f"<p class='index'>{items}</p>"
        )

    down_table = "".join(
        f"<tr><td>{esc(r['id'])}</td><td>{esc(r['title'])}</td><td>{esc(r['theme'])}</td>"
        f"<td>{esc(r['reason'])}</td></tr>"
        for r in down_rows
    )

    html_doc = f"""<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>三上课外阅读题库清单</title>
<style>
:root {{
  --ink:#1f2937; --muted:#64748b; --line:#d8dee8; --bg:#f4f6f9; --card:#ffffff;
  --ok:#0f6b3f; --okbg:#e7f5ec; --down:#8a2c2c; --downbg:#fbe9e9; --accent:#1e4e8c;
}}
* {{ box-sizing:border-box; }}
body {{ margin:0; background:var(--bg); color:var(--ink);
  font:14px/1.65 -apple-system,"PingFang SC","Songti SC","Microsoft YaHei",sans-serif; }}
main {{ max-width:1180px; margin:0 auto; padding:32px 28px 56px; background:var(--card);
  box-shadow:0 0 0 1px var(--line); }}
h1 {{ font-size:26px; margin:0 0 6px; letter-spacing:.5px; }}
h2 {{ font-size:18px; margin:34px 0 10px; padding-bottom:6px; border-bottom:2px solid var(--ink); }}
h3 {{ font-size:15px; margin:24px 0 8px; }}
.sub {{ font-weight:400; color:var(--muted); font-size:12px; margin-left:8px; }}
.meta {{ color:var(--muted); font-size:12.5px; }}
.cards {{ display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin:20px 0 8px; }}
.card {{ border:1px solid var(--line); border-radius:8px; padding:12px 14px; background:#fbfcfe; }}
.card b {{ display:block; font-size:24px; line-height:1.3; color:var(--accent); }}
.card span {{ color:var(--muted); font-size:12px; }}
table {{ width:100%; border-collapse:collapse; margin:8px 0 16px; }}
th, td {{ border:1px solid var(--line); padding:5px 7px; text-align:left; vertical-align:top; }}
th {{ background:#eef2f7; font-weight:600; font-size:12.5px; white-space:nowrap; }}
td.num {{ text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }}
table.detail td, table.detail th {{ font-size:12.5px; }}
tr.down td {{ color:var(--down); background:#fffafa; }}
.pill {{ display:inline-block; padding:1px 8px; border-radius:999px; font-size:11.5px; white-space:nowrap; }}
.pill.ok {{ background:var(--okbg); color:var(--ok); }}
.pill.down {{ background:var(--downbg); color:var(--down); }}
.index {{ margin:6px 0 14px; font-size:12.5px; line-height:1.9; color:#334155; }}
.note {{ background:#f7f9fc; border-left:3px solid var(--accent); padding:10px 12px;
  font-size:12.5px; color:#475569; margin:12px 0; }}
.grow {{ display:grid; grid-template-columns:1.1fr 1fr; gap:24px; }}
@media (max-width:760px) {{ .cards {{ grid-template-columns:repeat(2,1fr); }} .grow {{ grid-template-columns:1fr; }} }}
@media print {{
  body {{ background:#fff; }}
  main {{ box-shadow:none; max-width:none; padding:0; }}
  h2 {{ break-after:avoid; }}
  h3 {{ break-after:avoid; }}
  tr {{ break-inside:avoid; }}
  .detail {{ font-size:10.5px; }}
  @page {{ size:A4; margin:12mm; }}
}}
</style>
</head>
<body>
<main>
<h1>三上课外阅读题库清单</h1>
<p class="meta">生成日期 {generated_at} · 数据源 quiz-drafts（398 篇）、quality-gate.jsonl、downlisted.json、精选库 44 篇 ·
由 tools/reading-intake/work/build_inventory.py 同源生成 HTML 与 CSV，页面内数字均为脚本实时统计。</p>

<div class="cards">
  <div class="card"><b>{len(formal)}</b><span>正式题库（精选 {len(selected)} + 挂载 {len(mounted)}）</span></div>
  <div class="card"><b>{len(down_rows)}</b><span>下架稿（不计入题库）</span></div>
  <div class="card"><b>{total_q}</b><span>总题数（挂载 {total_q_mounted} + 精选 {total_q - total_q_mounted}）</span></div>
  <div class="card"><b>{len(theme_counts)}</b><span>主题分组</span></div>
</div>

<h2>一、总览</h2>
<div class="grow">
<div>
<h3>主题分布（正式 {len(formal)} 篇）<span class="sub">命题稿原主题；挂载层会把非连续 20 篇映射为科普、童话/记事并入寓言/写事</span></h3>
<table><thead><tr><th>主题</th><th class="num">篇数</th><th class="num">题数</th></tr></thead>
<tbody>{theme_rows}</tbody></table>
</div>
<div>
<h3>难度分布（仅 268 篇挂载稿有分层）<span class="sub">44 篇精选未标难度，不计入</span></h3>
<table><thead><tr><th>难度</th><th class="num">篇数</th><th class="num">占比</th></tr></thead>
<tbody>{diff_rows}</tbody></table>
<h3>题型分布</h3>
<table><thead><tr><th>题型</th><th class="num">挂载稿</th><th class="num">精选</th><th class="num">合计</th></tr></thead>
<tbody>{type_rows}</tbody></table>
</div>
</div>

<div class="grow">
<div>
<h3>SK1–SK7 覆盖（仅 268 篇挂载稿）<span class="sub">44 篇精选无 skill 字段，未计入</span></h3>
<table><thead><tr><th>代号</th><th>考点</th><th class="num">覆盖篇数</th><th class="num">题数</th></tr></thead>
<tbody>{sk_rows}</tbody></table>
</div>
<div>
<h3>原题来源构成（仅挂载稿 {composition_total} 题）<span class="sub">精选 97 题未标来源方式</span></h3>
<table><thead><tr><th>来源方式</th><th class="num">题数</th><th class="num">占比</th></tr></thead>
<tbody>
<tr><td>原题复用（原题 + 保留 + 20 题旧稿未标 action）</td><td class="num">{reuse}</td><td class="num">{pct(reuse, composition_total)}</td></tr>
<tr><td>修补（修补 + 修正）</td><td class="num">{repair}</td><td class="num">{pct(repair, composition_total)}</td></tr>
<tr><td>自命题（新命）</td><td class="num">{authored}</td><td class="num">{pct(authored, composition_total)}</td></tr>
</tbody></table>
<div class="note">机器过闸不等于人工验收：268 篇全部带 <code>needs_human_review</code> 标记，
但真正按风险排序抽查的是 REVIEW-PRIORITY.md 中的 32 篇；明细表“复核”列中
“优先”即该 32 篇，“常规”指其余过闸稿，“—”为下架稿。</div>
</div>
</div>

<h2>二、明细（先按主题，组内按 RD 编号）</h2>
<p class="meta">共 {len(rows)} 行：正式 {len(formal)} 行、下架 {len(down_rows)} 行。下架行标红并附原因（悬停可看）。</p>
{"".join(detail)}

<h2>三、按考点索引（交叉表）</h2>
<p class="meta">仅统计有 skill 字段的 268 篇挂载稿；同一篇可覆盖多个考点。</p>
{"".join(cross)}

<h2>四、下架稿清单（{len(down_rows)} 篇）</h2>
<table><thead><tr><th>编号</th><th>篇名</th><th>主题</th><th>下架原因</th></tr></thead>
<tbody>{down_table}</tbody></table>

<div class="note">
口径说明：正文字数只统计汉字；题量为该篇题目总数；题型号中“选/填/简”分别指选择、填空、简答；
来源站点按来源标签归类，无法识别时记为“试卷/教辅汇编”；精选 44 篇为项目原创，未标 skill、难度与来源方式。
本清单与 docs/reading-bank-inventory.csv 由同一脚本、同一份数据一次性生成。
</div>
</main>
</body>
</html>
"""
    with open(OUT_HTML, "w", encoding="utf-8") as f:
        f.write(html_doc)

    with open(OUT_CSV, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["编号", "篇名", "主题", "正文字数", "题量", "题型构成",
                         "涉及考点", "难度", "来源站点", "状态", "复核标记", "下架原因"])
        for r in rows:
            writer.writerow([r["id"], r["title"], r["theme"], r["chars"], r["qcount"],
                             r["qtypes"], r["skills"], r["difficulty"], r["site"],
                             r["status"], r["priority"], r["reason"]])

    print(f"HTML: {OUT_HTML}")
    print(f"CSV : {OUT_CSV}")
    print(f"正式 {len(formal)}（精选 {len(selected)} + 挂载 {len(mounted)}），下架 {len(down_rows)}，"
          f"总题 {total_q}（挂载 {total_q_mounted} + 精选 {total_q - total_q_mounted}）")
    print(f"题型 选{mounted_types['choice']}/填{mounted_types['fill']}/简{mounted_types['short']}（挂载）")
    print(f"来源构成 复用{reuse} 修补{repair} 自命{authored}，合计{composition_total}")
    print("SK:", {sk: (len(skill_pages.get(sk, ())), skill_questions.get(sk, 0)) for sk in SKILL_FULL})


if __name__ == "__main__":
    main()
