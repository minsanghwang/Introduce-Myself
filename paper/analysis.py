#!/usr/bin/env python3
"""사전 설계(01_pre_registration.md)의 판정 기준을 주간 자료에 적용한다.

사용법: python3 -I analysis.py data/trends_kr_weekly_2026-11-02.csv

- 기준선: 주 시작일이 2026-10-11 이하인 주
- 관측: 주 시작일이 2026-10-18 이상인 주
- 약한 기준("돌파"): 관측 주 중 하나라도 기준선 주간 최댓값을 넘는다.
- 가설 지지: 주 키워드(비상식량)가 약한 기준을 충족하고, 보조 키워드 둘 중 하나 이상도 충족한다.
- 강한 기준(일간 평균+표준편차 3배, 3일 연속)은 일간 자료가 필요하므로 이 스크립트는 판정하지 않는다.
"""
import csv
import statistics
import sys
from datetime import date

KEYS = ["비상식량", "생존배낭", "비상용품", "캠핑"]
PRIMARY = "비상식량"
SECONDARY = ["생존배낭", "비상용품"]
CONTROL = "캠핑"
OBS_START = date(2026, 10, 18)


def load(path):
    rows = []
    with open(path, encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            rows.append((date.fromisoformat(r["week_start"]), {k: int(r[k]) for k in KEYS}))
    return rows


def main(path):
    rows = load(path)
    base = [(d, v) for d, v in rows if d < OBS_START]
    obs = [(d, v) for d, v in rows if d >= OBS_START]
    print(f"전체 {len(rows)}주 (기준선 {len(base)}주, 관측 {len(obs)}주), 키워드 {len(KEYS)}개 -> 값 {len(rows) * len(KEYS)}개")
    print(f"기준선: {base[0][0]} ~ {base[-1][0]} / 관측: {obs[0][0]} ~ {obs[-1][0]} (마지막 주는 미완성)")
    print()
    weak = {}
    for k in KEYS:
        b = [v[k] for _, v in base]
        o = [v[k] for _, v in obs]
        weak[k] = max(o) > max(b)
        print(
            f"{k}: 기준선 최댓값 {max(b)}, 평균 {statistics.mean(b):.2f}, 표준편차 {statistics.pstdev(b):.2f} | "
            f"관측 {o} | 최댓값 {max(o)} -> 약한 기준 {'충족' if weak[k] else '불충족'}"
        )
    print()
    sec = [k for k in SECONDARY if weak[k]]
    if weak[PRIMARY] and sec:
        verdict = "지지(약한 기준, 잠정)"
    elif weak[PRIMARY] or sec:
        verdict = "부분 지지"
    else:
        verdict = "불지지"
    print(f"판정(사전 기준): {verdict} / 충족한 보조 키워드: {sec if sec else '없음'}")
    if weak[CONTROL]:
        print("주의: 비교 키워드(캠핑)도 기준선 최댓값을 넘음 -> 계절·일반 요인 가능성")
    else:
        print("비교 키워드(캠핑)는 기준선 최댓값을 넘지 않음")


if __name__ == "__main__":
    main(sys.argv[1])
