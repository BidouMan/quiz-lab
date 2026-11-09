#!/usr/bin/env python3
"""统计「原卷原题 vs 自命题」的横向对比指标，不改题库内容。

分组依据（逐题字段 origin.action，见 quiz-drafts/*.json）：
  A 基准组：action == 保留 / 原题（原题原样保留，可直接复用）
  C 修补组：action == 修补 / 修正（原题题干保留、题干或选项或评分点被改过）
  B 自命题：action == 新命，以及缺 origin 字段的补题（脚本单独打印证据）

只读 quality-gate.jsonl 判定正式题库（pass 且未下架），不写回任何题库文件。

用法：
  python3 tools/reading-intake/compare_origin.py            # 打印 Markdown 指标 + 写入 work/compare-origin.json
  python3 tools/reading-intake/compare_origin.py --json     # 只输出 JSON
"""
import argparse
import glob
import json
import os
import re
import statistics
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DRAFTS = os.path.join(ROOT, "data", "reading-catalog", "quiz-drafts")
DOWNLIST = os.path.join(ROOT, "data", "reading-catalog", "downlisted.json")
GATE = os.path.join(ROOT, "data", "reading-catalog", "quality-gate.jsonl")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "work", "compare-origin.json")

CJK = re.compile(r"[\u4e00-\u9fff]")
SPACE = re.compile(r"\s+")
QUOTE = re.compile(r"[“「]([^”」]{2,})[”」]")

# 提问动词分组（关键词命中式，非人工判读）
VERB_EXTRACT = ["摘录", "抄写", "画出", "画一画", "圈出", "用横线", "找出来", "找出",
                "填一填", "填写", "照样子写", "默写", "连线"]
VERB_THINK = ["概括", "主要写", "主要内容", "体会到", "感受到", "说明什么", "说明了",
              "为什么", "推断", "想象", "你认为", "你觉得", "表达了", "体会", "感受",
              "懂得了", "明白了什么", "有什么好处", "好在哪里"]

# 三年级上册教材未出现的写法/结构术语（按教研口径配置的固定词表）
TERMS = ["总分总", "总分", "分总", "借景抒情", "托物言志", "承上启下", "首尾呼应",
         "过渡句", "点明中心", "动静结合", "详略", "象征", "铺垫", "伏笔",
         "侧面描写", "正面描写", "表达方式", "修辞手法", "段落作用", "环境描写"]

# 干扰项「自贬式/凑数式」表述（专业卷不会用的选项语气）
FAKE_OPTION = ["凑够字数", "找不到别的话", "节省篇幅", "写得很简单", "才多写",
               "不写人的反应", "写成同一个地方", "凑数"]

# 开放型问法：答案不唯一，AI 只判对/错时容易误判
OPEN_RE = re.compile(r"联系(?:自己|你的|生活)|结合实际|谈谈你的|你的看法|你觉得|你认为|"
                     r"想象一下|还可以|如果是你|劝一劝|说一说你")

TYPE_ORDER = ["choice", "fill", "short", "judge", "other"]
SKILL_ORDER = [f"SK{i}" for i in range(1, 8)]
SKILL_MAP = {"提取信息": "SK1", "梳理概括": "SK2", "词句理解": "SK3",
             "推断体会": "SK4", "主旨情感": "SK5", "写法结构": "SK6",
             "非连续性文本": "SK7"}


def cjk_only(text):
    return "".join(CJK.findall(text or ""))


def stem_len(stem):
    """题干字符数：去掉空白后的全部字符（含标点），与卷面观感一致。"""
    return len(SPACE.sub("", stem or ""))


def max_common_run(text, body, floor=8, cap=40):
    """返回 text 与 body 的最长逐字公共汉字片段长度（仅比 ≥floor，cap 截断）。"""
    q = cjk_only(text)
    if len(q) < floor:
        return 0
    top = min(len(q), cap)
    for k in range(top, floor - 1, -1):
        for i in range(0, len(q) - k + 1):
            if q[i:i + k] in body:
                return k
    return 0


def load():
    drafts = []
    for path in sorted(glob.glob(os.path.join(DRAFTS, "*.json"))):
        with open(path, encoding="utf-8") as f:
            drafts.append(json.load(f))
    downlisted = set()
    if os.path.exists(DOWNLIST):
        with open(DOWNLIST, encoding="utf-8") as f:
            downlisted = {r["id"] for r in json.load(f).get("readings", [])}
    gate = {}
    if os.path.exists(GATE):
        with open(GATE, encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    row = json.loads(line)
                    gate[row["id"]] = row
    mounted = [d for d in drafts
               if d["id"] not in downlisted and gate.get(d["id"], {}).get("pass")]
    return drafts, mounted, gate, downlisted


def group_of(q):
    action = (q.get("origin") or {}).get("action")
    if action == "新命" or action is None:
        return "B"
    if action in ("修补", "修正"):
        return "C"
    if action in ("保留", "原题"):
        return "A"
    raise SystemExit(f"未知 origin.action：{action!r}")


def evidence_text(q):
    """用于判断「答案能否回到原文」的答案侧文本。"""
    if q["type"] == "fill":
        return "".join(q.get("blanks") or [])
    if q["type"] == "short":
        return "".join(q.get("scoring") or []) + (q.get("answer") or "")
    return q.get("explain") or ""


def pct(n, d):
    return round(n / d * 100, 1) if d else 0.0


def stat_row(values):
    if not values:
        return {"n": 0}
    s = sorted(values)
    return {
        "n": len(s),
        "mean": round(statistics.mean(s), 2),
        "median": statistics.median(s),
        "p90": s[min(len(s) - 1, int(round(len(s) * 0.9)) - 1)],
        "min": s[0],
        "max": s[-1],
    }


def collect(mounted, gate):
    groups = {"A": [], "B": [], "C": []}   # list of (draft, q, qkey)
    page_groups = defaultdict(set)
    for d in mounted:
        body = cjk_only("".join(d["paragraphs"]))
        for idx, q in enumerate(d["questions"], 1):
            g = group_of(q)
            key = f"{d['id']}#{idx}"
            groups[g].append((d, q, key, body))
            page_groups[g].add(d["id"])

    out = {"meta": {}, "groups": {}}
    out["meta"] = {
        "draftFiles": None,
        "mountedPages": len(mounted),
        "downlisted": None,
    }
    return groups, page_groups, out


def analyze(groups, page_groups, mounted, gate, drafts, downlisted):
    res = {"meta": {
        "draftFiles": len(drafts),
        "downlisted": len(downlisted),
        "gatePassPages": len(mounted),
        "questionTotal": sum(len(v) for v in groups.values()),
    }, "groups": {}}

    for g in ("A", "B", "C"):
        rows = groups[g]
        qs = [q for _, q, _, _ in rows]
        n = len(qs)
        pages = page_groups[g]
        block = {"pages": len(pages), "questions": n}

        # 1 题型
        types = Counter(q["type"] for q in qs)
        block["types"] = {t: {"n": types.get(t, 0), "pct": pct(types.get(t, 0), n)}
                          for t in TYPE_ORDER}

        # 2 题干长度
        block["stemLen"] = stat_row([stem_len(q["stem"]) for q in qs])

        # 3 每篇题量分布（该组在该篇的题数）
        per_page = Counter()
        for d in mounted:
            c = sum(1 for q in d["questions"] if group_of(q) == g)
            if c:
                per_page[c] += 1
        block["perPage"] = {str(k): v for k, v in sorted(per_page.items())}
        block["perPageMean"] = round(
            sum(k * v for k, v in per_page.items()) / sum(per_page.values()), 2) if per_page else 0

        # 4 考点
        skills = Counter(SKILL_MAP.get(q.get("skill"), "?") for q in qs)
        block["skills"] = {s: {"n": skills.get(s, 0), "pct": pct(skills.get(s, 0), n)}
                           for s in SKILL_ORDER}

        # 5 答案可回溯率（≥8 字逐字回文 / ≥12 字严格）
        runs = [max_common_run(evidence_text(q), body) for _, q, _, body in rows]
        block["trace"] = {
            "ge8": {"n": sum(1 for r in runs if r >= 8), "pct": pct(sum(1 for r in runs if r >= 8), n)},
            "ge12": {"n": sum(1 for r in runs if r >= 12), "pct": pct(sum(1 for r in runs if r >= 12), n)},
            "meanRun": round(statistics.mean(runs), 2) if runs else 0,
        }
        block["traceByType"] = {}
        for t in ("choice", "fill", "short"):
            sub = [(q, body) for _, q, _, body in rows if q["type"] == t]
            if not sub:
                continue
            hit = sum(1 for q, body in sub if max_common_run(evidence_text(q), body) >= 8)
            block["traceByType"][t] = {"n": len(sub), "ge8": hit, "pct": pct(hit, len(sub))}

        # 填空题单独口径：答案（全部空）是否逐字出现在正文里
        fill_rows = [(d, q) for d, q, _, _ in rows if q["type"] == "fill"]
        fill_exact = sum(1 for d, q in fill_rows
                         if all(str(b).strip() and str(b) in "".join(d["paragraphs"])
                                for b in (q.get("blanks") or [])))
        block["fillExact"] = {"n": fill_exact, "pct": pct(fill_exact, len(fill_rows)),
                              "base": len(fill_rows)}
        blanks = [len(SPACE.sub("", str(b))) for _, q in fill_rows for b in (q.get("blanks") or [])]
        block["fillShape"] = {
            "blanksPerQ": round(len(blanks) / len(fill_rows), 2) if fill_rows else 0,
            "ansLenMean": round(statistics.mean(blanks), 2) if blanks else 0,
            "ansLenMedian": statistics.median(blanks) if blanks else 0,
        }

        # 6 主观题评分点
        shorts = [(q, body) for _, q, _, body in rows if q["type"] == "short"]
        sc = Counter(len(q.get("scoring") or []) for q, _ in shorts)
        block["scoring"] = {
            "n": len(shorts),
            "counts": {str(k): v for k, v in sorted(sc.items())},
            "withQuote": {
                "n": sum(1 for q, _ in shorts if any(QUOTE.search(s) for s in q.get("scoring") or [])),
            },
            "withRun8": {
                "n": sum(1 for q, body in shorts
                         if any(max_common_run(s, body) >= 8 for s in (q.get("scoring") or []))),
            },
        }
        block["scoring"]["withQuote"]["pct"] = pct(block["scoring"]["withQuote"]["n"], len(shorts))
        block["scoring"]["withRun8"]["pct"] = pct(block["scoring"]["withRun8"]["n"], len(shorts))
        # 主观题参考答案覆盖率（AI 按「对/错」批改时的主要依据）
        with_answer = sum(1 for q, _ in shorts if (q.get("answer") or "").strip())
        block["shortAnswer"] = {"n": with_answer, "pct": pct(with_answer, len(shorts)),
                                "base": len(shorts)}
        open_n = sum(1 for q, _ in shorts if OPEN_RE.search(q["stem"]))
        block["openEnded"] = {"n": open_n, "pct": pct(open_n, len(shorts)),
                              "keys": [key for _, q, key, _ in rows
                                       if q["type"] == "short" and OPEN_RE.search(q["stem"])]}

        # 7 选择题选项
        choices = [q for q in qs if q["type"] == "choice"]
        ratio, above = [], 0
        for q in choices:
            ls = [len(SPACE.sub("", o)) for o in q["options"]]
            ratio.append(max(ls) / min(ls) if min(ls) else 999)
            if any(re.search(r"以上.{0,3}(都|均|全)", o) or "以上都对" in o or "以上都不对" in o
                   for o in q["options"]):
                above += 1
        block["choice"] = {
            "n": len(choices),
            "ratioGt2": {"n": sum(1 for r in ratio if r > 2.0), "pct": pct(sum(1 for r in ratio if r > 2.0), len(choices))},
            "ratioMean": round(statistics.mean(ratio), 2) if ratio else 0,
            "ratioMax": round(max(ratio), 2) if ratio else 0,
            "aboveAll": {"n": above, "pct": pct(above, len(choices))},
            "answerPos": {str(i): {"n": sum(1 for q in choices if q["answer"] == i),
                                   "pct": pct(sum(1 for q in choices if q["answer"] == i), len(choices))}
                          for i in range(4)},
            "fakeOption": {"n": sum(1 for q in choices
                                    if any(w in o for o in q["options"] for w in FAKE_OPTION)),
                           "pct": pct(sum(1 for q in choices
                                          if any(w in o for o in q["options"] for w in FAKE_OPTION)),
                                      len(choices))},
        }

        # 8 提问动词
        ex = sum(1 for q in qs if any(w in q["stem"] for w in VERB_EXTRACT))
        th = sum(1 for q in qs if any(w in q["stem"] for w in VERB_THINK))
        none = sum(1 for q in qs
                   if not any(w in q["stem"] for w in VERB_EXTRACT)
                   and not any(w in q["stem"] for w in VERB_THINK))
        block["verbs"] = {
            "extract": {"n": ex, "pct": pct(ex, n)},
            "think": {"n": th, "pct": pct(th, n)},
            "both": {"n": sum(1 for q in qs if any(w in q["stem"] for w in VERB_EXTRACT)
                              and any(w in q["stem"] for w in VERB_THINK))},
            "neither": {"n": none, "pct": pct(none, n)},
        }
        # 多问复合题（题干含 ≥2 个问号）
        multi = sum(1 for q in qs if q["stem"].count("？") >= 2)
        block["multiAsk"] = {"n": multi, "pct": pct(multi, n)}

        # 答案来源（原卷是否有答案）
        src = Counter(q.get("answerSource") or "未标注" for q in qs)
        block["answerSource"] = {k: {"n": v, "pct": pct(v, n)} for k, v in src.most_common()}

        # 9 超纲术语（题干 + 选项；术语常藏在选项里）
        hits = []
        for _, q, key, _ in rows:
            text = q["stem"] + "".join(q.get("options") or [])
            for term in TERMS:
                if term in text:
                    hits.append((key, term))
        by_term = Counter(t for _, t in hits)
        block["terms"] = {
            "n": len({k for k, _ in hits}),
            "pct": pct(len({k for k, _ in hits}), n),
            "byTerm": dict(by_term),
            "keys": sorted({k for k, _ in hits}),
        }
        # 正确答案本身就是术语的题（必须认识术语才能答对）
        term_answer = []
        for _, q, key, _ in rows:
            if q["type"] != "choice":
                continue
            if any(t in q["options"][q["answer"]] for t in TERMS):
                term_answer.append(key)
        block["termAnswer"] = {"n": len(term_answer), "keys": term_answer}


        # 10 难度（页级，题目继承所在篇）
        diff = Counter(gate[d["id"]].get("difficulty", "中") for d, _, _, _ in rows)
        block["difficulty"] = {k: {"n": diff.get(k, 0), "pct": pct(diff.get(k, 0), n)}
                               for k in ("易", "中", "难")}

        # 模板化重复题干（B 组重点）
        stems = Counter(SPACE.sub("", q["stem"]) for q in qs)
        dup_n = sum(c for c in stems.values() if c >= 2)
        block["dupStem"] = {
            "n": dup_n,
            "pct": pct(dup_n, n),
            "top": [[s[:24], c] for s, c in stems.most_common(5) if c >= 2],
        }
        # 模板家族：以固定前缀起头的题（用于识别批量补题模板）
        families = Counter()
        for q in qs:
            s = SPACE.sub("", q["stem"])
            for prefix in ("文中写“", "短文主要写", "短文第", "这句话", "短文最后"):
                if s.startswith(prefix):
                    families[prefix] += 1
                    break
        block["templates"] = dict(families)

        res["groups"][g] = block

    # 跨组混合篇
    mixed = 0
    for d in mounted:
        gs = {group_of(q) for q in d["questions"]}
        if len(gs) > 1:
            mixed += 1
    res["meta"]["mixedPages"] = mixed

    # 页级难度：按该篇含哪些组拆分（难度是页级字段，题目继承）
    page_diff = {"all": Counter(), "Aonly": Counter(), "Bonly": Counter(),
                 "withB": Counter(), "Conly": Counter()}
    for d in mounted:
        diff = gate[d["id"]].get("difficulty", "中")
        gs = {group_of(q) for q in d["questions"]}
        page_diff["all"][diff] += 1
        if gs == {"A"}:
            page_diff["Aonly"][diff] += 1
        if gs == {"B"}:
            page_diff["Bonly"][diff] += 1
        if "B" in gs:
            page_diff["withB"][diff] += 1
        if gs == {"C"}:
            page_diff["Conly"][diff] += 1
    res["pageDifficulty"] = {k: dict(v) for k, v in page_diff.items()}

    # B 组风险清单（机械规则，只用于排序复核，不代替人工判断）
    risk = defaultdict(list)
    for d, q, key, body in groups["B"]:
        if q["type"] == "short":
            sc = "".join(q.get("scoring") or [])
            quoted = [x for x in QUOTE.findall(sc) if cjk_only(x) in body]
            runs = max([max_common_run(s, body, floor=6) for s in (q.get("scoring") or [])] + [0])
            if not quoted and runs < 6:
                risk["简答评分点无原文依据"].append(key)
        if q["stem"].count("？") >= 2 and len(q.get("scoring") or []) <= 2:
            risk["多问复合但评分点仅 2 条"].append(key)
        for term in TERMS:
            if term in q["stem"]:
                risk[f"超纲术语：{term}"].append(key)
    res["bRisk"] = {k: v for k, v in risk.items()}

    # SK6（写法结构）专项：B 组的题型与正确项位置
    sk6 = {"n": 0, "types": Counter(), "answerPos": Counter(), "keys": []}
    for d, q, key, body in groups["B"]:
        if q.get("skill") == "写法结构":
            sk6["n"] += 1
            sk6["types"][q["type"]] += 1
            if q["type"] == "choice":
                sk6["answerPos"][q["answer"]] += 1
                if q["answer"] == 0:
                    sk6["keys"].append(key)
    res["sk6"] = {"n": sk6["n"], "types": dict(sk6["types"]),
                  "answerPos": dict(sk6["answerPos"]), "keysAtA": sk6["keys"]}


    # 缺 origin 的题（归入 B 的证据）
    missing = []
    for d in mounted:
        for idx, q in enumerate(d["questions"], 1):
            if "origin" not in q:
                missing.append({"key": f"{d['id']}#{idx}", "type": q["type"],
                                "skill": q.get("skill"), "stem": q["stem"]})
    res["missingOrigin"] = missing
    return res


def fmt_table(title, rows):
    print(f"\n### {title}\n")
    print("| 指标 | A 原题原样 | B 自命题 | C 原题修补 |")
    print("| --- | --- | --- | --- |")
    for label, getter in rows:
        cells = []
        for g in ("A", "B", "C"):
            cells.append(getter(res["groups"][g]))
        print(f"| {label} | " + " | ".join(cells) + " |")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    drafts, mounted, gate, downlisted = load()
    groups, page_groups, _ = collect(mounted, gate)
    global res
    res = analyze(groups, page_groups, mounted, gate, drafts, downlisted)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(res, f, ensure_ascii=False, indent=2)

    if args.json:
        print(json.dumps(res, ensure_ascii=False, indent=2))
        return

    m = res["meta"]
    print(f"脚本：tools/reading-intake/compare_origin.py")
    print(f"命题稿 {m['draftFiles']} 篇；已归档/下架 {m['downlisted']} 篇；"
          f"正式题库(quality_gate pass) {m['gatePassPages']} 篇；题目 {m['questionTotal']} 道；"
          f"跨组混合篇 {m['mixedPages']} 篇")
    for g in ("A", "B", "C"):
        b = res["groups"][g]
        print(f"{g} 组：{b['pages']} 篇 / {b['questions']} 题")

    def pctcell(v):
        return f"{v['n']}（{v['pct']}%）"

    fmt_table("1 题型配比", [
        ("选择题", lambda b: pctcell(b["types"]["choice"])),
        ("填空题", lambda b: pctcell(b["types"]["fill"])),
        ("简答题", lambda b: pctcell(b["types"]["short"])),
        ("判断题", lambda b: pctcell(b["types"]["judge"])),
    ])
    fmt_table("2 题干字数（去空白字符）", [
        ("平均", lambda b: f"{b['stemLen']['mean']}"),
        ("中位数", lambda b: f"{b['stemLen']['median']}"),
        ("P90", lambda b: f"{b['stemLen']['p90']}"),
    ])
    fmt_table("3 每篇题量", [
        ("平均每篇命中的该组题数", lambda b: f"{b['perPageMean']}"),
        ("分布", lambda b: " ".join(f"{k}题×{v}篇" for k, v in b["perPage"].items())),
    ])
    fmt_table("4 考点占比", [
        (s, (lambda s: (lambda b: pctcell(b["skills"][s])))(s)) for s in SKILL_ORDER
    ])
    fmt_table("5 答案可回溯", [
        ("答案侧 ≥8 字逐字回文", lambda b: pctcell(b["trace"]["ge8"])),
        ("≥12 字", lambda b: pctcell(b["trace"]["ge12"])),
        ("平均最长回文片段（字）", lambda b: f"{b['trace']['meanRun']}"),
    ])
    fmt_table("5b 分题型（≥8 字口径）", [
        (f"{t}", (lambda t: (lambda b: pctcell(b["traceByType"][t])))(t))
        for t in ("choice", "fill", "short")
    ])
    fmt_table("5c 填空答案逐字回文（不卡字数）", [
        ("全部空都能在正文逐字找到", lambda b: pctcell(b["fillExact"])),
        ("平均每题的空白数", lambda b: f"{b['fillShape']['blanksPerQ']}"),
        ("单个答案平均字数", lambda b: f"{b['fillShape']['ansLenMean']}"),
    ])
    fmt_table("6 主观题评分点", [
        ("2 条", lambda b: f"{b['scoring']['counts'].get('2', 0)}"),
        ("3 条", lambda b: f"{b['scoring']['counts'].get('3', 0)}"),
        ("有参考答案 answer", lambda b: pctcell(b["shortAnswer"])),
        ("开放型问法（答案不唯一）", lambda b: pctcell(b["openEnded"])),
        ("评分点带“…”原文引证", lambda b: pctcell(b["scoring"]["withQuote"])),
        ("评分点含 ≥8 字原文片段", lambda b: pctcell(b["scoring"]["withRun8"])),
    ])
    fmt_table("7 选择题选项", [
        ("长度极差比 >2.0", lambda b: pctcell(b["choice"]["ratioGt2"])),
        ("平均极差比", lambda b: f"{b['choice']['ratioMean']}"),
        ("含“以上都…”凑数项", lambda b: pctcell(b["choice"]["aboveAll"])),
        ("正确项在 A 位", lambda b: pctcell(b["choice"]["answerPos"]["0"])),
        ("正确项在 D 位", lambda b: pctcell(b["choice"]["answerPos"]["3"])),
        ("含自贬/凑数式干扰项", lambda b: pctcell(b["choice"]["fakeOption"])),
    ])
    fmt_table("8 提问动词", [
        ("摘录/画出/抄写类", lambda b: pctcell(b["verbs"]["extract"])),
        ("概括/体会/推断类", lambda b: pctcell(b["verbs"]["think"])),
        ("两类都命中", lambda b: f"{b['verbs']['both']['n']}"),
        ("两类都未命中", lambda b: pctcell(b["verbs"]["neither"])),
        ("多问复合（≥2 个问号）", lambda b: pctcell(b["multiAsk"])),
    ])
    fmt_table("附 答案来源字段 answerSource", [
        ("original（原卷自带）", lambda b: f"{b['answerSource'].get('original', {}).get('n', 0)}"),
        ("new（我们新写）", lambda b: f"{b['answerSource'].get('new', {}).get('n', 0)}"),
        ("source-missing（原卷缺答案）", lambda b: f"{b['answerSource'].get('source-missing', {}).get('n', 0)}"),
        ("未标注", lambda b: f"{b['answerSource'].get('未标注', {}).get('n', 0)}"),
    ])
    fmt_table("9 超纲术语命中（题干+选项）", [
        ("命中题数（去重）", lambda b: pctcell({"n": b["terms"]["n"], "pct": b["terms"]["pct"]})),
        ("正确答案本身就是术语", lambda b: f"{b['termAnswer']['n']}"),
        ("命中词表", lambda b: "、".join(f"{k}×{v}" for k, v in b["terms"]["byTerm"].items()) or "—"),
    ])
    fmt_table("10 难度（页级，题目继承）", [
        ("易 A", lambda b: pctcell(b["difficulty"]["易"])),
        ("中 B", lambda b: pctcell(b["difficulty"]["中"])),
        ("难 C", lambda b: pctcell(b["difficulty"]["难"])),
    ])
    fmt_table("附 模板化重复题干", [
        ("重复题面题数", lambda b: pctcell(b["dupStem"])),
        ("固定前缀题数", lambda b: " ".join(f"{k}×{v}" for k, v in b["templates"].items()) or "—"),
    ])
    print("\n超纲术语题号：")
    for g in ("A", "B", "C"):
        print(f"  {g}: " + ("、".join(res["groups"][g]["terms"]["keys"]) or "—"))
    print("\n页级难度（按该篇含哪些组拆，难度为页级字段）：")
    for k, v in res["pageDifficulty"].items():
        print(f"  {k}: " + " ".join(f"{d}{n}篇" for d, n in v.items()))
    print("\nB 组机械风险清单（仅排序复核，非定性结论）：")
    for k, v in res["bRisk"].items():
        print(f"  {k}: {len(v)} 题 → " + "、".join(v[:80]))
    print(f"\nB 组 SK6：{res['sk6']['n']} 题，题型 {res['sk6']['types']}，"
          f"正确项位置 {res['sk6']['answerPos']}")
    print("  SK6 正确项在 A 的题：" + "、".join(res["sk6"]["keysAtA"]))
    print("\n缺 origin 字段、已归入 B 的题目：")
    print("  " + "、".join(f"{x['key']}({x['skill']})" for x in res["missingOrigin"]))
    print(f"\nJSON 已写入 {os.path.relpath(OUT, ROOT)}")


if __name__ == "__main__":
    main()
