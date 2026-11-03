# Usability Testing Protocol — socroot-topology-studio

> **Protocol Version:** 1.0.0  
> **Target Audience:** 3 to 5 participants who did NOT build the tool (at least one non-programmer).  
> **Methodology:** Think-aloud moderated usability study, task completion metrics, and System Usability Scale (SUS).

---

## 1. Participant Criteria & Recruitment
- **Cohort Size:** 3 to 5 independent participants.
- **Background Diversity:**
  - Participant 1: Systems engineer / DevOps / Infrastructure practitioner.
  - Participant 2: Frontend / Full-stack software developer.
  - Participant 3: Non-programmer (Product Manager, Security Auditor, or Operations specialist).
- **Exclusion Criteria:** Anyone who contributed code, issues, or reviews to this repository.

---

## 2. Environment & Recording Setup
- **Hardware/Browser:** Desktop screen (resolution $\ge 1280 \times 800$), latest Chromium-based browser or Firefox.
- **Recording:** Continuous screen recording with microphone audio capturing think-aloud verbalization.
- **Baseline Prompt:** The participant is given only the task prompts verbatim from `docs/UX_TASKS.md`.
- **Facilitator Rule:** The facilitator must NOT offer hints, guidance, or leading questions. If the participant is stuck for $\ge 3$ minutes, record the blocker as an error and ask: *"What are you looking for right now?"*

---

## 3. The 6 Evaluation Tasks (from `docs/UX_TASKS.md`)

| Task # | Name | Starting State | Goal / Done Condition | Max Time |
|---|---|---|---|---|
| **T1** | Reference Department Load | Start Screen | Open Reference Dept, verify studio canvas renders with nodes | 90s |
| **T2** | Deploy & Wire Drafter Node | Empty Canvas | Drag Drafter from Dock, attempt external cable (must see `POL_DRF_HARD_01` rejection) | 120s |
| **T3** | Keyboard-Only Navigation | Canvas with nodes | Open palette via Ctrl+K, select node, navigate ports via Tab/Arrows | 120s |
| **T4** | Inspector Config Edit | Selected Node | Double click node, edit port policy or budget in inspector drawer | 90s |
| **T5** | Export Verification Bundle | Valid Topology | Open Export modal, verify gate checklist, download valid `.zip` bundle | 90s |
| **T6** | Undo/Redo & Deletion Recovery | Wired Nodes | Delete a node/cable, undo via Ctrl+Z, verify wiring restoration | 60s |

*Optional Accessibility Task: One screen-reader pass (NVDA on Windows or Orca on Linux) through Task T2.*

---

## 4. Data Collection per Task
For every task and participant, record in `docs/usability/raw/P<ID>_session.md`:
1. **Task Outcome:** Success / Failure / Assisted.
2. **Time on Task:** Seconds from prompt reading to completion.
3. **Misclicks / Errors:** Count and description of wrong clicks or dead ends.
4. **Verbatim Quotes:** Timestamped quotes of frustration, confusion, or satisfaction.

---

## 5. Post-Study System Usability Scale (SUS)
Each participant completes the standard 10-item SUS questionnaire (1 = Strongly Disagree, 5 = Strongly Agree):
1. I think that I would like to use this system frequently.
2. I found the system unnecessarily complex.
3. I thought the system was easy to use.
4. I think that I would need the support of a technical person to be able to use this system.
5. I found the various functions in this system were well integrated.
6. I thought there was too much inconsistency in this system.
7. I would imagine that most people would learn to use this system very quickly.
8. I found the system very cumbersome to use.
9. I felt very confident using the system.
10. I needed to learn a lot of things before I could get going with this system.

---

## 6. Synthesis & Automated Aggregation
Run:
```bash
node scripts/usability-summary.mjs
```
The script parses all completed session files in `docs/usability/raw/`, calculates median completion times, overall success rates, and the composite SUS score.
