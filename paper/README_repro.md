# 재현 방법 (README)

Python 3이 있으면 추가 패키지 없이 돌아간다.

| 파일 | 내용 |
| --- | --- |
| data/trends_kr_weekly_2026-11-02.csv | 원자료. 주간 53행 × 키워드 4개 |
| data/README_data.md | 출처, 설정, 받은 날짜, 한계 |
| analysis.py | 판정 스크립트(표준 라이브러리만) |
| 01_pre_registration.md | 데이터를 보기 전 설계와 변경 이력 |
| 00_topic_selection.md, 02_results_and_conclusion.md | 가설 선정 과정, 결과와 결론 |

실행:

```bash
python3 -I analysis.py data/trends_kr_weekly_2026-11-02.csv
```

기대하는 출력은 `results_provisional_2026-11-02.txt`와 같다(전체 53주, 비상식량 [4, 100, 80] 충족, 생존배낭 [8, 72, 100] 충족, 비상용품 [6, 23, 0] 불충족, 캠핑 [77, 73, 64] 불충족, 판정: 지지(약한 기준, 잠정)).

**원자료를 다시 받을 때.** Google 트렌드(trends.google.com/trends/explore)에서 지역 대한민국, 웹 검색, 모든 카테고리, "지난 12개월"로 키워드를 하나씩 조회한다. 지금 다시 받으면 12개월 창이 이동해 기준선 기간과 지수 정규화가 달라지고 Google이 지난 값을 조정할 수도 있어 숫자가 이 논문과 다를 수 있다. 그래서 받은 원자료 CSV를 함께 넣었고 재현은 스크립트와 이 CSV로 한다.

**알려진 재현 한계.** 원자료를 브라우저 화면에서 읽어 옮겼다(파일 내려받기 미사용). 시간이 지남에 따라 이 값을 독립적으로 다시 얻기는 어렵다.
