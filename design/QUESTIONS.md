# Questions for John

Agents add questions here; John answers inline (or in a GitHub issue later). spec-keeper moves answers into DECISIONS.md.

### Q-001 Headline feature  (Open)
Context: Real-time status, FAA delays and weather moved into the MVP on 2026-10-13. The build order depends on what leads.
A) Seat availability stays the headline; live data supports it
B) Equal: both shown on every result
C) Routing + live status/weather lead; seat availability is secondary
Recommendation: B. Live data is free or already paid for, and both fit on a result row.
Answer:

### Q-002 Remove react-native-maps?  (Answered 2026-10-13)
Answer: Moot. Starting a fresh project on the Mac; the old test code isn't used.

### Q-003 Airport buffer for the leave-by card  (Open)
Context: Default is "be at the airport 75 min before departure".
A) Keep 75 min  B) 60 min  C) Tester setting with 75 default
Recommendation: C.
Answer:

### Q-004 Theme tokens beyond accent and amber  (Open)
Context: DECISIONS.md confirms only accent (#1D3D84/#9BB8EF) and amber you-text (#9A5200/#FFC27A). Backlog 0 proceeded with provisional values copied from the Ice Mix look in the v9.1 prototype (surfaces, text, tier, weather violet #5b4bd6/#b7adff, magenta #a3269a/#f283e8, type scale) in src/theme/, marked provisional. Non-blocking.
A) Confirm prototype values as-is  B) Keep provisional; John reviews on device first  C) John supplies values
Recommendation: A, after John sees it on his phone.
Answer:

### Q-005 Font weights  (Open)
Context: Using the prototype's loaded weights: Big Shoulders Display 600/700/800, Manrope 400/500/600/700. Non-blocking.
A) Confirm  B) Other weights
Recommendation: A.
Answer:

### Q-006 Light-theme "faint" text contrast fix  (Open)
Context: Prototype light faint text #66758a is 4.17:1 on surface2 and 4.41:1 on bg, failing the >=4.5:1 rule. Implemented as #606f84 (4.55 / 4.81). Non-blocking.
A) Accept #606f84  B) Keep #66758a but never use faint on surface2/bg
Recommendation: A.
Answer:
