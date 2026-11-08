#!/usr/bin/env python3
"""把 QuizLab 项目恢复到 Trae CN 的项目栏，并清理指向已改名目录 LeoMath 的失效记录。

用法：
    1. 完全退出 Trae CN（Cmd+Q，确认进程已消失）
    2. python3 apply-quizlab-project.py
    3. 重新打开 Trae CN

脚本只改 state.vscdb 里的两个键：
    solo-lite.local-project-folders   （项目 ID → 文件夹路径）
    solo-lite.project-workspace-cache （项目 ID → 身份/可用性/文件夹/显示名）

写前自动备份，写后回读校验，校验失败自动回滚。
"""

import json
import os
import shutil
import sqlite3
import subprocess
import sys
import time

OLD_PATH = "/Users/amixc/MyWorkSpace/CodeStaction/LeoMath"
NEW_PATH = "/Users/amixc/MyWorkSpace/CodeStaction/QuizLab"
NEW_NAME = "QuizLab"

STORAGE_DIR = os.path.expanduser(
    "~/Library/Application Support/Trae CN/User/globalStorage"
)
KEY_FOLDERS = "solo-lite.local-project-folders"
KEY_CACHE = "solo-lite.project-workspace-cache"


def trae_running() -> bool:
    try:
        out = subprocess.run(
            ["pgrep", "-f", "Trae CN"], capture_output=True, text=True
        )
        return bool(out.stdout.strip())
    except FileNotFoundError:
        return False


def load(db: str, key: str):
    con = sqlite3.connect(db)
    try:
        row = con.execute("SELECT value FROM ItemTable WHERE key = ?", (key,)).fetchone()
    finally:
        con.close()
    return None if row is None else json.loads(row[0])


def save(db: str, key: str, value) -> None:
    con = sqlite3.connect(db)
    try:
        con.execute(
            "UPDATE ItemTable SET value = ? WHERE key = ?",
            (json.dumps(value, ensure_ascii=False, separators=(",", ":")), key),
        )
        con.commit()
    finally:
        con.close()


def plan(folders: dict, cache: dict):
    """返回 (新的 folders, 新的 cache, 说明列表)。保留原项目 ID，避免老会话失去归属。"""
    notes = []

    # 已经存在指向新路径的项目：只清理失效的 LeoMath 条目
    existing_new = [pid for pid, path in folders.items() if path == NEW_PATH]
    stale = [pid for pid, path in folders.items() if path == OLD_PATH]

    if existing_new:
        notes.append(f"已存在指向 QuizLab 的项目：{existing_new}，不再新建，只删除失效条目")
        for pid in stale:
            folders.pop(pid, None)
            cache.pop(pid, None)
            notes.append(f"删除失效项目 {pid}（{OLD_PATH}）")
        return folders, cache, notes

    if not stale:
        notes.append("没有找到旧项目记录，将新建一条项目记录")
        pid = "quizlab" + str(int(time.time() * 1000))
        folders[pid] = NEW_PATH
        cache[pid] = {
            "identity": NEW_PATH,
            "available": True,
            "folders": [NEW_PATH],
            "name": NEW_NAME,
        }
        notes.append(f"新建项目 {pid} → {NEW_PATH}")
        return folders, cache, notes

    # 常规情况：目录改名，把旧记录指向新路径
    for pid in stale:
        folders[pid] = NEW_PATH
        entry = cache.get(pid, {})
        entry["identity"] = NEW_PATH
        entry["available"] = True
        entry["folders"] = [NEW_PATH]
        entry["name"] = NEW_NAME
        cache[pid] = entry
        notes.append(f"项目 {pid} 路径由 {OLD_PATH} 改为 {NEW_PATH}")
    return folders, cache, notes


def apply(db: str, dry_run: bool) -> bool:
    folders = load(db, KEY_FOLDERS)
    cache = load(db, KEY_CACHE)
    if folders is None or cache is None:
        print(f"  [跳过] {os.path.basename(db)}：缺少项目相关键")
        return True

    new_folders, new_cache, notes = plan(dict(folders), dict(cache))
    for note in notes:
        print(f"  - {note}")

    if dry_run:
        print("  [dry-run] 未写库")
        return True

    save(db, KEY_FOLDERS, new_folders)
    save(db, KEY_CACHE, new_cache)
    return True


def verify(db: str) -> bool:
    folders = load(db, KEY_FOLDERS)
    cache = load(db, KEY_CACHE)
    ok = True

    hits = [pid for pid, path in folders.items() if path == NEW_PATH]
    stale = [pid for pid, path in folders.items() if path == OLD_PATH]
    dup_names = [pid for pid, e in cache.items() if e.get("folders") == [NEW_PATH]]
    missing_cache = [pid for pid in hits if pid not in cache]

    print(f"  指向 QuizLab 的项目：{hits}")
    print(f"  仍指向 LeoMath 的项目：{stale or '无'}")
    print(f"  同路径重复条目：{dup_names if len(dup_names) > 1 else '无'}")
    if not hits:
        print("  [失败] 没有指向 QuizLab 的项目记录")
        ok = False
    if stale:
        print("  [失败] 仍存在失效的 LeoMath 记录")
        ok = False
    if len(hits) > 1:
        print("  [失败] 同一路径出现多条项目记录")
        ok = False
    if missing_cache:
        print(f"  [失败] 项目 {missing_cache} 缺少 cache 条目")
        ok = False
    for pid in hits:
        e = cache.get(pid, {})
        if not e.get("available"):
            print(f"  [失败] 项目 {pid} 未标记为可用")
            ok = False
        if e.get("name") != NEW_NAME:
            print(f"  [警告] 项目 {pid} 显示名为 {e.get('name')!r}，预期 {NEW_NAME!r}")
    return ok


def main() -> int:
    dry_run = "--dry-run" in sys.argv

    if not dry_run and trae_running():
        print("Trae CN 仍在运行。请先 Cmd+Q 完全退出，再执行本脚本。")
        print("（运行中写库会被应用退出时回写覆盖，结果不可预期。）")
        return 2

    if not os.path.isdir(NEW_PATH):
        print(f"目标目录不存在：{NEW_PATH}")
        return 2

    targets = [
        os.path.join(STORAGE_DIR, "state.vscdb"),
        os.path.join(STORAGE_DIR, "state.vscdb.backup"),
    ]
    targets = [p for p in targets if os.path.exists(p)]
    if not targets:
        print(f"找不到 state.vscdb：{STORAGE_DIR}")
        return 2

    stamp = time.strftime("%Y%m%d-%H%M%S")
    backup_dir = os.path.join(STORAGE_DIR, f"backup-quizlab-{stamp}")

    if not dry_run:
        os.makedirs(backup_dir, exist_ok=True)
        for path in targets:
            shutil.copy2(path, os.path.join(backup_dir, os.path.basename(path)))
        print(f"备份完成：{backup_dir}")

    for db in targets:
        print(f"\n处理 {os.path.basename(db)}")
        apply(db, dry_run)
        if not dry_run and not verify(db):
            print("校验失败，回滚……")
            for path in targets:
                shutil.copy2(os.path.join(backup_dir, os.path.basename(path)), path)
            print("已回滚到备份状态。")
            return 1

    if dry_run:
        print("\ndry-run 结束，未做任何写入。")
        return 0

    print("\n完成。重新打开 Trae CN，项目栏应出现 QuizLab。")
    print(f"如需回滚：把 {backup_dir} 里的两个文件覆盖回 {STORAGE_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
