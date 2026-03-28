# Noorgate Autonomy Upgrade Framework v1.0

**Status:** Final Design Document  
**Date:** March 28, 2026  
**Author:** Brain Agent (Extended Thinking Analysis)  
**Requester:** Adam (Orchestrator)  
**Research Input:** Scout's 12+ Source Autonomy Audit (Dimensions 1-6)  
**Deployment Target:** Noorgate 7-Agent Factory (Adam, Dev, Forge, Scout, Ops, Brain, Guard, Inspector)

---

## Executive Summary

This framework solves **autonomy without chaos**. The Noorgate factory has built a 7-agent system with real product delivery (Pixel Office shipped in 5 hours), but each session reveals failure cascades: agents claiming success without proof, verification loops that confirm wrong answers, and "done" tasks that aren't actually complete.

Scout's research synthesizes 12+ authoritative sources (OpenAI, GitHub, Microsoft, VeriMAP, DeepMind, Partnership on AI) into six patterns that production systems use to prevent these failures. This document translates those patterns into Noorgate-specific rules, implementation guidelines, and enforcement mechanisms.

**Key Insight:** Autonomy isn't about making agents smarter. It's about making failure modes impossible through structure.

---

## PART 1: THE PROBLEM — What Happened in Session 10.3

### Session 10.3 Failures (Timeline)

**T1: Pixel Office Dashboard — Setup & Agent Grid (Complete but Trigger Wrong)**
- ✅ Dev built the dashboard (code committed, renders correctly)
- ✅ Inspector verified semantic + visual (passed bouncer, artifact hash valid)
- 🔴 **Post-completion hook TRIGGERED AFTER VERIFICATION**, deleting tickets from database
- 🔴 Cascade: Inspector sees empty database, marks "uncertain", blocks dispatch
- Result: T1 is done, but the system doesn't know it's done

**Root Cause Pattern:** Verification happened → then completion hook ran → hook corrupted state → downstream agents saw wrong state and made wrong decisions.

### What Broke (6 Failure Modes)

1. **Intent Misalignment (Dimension 1)**
   - Hook definition: "On completion, update ticket status"
   - Hook implementation: "Delete related records from database"
   - Both "correct" in isolation, but cascade together

2. **Verification Cascade (Dimension 4)**
   - Dev said "task done, committed code"
   - Inspector said "I verified, looks good"
   - System interpreted as: "Both agree, now trigger completion hook"
   - But hook wasn't independently verified — it inherited trust from prior verification

3. **False Success (Dimension 3)**
   - T1 shows status=DONE in one system (coordinator)
   - T1 shows status=DELETED in another system (database)
   - Which source of truth is correct? Neither agent verified this inconsistency

4. **Completeness Not Enforced (Dimension 5)**
   - "Pixel Office done" = T1 code + T2 styling + T3 deployment
   - T1 was done, T2-T3 were not
   - System didn't differentiate MUST (code working) from NICE (UI polish)
   - Reported success at 33% completion

5. **Cascading Failure (Dimension 4)**
   - Inspector trusted Dev's "code committed"
   - Orchestrator (Adam) trusted Inspector's verification
   - Hook author trusted orchestrator's dispatch trigger
   - Chain of confirmation meant no one re-checked the hook logic itself

6. **Question Not Reduced (Dimension 6)**
   - Adam had to ask: "Why is the database corrupted?"
   - Inspector had to ask: "Should I mark this uncertain or failed?"
   - Forge had to ask: "Is this a schema issue or a query error?"
   - No policy-as-code prevented these questions

### Core Realization

**The agents are smart. The architecture is loose.**

- Smart agent ≠ reliable system
- Verification by different agents ≠ independent verification
- "Status=DONE" in one database + "Status=DELETED" in another = system in invalid state

---

## PART 2: THE SOLUTION — Seven Patterns for Production Autonomy

### Pattern 1: Intent Interpretation Framework

**Goal:** Agents understand what Faizel wants vs. what he literally said.

**The Problem:**
- Natural language intent is ambiguous
- "Build a dashboard" could mean: Electron app, web app, mobile-first, real-time, static, admin-only, public
- Different agents interpret the same instruction differently
- GitHub research shows this is THE primary failure source in multi-agent systems

**The Solution: Typed Action Schemas**

Instead of: "Analyze this and help the team"  
Implement: "For this situation, MUST choose exactly one: (a) request_info, (b) assign, (c) close_duplicate, (d) no_action"

**Implementation for Noorgate:**

1. **Triage Agent (Adam's Responsibility)**
   - Every request from Faizel goes through triage FIRST
   - Triage disambiguates intent into explicit action schema
   - ActionSchema = discriminated union of valid outcomes

```typescript
// All Faizel requests resolve to ONE of these
type OwnerIntent = 
  | { type: "BUILD_PRODUCT"; scope: string; mvp_only: boolean; budget_hours: number }
  | { type: "RESEARCH_MARKET"; topic: string; questions: string[]; competitor_count: number }
  | { type: "FIX_BUG"; system: string; severity: "P0" | "P1" | "P2"; }
  | { type: "OPTIMIZE_COST"; system: string; target_reduction: number }
  | { type: "AUDIT_SYSTEM"; dimensions: string[] }
  | { type: "PAUSE_WORK"; project: string; reason: string }
  | { type: "APPROVE_DECISION"; decision_id: string; approval: "YES" | "NO" | "EDIT" }
```

2. **Every Ticket Must Have an Intent Schema**
   - Don't write: "Research halal apps"
   - Write: `{ type: "RESEARCH_MARKET", topic: "halal food apps", questions: ["top 5 competitors", "pricing models", "target demographics"], competitor_count: 10 }`
   - Agent reads schema, not natural language
   - Schema is in ticket.json, machine-readable, validated

3. **Validation at Ticket Creation**
   - Schema validation happens before ticket is created
   - Invalid schema = Telegram error: "I don't understand. Did you mean: [options]"
   - Example: Missing required field → "Please specify budget_hours (estimated hours for dev work)"

4. **Handoff Schemas Between Agents**
   - When Scout completes research, output schema validates the research meets requirements
   ```typescript
   type ResearchOutput = {
     topic: string;
     sources_count: number;
     findings: {
       question: string;
       sources: { title: string; url: string; date: string }[];
       analysis: string; // NOT a recommendation, just facts
     }[];
   }
   ```
   - Dev receives: ResearchOutput (not free-form markdown)
   - Dev can validate: "Research has all 10 required sources? Yes → proceed"

5. **Rules for Adam (Orchestrator)**
   - Always disambiguate vague requests through schema constraint, not clarifying questions
   - Example: "Build me an app" → "Did you mean: (a) web SPA, (b) CLI tool, (c) browser extension?" (schema choice, not open question)
   - Present 2-3 options, let Faizel choose, then set schema
   - Never create a ticket without an intent schema

**Validation Checklist:**
- ✅ Faizel says "Build X" → Adam creates schema-based ticket with explicit scope
- ✅ Scout receives research ticket with typed input schema (what to investigate)
- ✅ Scout delivers research in typed output schema (5 sources, comparison table, etc.)
- ✅ Dev receives build ticket with typed spec (endpoint signatures, file paths, test requirements)
- ✅ All tickets validate schema on creation and completion

**Failure Prevention:**
- Agents can't misinterpret: schema is explicit
- Handoffs are validated: can't pass invalid data downstream
- Questions are reduced: schema constraints eliminate ambiguity

---

### Pattern 2: Multi-Layer Verification Architecture

**Goal:** Verify outputs BEFORE they become inputs to the next agent.

**The Problem:**
- Single verification (Dev builds, Dev says "done") creates single point of failure
- "Second opinion" verification is often confirmatory (Agent B reads Agent A's work and becomes anchored to A's conclusion)
- Semantic failures (wrong data returned correctly) are invisible to system-level verification (HTTP 200 OK)

**The Solution: Independent Verification at Each Stage**

**Three Verification Layers:**

**Layer 1: Self-Verification (Agent's Own Work)**
- Agent completes task
- Agent MUST verify own work before reporting completion
- Agent cannot claim success without proof
- Proof = artifacts (commits, screenshots, test output)

Example (Dev builds API):
```
Dev creates: POST /api/orders, returns { order_id, status, items }
Dev verifies BEFORE reporting:
  1. Start server: bun start
  2. Test empty request: POST /api/orders { } → 400 (bad request) ✓
  3. Test valid request: POST /api/orders { items: [...] } → 200 { order_id: 1, status: "pending", items: [...] } ✓
  4. Check code: artifact hashes match, no uncommitted changes ✓
  5. Commit hash: abc123def456
THEN: Report completion with proof = commit hash + test output
```

**Layer 2: Cross-Agent Verification (Independent Re-Analysis)**
- Inspector (quality gate agent) independently verifies outputs
- Inspector does NOT read how Dev verified
- Inspector re-does verification using different method
- Inspector compares results: do they align?

Example (Inspector verifies API):
```
Dev reported: API works, test output green ✓
Inspector re-checks (independent method):
  1. Start server: bun start
  2. Load test (10 concurrent requests): measure latency, error rate
  3. Visual check: browse http://localhost:3000/docs → Swagger renders ✓
  4. Semantic check: Does response structure match spec? Yes ✓
  5. Edge case: Empty items array → Still valid? Yes ✓
Result: PASS (8.5/10) — semantic matches spec, latency <50ms
```

**Layer 3: Semantic Verification (Not Just System-Level)**
- Does output create the intended value?
- Example: "Customer got an answer" (200 OK) but "answer was fabricated" (semantic fail)

Example:
```
Support agent retrieves article, summarizes, delivers to customer.
System check: HTTP 200 ✓
Semantic check: 
  - Summary matches article? Yes ✓
  - Summary accurate? Yes ✓
  - No hallucinations? Yes ✓
  - Customer satisfaction likely? Yes ✓
PASS
```

**Implementation for Noorgate:**

1. **Self-Verification Protocol (Required for All Agents)**
   
   All agents include self-verification in SOUL.md:
   ```
   BEFORE reporting completion:
   1. Test your own work using [specific method from domain]
   2. Verify: [explicit checklist for your domain]
   3. Artifacts: [what proof you must include]
   4. Report: [include proof in ticket.complete()]
   ```

2. **Inspector Agent (Independent Verification)**
   - Inspector is separate agent from builders
   - Runs AFTER ticket completion
   - Inspector uses different verification method than builder
   - Inspector reports: PASS/FAIL/UNCERTAIN with confidence score
   - PASS ≥8: auto-dispatch to next ticket
   - UNCERTAIN 5-7.9: retry once, then escalate
   - FAIL <5: return to builder with feedback
   
3. **Verification Checklist (Machine-Readable)**
   - Each domain has explicit checklist
   - Inspector marks off each item
   - No "looks good to me" — explicit criteria

   **For Dev (Code):**
   ```
   - Tests pass? (specific test file path)
   - Commit created? (hash verified)
   - No console.error logs? (checked)
   - Spec matches implementation? (checked)
   - Performance acceptable? (< 50ms measured)
   - No security issues? (checked)
   ```

   **For Scout (Research):**
   ```
   - All required sources included? (count: ___ of ___)
   - Sources are authoritative? (checked)
   - Findings supported by sources? (spot check: ___ findings verified)
   - No recommendations mixed in? (text checked, facts-only)
   - Output format correct? (markdown table present)
   - Saved to correct path? (path verified)
   ```

4. **Semantic Failure Detection (Real-Time)**
   - Not just "did it run" but "does it work correctly"
   - Example: API returns data, but data is stale (>1h old)
   - Example: Recommendation made, but contradicts earlier analysis
   - Inspector checks: factual consistency, output quality, alignment with spec

5. **Verification Timing**
   - Verification happens AFTER work is complete, BEFORE dispatch to next agent
   - Chain: Dev finishes → Developer verification hook → Inspector verification → dispatch or return
   - Never dispatch uncertain work

**Validation Checklist:**
- ✅ Dev verifies own work before reporting (proof included)
- ✅ Inspector independently verifies using different method
- ✅ Inspector marks verification checklist (machine-readable)
- ✅ Semantic issues detected (not just system-level)
- ✅ PASS ≥8, UNCERTAIN 5-7.9, FAIL <5 → explicit confidence

**Failure Prevention:**
- Work is tested before dispatch (not after): catches bugs early
- Verification is independent: prevents confirmatory bias
- Semantic failures detected: prevents "silent success" (wrong data delivered correctly)
- Early detection: failures don't propagate

---

### Pattern 3: False Success Prevention

**Goal:** Agents can't claim success without real proof. Verification prevents lying.

**The Problem:**
- Agent reports "task complete"
- System assumes it's true because agent is smart
- Downstream agent builds on wrong output
- Cascade begins

**The Solution: Intervention-Based Failure Attribution**

**Instead of guessing "which agent caused the failure", actually test the fix.**

Example Scenario:
```
Task: Build user profile page
Dev built 5 components: Header, Sidebar, Form, Button, Footer
Page doesn't render. Who's responsible?

WRONG approach: "Button component has a bug" (guessed wrong → cascade continues)
RIGHT approach: 
  1. Edit Button to remove export (disable it)
  2. Re-render page: does it work? No → Button isn't the culprit
  3. Edit Form to add error boundary
  4. Re-render: does it work? Yes → Form was the culprit
  5. Fix Form, re-test: page renders ✓
```

**Implementation for Noorgate:**

1. **Proof Requirements (No Claim Without Evidence)**
   
   Dev can't report: "API works"  
   Dev MUST report: "API works (commit xyz, tests pass: test-output.txt)"
   
   Scout can't report: "Found 10 competitors"  
   Scout MUST report: "Found 10 competitors (sources: [10 URLs], summary in competitors.md)"
   
   Forge can't report: "Database schema updated"  
   Forge MUST report: "Database schema updated (migration: 001_add_users.sql, tested: schema.test.ts pass)"

2. **Artifact Hashing (Detect Tampering)**
   - Every artifact (commit, file, screenshot) has cryptographic hash
   - Hash stored in ticket completion record
   - If artifact is modified later, hash mismatch detected
   - Example: Dev claims "tests pass" with hash abc123
   - Later: tests are edited, but hash is still abc123
   - System detects mismatch → escalates

3. **Intervention-Based Debugging (When Failure Occurs)**
   
   Process:
   1. Identify suspicious agent A
   2. Fix Agent A's output (edit the output to correct value)
   3. Re-run downstream agents with corrected input
   4. Did task succeed? Then A caused failure
   5. If task still fails? Then A was symptom, not root cause

   Example:
   ```
   Task: Generate recommendation
   Output: "Build a halal app, market size £2M"
   
   Fails integration test: output contradicts earlier analysis
   
   Test 1: Edit recommendation to say "Build a different app"
   Re-run validation: still contradicts analysis
   Verdict: Recommendation generation is correct, issue is upstream
   
   Test 2: Edit earlier analysis to match recommendation
   Re-run validation: passes
   Verdict: Analysis is the culprit, not recommendation
   ```

4. **Confidence Scoring (Measure Certainty)**
   
   Inspector doesn't just say "PASS" or "FAIL"
   Inspector says: "PASS (8.7/10)" — what does 8.7 mean?
   
   - 9-10: Verified in multiple ways, high confidence
   - 7-8.9: Verified but edge cases remain
   - 5-6.9: Verified but uncertain (semantically questionable)
   - <5: Failed verification

   Example:
   ```
   Dev: "API endpoint works"
   Inspector verification:
     - Returns 200 OK? ✓ (1 point)
     - Matches spec signature? ✓ (1 point)
     - Tests pass? ✓ (1 point)
     - Latency <50ms? ✓ (1 point)
     - Error handling correct? ✓ (1 point)
     - Concurrent requests handled? ~ (0.7 points) — some slowdown at 100 req/s
     - Real-world usage tested? ✗ (0 points)
   
   Total: 5.7 + 2 = 7.7/10 (UNCERTAIN) → retry with load testing
   ```

5. **Double-Blind Verification (When Critical)**
   
   For critical tasks (production deployment, paid API integration):
   - Verify 1: Inspector checks Dev's work
   - Verify 2: Different inspector (or manual review) checks independently
   - Only proceed if both agree

**Validation Checklist:**
- ✅ All completion claims include proof (commits, test output, artifacts)
- ✅ Artifacts are hashed (detect tampering)
- ✅ Confidence scored explicitly (not binary pass/fail)
- ✅ Verification is independent (different method from builder)
- ✅ When failures occur, intervention-based debugging (test fixes, don't guess)

**Failure Prevention:**
- Work is proven, not claimed: prevents lying
- Artifacts are hashed: prevents undetected changes
- Confidence scored: allows "uncertain" status (not forced binary)
- Intervention-based: finds real root causes

---

### Pattern 4: Anti-Cascade Architecture

**Goal:** Prevent "Agent A claims done → Agent B confirms → Agent C reports as final" cascades.

**The Problem (Three Stages of Cascading Failure):**

**Stage 1: Initial Compromise**
- Agent A produces incorrect output
- A verifies its own work (but makes same error twice)
- Output marked DONE

**Stage 2: Trust Propagation**
- Agent B receives output from A
- B assumes A's output is correct (authority bias)
- B builds on A's output
- B's work is now corrupted (garbage in, garbage out)

**Stage 3: Invisible Failure**
- Agent C consumes B's output
- C also assumes B verified everything
- C reports final answer as authoritative
- Stack of wrong conclusions now looks legitimate

**Result:** Each agent individually successful, system collectively wrong.

**The Solution: Break Confirmation Chains**

**Rule 1: Verification Must Be Independent**

NOT: Agent B verifies by reading Agent A's work and conclusion  
YES: Agent B re-analyzes same source data independently, doesn't read A's conclusion

Example:
```
Task: Evaluate market opportunity for halal app

WRONG pattern:
  - Scout: "10 competitors, market is saturated, recommendation: no-go"
  - Brain reads Scout's recommendation, checks if it's well-reasoned
  - Brain confirms: "Yes, well-reasoned, I agree"
  - Decision: No-go

WRONG BECAUSE: Brain didn't independently analyze the market, just confirmed Scout's reasoning

RIGHT pattern:
  - Scout: "10 competitors, market data is [sources]" (NO recommendation)
  - Brain independently analyzes same market data (hidden Scout conclusion from Brain)
  - Brain: "I see 3 competitors with real traction, market size £5M, recommendation: pivot positioning"
  - Compare: Scout says no-go, Brain says pivot
  - Disagreement triggers escalation (don't just pick Brain's answer)
```

**Rule 2: Confidence Cascades Must Decay**

Each stage of verification adds to confidence, BUT if downstream agent contradicts, confidence drops sharply.

```
Confidence tracking:
  Stage 1 (Dev completes): confidence = 7/10 (developer self-check)
  Stage 2 (Inspector agrees): confidence = 8.5/10 (independent verification increases it)
  Stage 3 (Downstream agent contradicts): confidence = 2/10 (sharp drop, escalate)

Decision rule:
  - If confidence increases through chain: proceed
  - If confidence drops at any stage: escalate, don't proceed
  - If drop is sharp (7 → 2): critical escalation (red flag)
```

**Rule 3: Break Chains at Disagreement**

Never proceed when verifiers disagree.

```
Conflict resolution:
  - Dev: "API passes all tests" (8/10 confidence)
  - Inspector: "API has race condition under load" (contradicts Dev)
  - System: STOP, don't dispatch
  - Action: Return to Dev with feedback, don't let Inspector "win" and proceed

Why?
  - If Inspector is right: Dev needs to fix
  - If Dev is right: Inspector is missing something
  - Either way: proceeding means spreading wrong answer downstream
```

**Rule 4: Real-Time Confidence Monitoring**

Every agent has confidence score. System watches for rapid decay.

```
Monitor:
  - Dev confidence: 8/10 → 7/10 → 6/10 (declining)
  - When hits <5/10: automatic escalation
  - Don't wait for task to finish: escalate mid-task

Detection:
  - Confidence score updated on each verification step
  - Threshold: -2 points per step = automatic pause
  - Slack message: "Dev task decreasing in confidence, manual review needed"
```

**Implementation for Noorgate:**

1. **Independent Verification Agents (Different Methods)**
   
   When Inspector verifies Dev's code:
   - Inspector does NOT read: "Dev tested with test-file-X"
   - Inspector does: load test with independent suite
   - If results match: confidence goes up
   - If results conflict: confidence drops → escalate

2. **Explicit Confidence Scoring in Ticket System**
   
   Every ticket tracked with confidence:
   ```
   ticket {
     id: "t1",
     title: "Build API",
     status: "DONE",
     verification: {
       dev_confidence: 8,
       inspector_confidence: 7.5,
       confidence_delta: -0.5 (negative is concerning),
       agreement: true (both within 1 point)
     }
   }
   ```

3. **Cascading Failure Detection Alert**
   
   System monitors for rapid confidence decay:
   ```
   Alert triggers if:
   - Confidence drops >2 points between stages, OR
   - Two verifiers disagree >1.5 points, OR
   - Any agent goes <5/10 confidence
   
   Action on alert:
   - Pause auto-dispatch (don't proceed downstream)
   - Notify Adam: "Confidence alert on ticket T1"
   - Return to builder for manual review
   ```

4. **Automatic Rollback on Disagreement**
   
   If verification stages contradict:
   ```
   Dev says: "Feature works"
   Inspector says: "Feature has bug"
   System: Rollback to pre-Dev state
   Action: Return ticket to Dev with Inspector feedback
   Don't: Accept Dev's claim despite Inspector's contradiction
   ```

5. **Post-Verification Hook Order (Critical)**
   
   Order matters:
   ```
   1. Dev completes task
   2. Dev self-verification (confidence: initial score)
   3. Inspector re-verifies independently (confidence: updated)
   4. Compare scores: agreement? disagreement? conflict?
   5. IF conflict: escalate (never dispatch conflicting work)
   6. IF agreement: dispatch to next agent
   7. NEVER: dispatch before both stages complete
   ```

**Validation Checklist:**
- ✅ Verification is independent (different method from Dev)
- ✅ Confidence scored at each stage (quantified, not binary)
- ✅ Disagreement triggers escalation (never silenced)
- ✅ Rapid confidence decay detected (automatic alert)
- ✅ Cascading failures prevented (chain broken at conflict)

**Failure Prevention:**
- Confirmation bias eliminated: verifiers use different methods
- Cascades detected early: confidence monitoring triggers alert before cascade propagates
- Disagreement escalates: never proceeds on conflict
- Transparent confidence: full chain visible (Dev 7 + Inspector 8.5 = proceed, not just "looks good")

---

### Pattern 5: Completeness Enforcement

**Goal:** Define "done" clearly. 7/8 tasks done = FAIL, not success.

**The Problem:**
- What does "task complete" mean?
- "Pixel Office dashboard built" = includes styling? deployment? real data?
- "7 features built, 1 missing" — is that success?
- "Agent A did its job, Agent B didn't" — report success or failure?

**The Solution: Requirement Graphs**

**Instead of:** "Build the app"  
**Implement:** Clear distinction between MUST (required) and NICE (optional) requirements

**Implementation for Noorgate:**

1. **Requirement Graph (Machine-Readable)**
   
   Every ticket has explicit requirements:
   ```
   ticket "Build user profile page":
     requirements:
       - (MUST) name field renders
       - (MUST) avatar uploads
       - (MUST) save button works
       - (MUST) validation on form (email format)
       - (NICE) dark mode styling
       - (NICE) loading spinner animation
       - (NICE) undo button
   
   completion rule:
     - ALL MUST met = SUCCESS (even if some NICE missing)
     - ANY MUST missing = FAILURE (even if all NICE met)
   ```

2. **Multi-Level Evaluation**
   
   Verify completeness at every level:
   ```
   Level 1: Token-level
     - Did agent use right tools/APIs?
   Level 2: Step-level
     - Did each step move toward goal?
   Level 3: Task-level
     - Does output solve the immediate task?
   Level 4: Business-level
     - Does output create value for Faizel?
   
   All four levels must pass:
     - L1 pass, L2 fail = incomplete (stop)
     - L1+L2 pass, L3 fail = incomplete (stop)
     - L1+L2+L3 pass, L4 fail = incomplete (incomplete value creation)
   ```

   Example (Scout research task):
   ```
   Level 1: Did Scout use search engines and databases? Yes ✓
   Level 2: Did Scout find 10 competitors? Yes ✓
   Level 3: Does research answer "who are the top competitors"? Yes ✓
   Level 4: Does this research enable decision-making? 
     - Is pricing info included? Yes ✓
     - Are feature comparisons included? Yes ✓
     - Can Faizel decide "build or not" from this research? Yes ✓
   
   Result: COMPLETE (all 4 levels)
   ```

3. **State Consistency Verification**
   
   Before declaring task complete, verify ALL agents see same state:
   ```
   Dev says: "Code committed abc123, tests pass"
   Database says: "Ticket status = DONE"
   Git says: "Commit abc123 exists, tests pass"
   Inspector says: "Verified, confidence 8.5"
   
   All agree? YES → COMPLETE
   Any disagree? NO → INCOMPLETE (investigate)
   ```

4. **Explicit Completion Criteria per Domain**
   
   **For Dev Tickets:**
   ```
   MUST:
     - Code committed (hash in ticket)
     - Tests pass (test output in ticket)
     - Spec implemented (functionality working)
   NICE:
     - 100% test coverage
     - Performance benchmarked
     - Documentation complete
   
   Completion rule:
     - All MUST: report done
     - Missing any MUST: report not done (test output required even if 1 test fails)
   ```

   **For Scout Tickets:**
   ```
   MUST:
     - All required questions answered
     - Minimum source count met
     - Saved to correct path
     - NO recommendations (facts-only)
   NICE:
     - Competitor pricing included
     - Market size data included
     - Trend analysis included
   
   Completion rule:
     - All MUST: report done
     - Missing any MUST: report not done
   ```

   **For Forge Tickets:**
   ```
   MUST:
     - Schema migrations committed
     - Database tested (migration up/down)
     - Rollback procedure documented
   NICE:
     - Performance benchmarked
     - Backup verified
     - Documentation updated
   
   Completion rule:
     - All MUST: report done
   ```

5. **Grouped Task Validation (All-or-Nothing)**
   
   For multi-part projects (e.g., Pixel Office = T1 + T2 + T3):
   ```
   Project: "Pixel Office Dashboard"
   Subtasks:
     - T1: Setup & grid (Dev)
     - T2: Styling & animations (Dev)
     - T3: Real-time status feed (Dev)
   
   Definition of project "complete":
     - T1 MUST = done
     - T2 MUST = done
     - T3 MUST = done
     - If T1 done, T2 done, T3 incomplete = project INCOMPLETE (not 66% success)
   
   Report: "Pixel Office 66% complete, blocking on T3"
   Not: "Two of three components shipped, partial success"
   ```

**Validation Checklist:**
- ✅ Requirements graph defined (MUST vs NICE)
- ✅ Multi-level evaluation (token, step, task, business)
- ✅ State consistency verified (all systems agree)
- ✅ Explicit completion criteria per domain
- ✅ Grouped tasks validate all-or-nothing (not partial success)

**Failure Prevention:**
- "Done" is unambiguous: explicitly defined
- Partial success prevented: 7/8 = fail, not success
- Business value verified: level 4 prevents "correct but useless" outputs
- All systems agree: no hidden contradictions

---

### Pattern 6: Question Reduction Protocol

**Goal:** Minimize "should I do X?" escalations through policy-as-code.

**The Problem:**
- Agents ask permission for every decision
- "Should I deploy to production?"
- "Should I send this notification?"
- "Should I delete old data?"
- These questions add 5+ minutes of latency each

**The Solution: Policy-as-Code Guardrails**

**Instead of:** Agents asking permission  
**Implement:** Agents following explicit policy, no questions needed

**Implementation for Noorgate:**

1. **Policy-as-Code Guardrails (Versioned, Auditable)**
   
   All policies defined in code, not natural language:
   ```typescript
   // policies/noorgate-actions.ts
   
   const ActionPolicy = {
     // Production safety
     deploy_to_production: {
       allowed: ["Dev", "Ops"],
       requires_tests_pass: true,
       requires_approval: "Faizel", // or "none"
       requires_staging_validation: true,
     },
     
     // Data deletion
     delete_old_data: {
       allowed: ["Forge", "Guard"],
       retention_days: 90,
       requires_backup_verified: true,
       requires_approval: "none", // automated
     },
     
     // Email sending
     send_email: {
       allowed: ["Ops"],
       max_recipients_per_minute: 10,
       requires_template_approval: true,
       requires_approval: "none", // template pre-approved
     },
     
     // API key rotation
     rotate_api_keys: {
       allowed: ["Ops", "Guard"],
       requires_backup_keys: true,
       requires_approval: "none", // safety check replaces approval
     },
   }
   ```

2. **Triage Agent at Entry Point**
   
   Adam (orchestrator) acts as triage:
   - Receives request from Faizel
   - Routes to specialist agent (Dev, Scout, Ops, etc.)
   - Specialist checks policy
   - If policy allows: proceed
   - If policy denies: return error (no approval needed)
   - If policy requires approval: ask Faizel once, not agent asking agent

   ```
   Faizel: "Deploy to production"
   Adam: Check policy → requires_approval: "Faizel"
   Adam: Ask Faizel: "Deploy to production? Yes/No"
   Faizel: YES
   Adam: Create deployment ticket for Ops with approval recorded
   Ops: Execute (no asking, policy approved)
   ```

3. **Explicit Action Schemas (No Ambiguity)**
   
   Every action must resolve to explicit schema:
   ```
   type ActionsAllowed =
     | { action: "DEPLOY"; env: "staging" | "production"; version: string }
     | { action: "SEND_EMAIL"; template: string; recipients: number }
     | { action: "DELETE_DATA"; table: string; older_than_days: number }
     | { action: "CREATE_BACKUP"; system: string }
     | { action: "ESCALATE"; reason: string; to: "Brain" | "Faizel" }
   ```
   
   Agent can't say "maybe I'll deploy, maybe not". Agent must choose exactly one action schema.

4. **Handoff Protocols (Validated Automatically)**
   
   When work passes between agents, schema validates:
   ```
   Scout → Dev handoff:
   Input schema: ResearchOutput { findings: [...], sources: number }
   Dev validates:
     - Research has all required findings? Check
     - Research has minimum sources? Check
     - Can Dev now build from this? Check
   Proceed or request more research
   
   Never: Dev ask "should I build?" — research validates itself
   ```

5. **Decision Boundaries (Clear Domains)**
   
   Each agent owns specific decisions (no cross-domain questions):
   
   **Adam (Orchestrator):**
   - Which project to work on
   - Which agent to dispatch to
   - Whether to escalate to Brain
   
   **Dev:**
   - How to implement (code structure, algorithms)
   - What tests to write
   - No decision: "should we build this?" (Adam decides)
   
   **Scout:**
   - What sources to include
   - How to structure findings
   - No decision: "should we enter this market?" (Brain decides)
   
   **Brain:**
   - Strategic decisions (build/no-build, pivot, pricing)
   - Architecture recommendations
   - No decision: "how to implement?" (Dev decides)

6. **Dead Man's Switch Pattern (Detect Missing Decisions)**
   
   If agent should make decision but doesn't:
   ```
   Expected: "Should I deploy?" decision within 30 minutes
   Actual: 45 minutes pass, no decision
   System: Escalate to Faizel: "Deploy decision needed for ticket T5"
   
   Prevents: Agents stuck asking for permission, blocking downstream work
   ```

**Implementation in SOUL.md for Each Agent:**

Update each agent's SOUL.md with explicit guardrails:

```
# Scout SOUL.md
## Decision Authority
- Can: Choose research sources, structure findings, save to KB
- Cannot: Make "build/don't build" recommendations (Brian or Adam decides)
- Default: If unsure, save raw findings, let Brian synthesize

## Questions You Can Answer Alone (No Escalation)
- Q: How many sources do I need? A: Check ticket requirements field
- Q: Should I investigate X? A: Check research scope in ticket
- Q: Is this finding reliable? A: Verify source, document quality

## Questions Requiring Escalation
- Q: Should we act on this finding? → Escalate to Brain
- Q: Is this market worth entering? → Escalate to Brain
- Q: Should I recommend X? → DO NOT recommend, return facts only
```

**Validation Checklist:**
- ✅ Policies defined in code (versioned, auditable)
- ✅ No ambiguous guardrails (explicit allow/deny)
- ✅ Triage agent at entry (route once, not ask agent to route)
- ✅ Action schemas explicit (discriminated unions, not choices)
- ✅ Handoff protocols validated (automatic schema check)
- ✅ Decision boundaries clear (each agent owns specific domain)
- ✅ Dead man's switch active (escalate if decision missing)

**Failure Prevention:**
- Questions eliminated: policy answers them
- Ambiguity removed: explicit schemas
- Latency reduced: no approval back-and-forth (decided once)
- Scope creep prevented: clear boundaries

---

### Pattern 7: Self-Check & Independent Verification Protocol

**Goal:** Agents verify their own work before reporting. No reporting without proof.

**The Problem:**
- Agent reports "done" without testing
- Downstream agent trusts report
- Cascade begins
- By the time failure is discovered, multiple agents have built on wrong foundation

**The Solution: Required Proof Before Reporting**

**Implementation for Noorgate:**

1. **Self-Verification Mandatory (Part of Ticket Completion)**
   
   Every SOUL.md includes self-verification checklist:
   
   **Dev SOUL.md:**
   ```
   ## Before Reporting Completion
   
   MUST verify:
   1. Start server: `bun start` ← is it running?
   2. Test endpoint: `curl http://localhost:3000/health` ← 200 OK?
   3. Run tests: `bun test` ← all pass?
   4. Check code: `git status` ← no uncommitted changes?
   5. Commit created: `git log --oneline | head` ← latest commit hash visible?
   6. Build artifact exists: `ls dist/` ← files present?
   
   PROOF TO INCLUDE in ticket.complete():
   - Commit hash (from step 5)
   - Test output (from step 3)
   - Screenshot of endpoint (from step 2)
   - Artifact list (from step 6)
   
   Cannot report done without ALL proof.
   ```
   
   **Scout SOUL.md:**
   ```
   ## Before Reporting Completion
   
   MUST verify:
   1. All questions answered? ← check ticket requirements
   2. Minimum sources included? ← count: ___ of ___ required
   3. Sources verified reliable? ← spot check 3 sources
   4. Output saved to path? ← `ls workspace-scout/projects/X/`
   5. No recommendations included? ← grep "recommend\|should\|suggest" ← 0 matches
   
   PROOF TO INCLUDE:
   - Source list with dates
   - File path and size
   - Finding count vs questions asked
   
   Cannot report done without verifying all steps.
   ```

2. **Artifacts & Hashing (Cryptographic Proof)**
   
   Every artifact stored with hash:
   ```
   ticket.complete({
     summary: "API built and tested",
     artifacts: {
       commits: ["abc123def456"],
       test_output: "test-results.json",
       screenshots: ["endpoint-response.png"],
       files: ["src/api/users.ts"],
     },
     artifact_hashes: {
       "abc123def456": "sha256:xyz...",
       "test-results.json": "sha256:uvw...",
       "endpoint-response.png": "sha256:rst...",
       "src/api/users.ts": "sha256:pqr...",
     }
   })
   ```
   
   Hash allows detecting tampering:
   - If commit abc123 is modified later, hash will differ
   - System detects inconsistency → alert

3. **Verification Gate (Independent Check)**
   
   After self-verification, Inspector checks:
   ```
   Step 1: Dev completes task, includes proof
   Step 2: Inspector independently verifies (doesn't read Dev's proof)
     - Inspector starts server
     - Inspector tests endpoint
     - Inspector checks code
   Step 3: Compare Dev's proof vs Inspector's verification
     - Do they match? → PASS
     - Discrepancies? → UNCERTAIN or FAIL
   Step 4: Inspector reports confidence score
   ```

4. **No Reporting Until Proof Exists**
   
   Rule: Cannot call `ticket.complete()` without proof array
   
   ```typescript
   // WRONG: This will fail validation
   ticket.complete({
     summary: "Built the API",
     artifacts: [] // Empty!
   })
   
   // RIGHT: Includes all required proof
   ticket.complete({
     summary: "Built the API",
     artifacts: {
       commits: ["abc123"],
       test_output: "test-output.txt",
       screenshots: ["server-running.png"],
     }
   })
   ```

5. **Test-Before-Claiming Pattern (Intervention-Based Proof)**
   
   Don't just verify in your head. Actually run it.
   
   ```
   Dev (before reporting done):
   
   1. Kill previous process: `pkill -f 'node index.js'`
   2. Start fresh: `bun start`
   3. Wait 2 seconds
   4. Test request: `curl -X POST http://localhost:3000/api/orders -d '...'`
   5. Capture response: save to response.json
   6. Verify response matches spec: check response.json has required fields
   7. Include response.json in artifacts
   8. THEN report: ticket.complete({ artifacts: { response_json: "response.json" } })
   
   Don't: Run tests once yesterday, report today (yesterday's tests might not be valid now)
   Don't: Assume tests pass without running (tests might be stale)
   Always: Run tests immediately before reporting, capture output
   ```

6. **Confidence Audit (Detective Work)**
   
   For critical tasks, manual audit of proof:
   ```
   Task: Scout researches market
   Scout reports: "10 competitors found"
   Proof: competitors.md (5 competitors listed)
   
   Confidence check: 5 ≠ 10
   Alert: Proof doesn't match claim
   Action: Return to Scout with feedback
   
   Scout must explain: "Found 10, but 5 meet criteria [list]"
   Or: "Admit error, actually found 5"
   ```

**Validation Checklist:**
- ✅ Self-verification checklist in SOUL.md per agent
- ✅ All agents verify own work before reporting
- ✅ Proof required (not optional) for completion
- ✅ Artifacts hashed (detect tampering)
- ✅ Independent verification gate (after self-check)
- ✅ Test-before-claiming pattern (actually run tests, not assume)
- ✅ Confidence audit (verify claims match proof)

**Failure Prevention:**
- Work is tested before dispatch: catches bugs early
- Proof is cryptographically bound: prevents undetected changes
- Claims matched to proof: prevents "claim 10, prove 5"
- Independent verification: prevents self-deception

---

## PART 3: Implementation Roadmap

### Phase 1: Foundation (This Week)

**Objective:** Wire up typed schemas and independent verification.

**Tasks:**

1. **Schema System**
   - [ ] Create `noorgate-engine/schemas/` directory with TypeScript definitions
   - [ ] Define `OwnerIntent`, `ActionSchema`, `ResearchOutput`, `DevOutput` types
   - [ ] Wire schema validation into ticket creation (reject invalid schemas)
   - [ ] Add schema field to `tickets` table schema

2. **Verification Infrastructure**
   - [ ] Update `inspector-agent` SOUL.md with verification checklist per domain
   - [ ] Create `verification-checklist.ts` with explicit criteria
   - [ ] Wire confidence scoring into completion hook
   - [ ] Add `confidence_score` field to ticket completion record

3. **Artifact Hashing**
   - [ ] Create `artifact-hasher.ts` utility (sha256 hashing)
   - [ ] Wire into `ticket.complete()` to auto-hash artifacts
   - [ ] Add artifact_hashes table to database
   - [ ] Create hash-validation tool to detect tampering

4. **Self-Verification Template**
   - [ ] Create `self-verify.md` template for each agent SOUL.md
   - [ ] Add to Dev, Scout, Forge, Ops SOUL.md files
   - [ ] Include verification checklist specific to each agent's work

### Phase 2: Governance (Week 2)

**Objective:** Implement policy-as-code and triage system.

**Tasks:**

1. **Policy-as-Code**
   - [ ] Create `policies/noorgate-guardrails.ts` with ActionPolicy
   - [ ] Define allow/deny rules for all agent actions
   - [ ] Wire policy checking into agent startup
   - [ ] Create policy validation tool

2. **Triage Agent Logic**
   - [ ] Update Adam's SOUL.md with triage checklist
   - [ ] Create schema disambiguation prompt
   - [ ] Wire intent router to explicitly ask schema clarification
   - [ ] Test with 5 example Faizel requests

3. **Handoff Validation**
   - [ ] Create handoff schema validator
   - [ ] Wire into post-completion hook
   - [ ] Prevent invalid data passing between agents
   - [ ] Log all rejected handoffs

4. **Dead Man's Switch**
   - [ ] Create watcher for stalled decisions (no action taken within threshold)
   - [ ] Wire escalation alert to Faizel
   - [ ] Set initial thresholds (30 min per decision)

### Phase 3: Verification & Completeness (Week 3)

**Objective:** Independent verification and completeness enforcement.

**Tasks:**

1. **Independent Verification Agents**
   - [ ] Separate Inspector into multiple verification roles (CodeVerifier, ResearchVerifier, etc.)
   - [ ] Each uses different verification method from builder
   - [ ] Wire to run in parallel, not sequentially
   - [ ] Compare results for disagreement detection

2. **Confidence Cascades & Rollback**
   - [ ] Add confidence decay monitoring (alert if <5/10)
   - [ ] Implement automatic rollback on disagreement >1.5 points
   - [ ] Create escalation alert for rapid confidence decay
   - [ ] Test with synthetic failure scenarios

3. **Requirement Graphs**
   - [ ] Create `requirement-graph.ts` with MUST/NICE enforcement
   - [ ] Wire into ticket completion validation
   - [ ] Prevent partial success claims (7/8 = fail)
   - [ ] Add completion report showing MUST vs NICE status

4. **Multi-Level Evaluation**
   - [ ] Define token/step/task/business level criteria per domain
   - [ ] Wire evaluation into post-completion hook
   - [ ] Require all 4 levels to pass
   - [ ] Report which level(s) failed if incomplete

### Phase 4: Testing & Hardening (Week 4)

**Objective:** Test patterns with synthetic failures, lock down system.

**Tasks:**

1. **Failure Injection Tests**
   - [ ] Create test scenarios: agent claims success with faulty work
   - [ ] Inject bugs into Dev code, verify Inspector catches them
   - [ ] Create cascading failure scenario, verify system detects and stops
   - [ ] Create confidence decay scenario, verify escalation triggers

2. **Integration Tests**
   - [ ] Full pipeline test: Faizel request → triage → Scout → Brain → Dev → Inspector → dispatch
   - [ ] Verify all schemas validated at each stage
   - [ ] Verify no agent skips self-verification
   - [ ] Verify confidence scores propagate correctly

3. **SOUL.md Update**
   - [ ] Finalize all 7 agent SOUL.md files with full governance
   - [ ] Include schema examples for each agent
   - [ ] Include self-verification checklist per agent
   - [ ] Include policy guardrails per agent
   - [ ] Test that each agent can load and understand their SOUL

4. **Documentation**
   - [ ] Create `autonomy-operations.md` (how to use the system in practice)
   - [ ] Create troubleshooting guide (what to do when verification fails)
   - [ ] Create escalation procedures (when to ask Faizel, when to auto-proceed)

---

## PART 4: Examples from Session 10.3 Failures (What This Prevents)

### Example 1: Post-Completion Hook Bug

**What Happened:**
```
Dev builds dashboard → reports DONE
Inspector verifies → reports PASS (8/10)
System triggers post-completion hook
Hook deletes tickets from database (bug in implementation)
Downstream: Database in inconsistent state
Result: T2 and T3 can't find parent task, auto-dispatch breaks
```

**How This Framework Prevents It:**

1. **Intent Interpretation (Pattern 1)**
   - Completion hook has explicit schema: `{ action: "dispatch_next_ticket", ticket_id: string }`
   - Hook validates: ticket_id exists? Yes
   - Hook executes: delete is explicit, not accidental
   - Error: "Cannot delete ticket, it's not in deleted state"

2. **Verification Architecture (Pattern 2)**
   - Hook itself needs to be independently tested before going to production
   - Create test scenario: "Mark T1 complete, verify T2 receives parent link"
   - Inspector verifies: "Hook works correctly, dispatches to T2"
   - Confidence: 9/10 (well-tested hook)

3. **False Success Prevention (Pattern 3)**
   - Hook proves success: "Created dispatch record, verify it exists: dispatch.json"
   - No "completed successfully" without proof
   - Proof: database query showing dispatch record + artifact hash

4. **Anti-Cascade (Pattern 4)**
   - T1 completion confidence: 8/10
   - T2 dispatch confidence: 8/10
   - If T2 fails to receive dispatch, confidence drops to 3/10
   - Automatic escalation: "Dispatch failed, T2 not found"
   - Never continues to T3

### Example 2: Agent Confirms Agent (Confirmatory Verification)

**What Happened:**
```
Dev: "Tests pass" (confidence 7/10)
Inspector reads Dev's test output, confirms: "Yes, tests pass" (confidence 8/10)
System thinks: confidence increased, verify must be correct
Reality: Both Dev and Inspector used same test file, same bug in both
Result: Wrong code shipped
```

**How This Framework Prevents It:**

1. **Independent Verification (Pattern 2)**
   - Inspector does NOT read Dev's test output
   - Inspector runs DIFFERENT test suite (load testing, edge cases)
   - Inspector: "Dev's tests pass, but code has race condition under load"
   - Confidence: 4/10 (major concern)

2. **Confidence Cascade (Pattern 4)**
   - Dev confidence: 7/10
   - Inspector confidence: 4/10 (disagreement >1.5 points)
   - System: Automatic rollback
   - Action: Return to Dev with specific feedback: "Race condition detected"

3. **False Success Prevention (Pattern 3)**
   - Dev must prove tests are valid (not just "tests pass")
   - Proof: run load test with 100 concurrent requests, capture latency
   - Latency <50ms? If not, tests are insufficient
   - Confidence scored on proof quality, not just "tests exist"

### Example 3: "Completeness = Any Subtask Done"

**What Happened:**
```
Pixel Office project = T1 (code) + T2 (styling) + T3 (deployment)
T1 done, T2 done, T3 blocked
System reports: "Pixel Office 66% complete, shipped to 2 agents"
Reality: Dashboard not deployable yet, no value to Faizel
```

**How This Framework Prevents It:**

1. **Requirement Graph (Pattern 5)**
   ```
   Project: Pixel Office
   MUST: T1 code working + T2 styles apply + T3 deployed to office.noorgate.co.uk
   NICE: Real-time updates, dark mode
   
   Completion rule: ALL MUST required
   
   Status: T1 done, T2 done, T3 blocked
   Report: "Pixel Office INCOMPLETE (2/3 MUST requirements met)"
   Not: "66% complete"
   ```

2. **Multi-Level Evaluation (Pattern 5)**
   - Token-level: agents used right APIs? Yes
   - Step-level: each step worked? Yes (L1, L2)
   - Task-level: all subtasks done? No (L3 missing)
   - Business-level: can Faizel use dashboard? No
   - Result: FAIL at task-level, don't report success

3. **Completeness Enforcement (Pattern 5)**
   - System prevents reporting "done" for 2/3 grouped tasks
   - Inspector marks as UNCERTAIN (5/10 confidence)
   - Escalates: "T3 required for project completion"
   - Never auto-dispatches to next project until T3 done

### Example 4: Question Cascade

**What Happened:**
```
Dev: "Should I commit my changes?"
Adam asks: "Is it ready?"
Dev: "Waiting for test results"
Adam waits
45 minutes pass
Adam checks: Dev is actually waiting for decision from someone else
Infinite loop of questions
```

**How This Framework Prevents It:**

1. **Policy-as-Code (Pattern 6)**
   ```
   DevAction: COMMIT_CODE
   Rules:
     - ALLOWED: always (if tests pass)
     - REQUIRES_APPROVAL: none
     - REQUIRES_TESTS: yes
   
   Dev doesn't ask "should I commit?"
   Dev checks: "Tests pass? Yes → commit"
   ```

2. **Triage Agent (Pattern 6)**
   - No agent asking agent
   - Adam (triage) makes decision ONCE
   - Adam creates ticket with clear instruction
   - Dev executes, no questions

3. **Dead Man's Switch (Pattern 6)**
   - Expected: Commit decision within 30 minutes
   - Actual: 45 minutes, no commit
   - System escalates to Faizel: "Commit blocked, why?"
   - Prevents: Silent waiting loops

4. **Self-Check (Pattern 7)**
   - Dev knows: "My job: write code, test it, commit it"
   - Dev doesn't ask: "Should I test?" (obvious yes)
   - Dev doesn't ask: "Should I commit?" (policy says yes if tests pass)
   - Dev just does it: test → pass → commit → report

---

## PART 5: Production Rollout Plan

### Week 1: Core Enforcement

1. Wire typed schemas into ticket creation
2. Update all agent SOUL.md with self-verification checklists
3. Activate schema validation (reject invalid schemas)
4. Test with 5 real tasks

### Week 2: Verification System

1. Wire independent verification agents
2. Implement confidence scoring
3. Add cascade detection alerts
4. Test with synthetic failure scenarios

### Week 3: Completeness & Policy

1. Implement requirement graphs
2. Wire policy-as-code guardrails
3. Add dead man's switch for stalled decisions
4. Finalize SOUL.md for all 7 agents

### Week 4: Hardening & Validation

1. Run integration tests (full pipeline)
2. Test failure injection scenarios
3. Resolve any cascading issues
4. Document operational procedures

### Go-Live Criteria

- ✅ All 7 agents have updated SOUL.md with schemas, self-verification, policies
- ✅ Schema validation rejects invalid tickets (testing: 10 valid, 10 invalid, 100% accuracy)
- ✅ Confidence scoring tracks all verifications (testing: scores flow through pipeline correctly)
- ✅ Independent verification catches injected bugs (testing: 5 injected bugs, 5 detected)
- ✅ Cascade detection alerts on disagreement (testing: 3 conflict scenarios, all escalated)
- ✅ Requirement graphs enforce completeness (testing: 7/8 = fail, 8/8 = success, no exceptions)
- ✅ Policy-as-Code prevents unauthorized actions (testing: 5 policy denials, 5 policy allows)
- ✅ Dead man's switch escalates stalled decisions (testing: 30min threshold, escalates at 31min)

---

## PART 6: Maintenance & Iteration

### Monthly Review

1. Analyze failure logs (are cascades still happening?)
2. Review confidence scores (are they calibrated correctly?)
3. Check policy gaps (are agents asking questions policy should answer?)
4. Adjust thresholds (is 30min dead man's switch too long? Too short?)

### Quarterly Audit

1. Test system with new failure modes (attack the assumptions)
2. Review SOUL.md for drift (are agents still following governance?)
3. Assess false positive rates (are we escalating too often?)
4. Calculate autonomy improvement metrics:
   - Baseline: questions-per-100-tasks (before framework)
   - Target: <10 questions-per-100-tasks (after framework)

### Escalation Thresholds (Tunable Parameters)

**Confidence Score Thresholds:**
- Below 5/10: Escalate immediately
- Drop >2 points between stages: Escalate
- Agreement gap >1.5 points: Escalate

**Dead Man's Switch:**
- Initial: 30 minutes per decision
- Adjust after 1 week if too many false positives/negatives

**Requirement Graph Enforcement:**
- Initial: ALL MUST required, NICE optional
- Consider: Allow 1 NICE to be missing if MUST are met (adjust after 1 week)

---

## PART 7: Key Metrics & Measurement

### Autonomy Metrics

1. **Questions-Per-100-Tasks**
   - Count: How many "should I do X?" questions per 100 completed tasks
   - Target: <10 (down from ~30 baseline)
   - Tracked: Logged each time agent escalates

2. **Cascade Detection Time**
   - Measure: Minutes between root error and system detection
   - Target: <5 minutes (detect before cascades propagate)
   - Tracked: Alert timestamp vs error timestamp

3. **Confidence Score Accuracy**
   - Measure: Does confidence score correlate with actual quality?
   - Method: Compare Inspector confidence (9/10) with real task outcome (worked perfectly vs failed)
   - Target: >85% correlation

4. **Schema Compliance Rate**
   - Measure: % of tickets created with valid schemas
   - Target: 100% (invalid tickets rejected)
   - Tracked: Rejected ticket count

5. **Independent Verification Catch Rate**
   - Measure: % of bugs caught by Inspector that Dev missed
   - Target: >20% (verifier finds things builder misses)
   - Tracked: Bugs found by Inspector vs Dev

6. **Completeness Enforcement**
   - Measure: % of "incomplete" projects reported as such (not false positives)
   - Target: 100% (no partial success claims)
   - Tracked: Requirements met vs reported status

---

## PART 8: Conclusion

This framework transforms the Noorgate factory from **"agents that are smart"** to **"a system where failure modes are impossible"**.

It doesn't make Claude smarter. It makes the architecture stricter.

**Key Insight:** Production autonomy isn't about AI capability. It's about eliminating ambiguity, requiring proof, and breaking confirmation chains.

The seven patterns—Intent Interpretation, Verification Architecture, False Success Prevention, Anti-Cascade, Completeness Enforcement, Question Reduction, and Self-Check—are all upstream of raw model capability. They're about **structure**.

If you implement all seven, you get:
- **No lying agents** — all claims require proof
- **No cascading failures** — breaks chain at first disagreement
- **No ambiguous "done"** — explicit requirements + multi-level evaluation
- **No question loops** — policy answers them
- **No silent failures** — semantic verification catches them

This is production-grade autonomy. It's boring. It works.

---

## APPENDIX: Quick Reference

### Patterns at a Glance

| Pattern | Problem | Solution | Prevents |
|---------|---------|----------|----------|
| **1: Intent** | "Build X" means different things to different agents | Typed action schemas | Misalignment |
| **2: Verification** | Single verification = single point of failure | Independent, multi-layer verification | Silent failures |
| **3: False Success** | Agents claim done without proof | Required artifacts + hashing | Lying |
| **4: Anti-Cascade** | A says yes → B confirms → C reports final | Break chains at disagreement | Cascading failures |
| **5: Completeness** | 7/8 tasks = success (wrong) | Requirement graphs + multi-level eval | Partial success claims |
| **6: Question Reduction** | "Should I X?" escalations | Policy-as-code guardrails | Latency & ambiguity |
| **7: Self-Check** | Reports success without testing | Required proof before reporting | Untested code shipped |

### Implementation Checklist (Phase 1)

- [ ] Create schema files (OwnerIntent, ActionSchema, ResearchOutput, etc.)
- [ ] Wire schema validation into ticket creation
- [ ] Update all SOUL.md files with self-verification checklists
- [ ] Create artifact-hasher utility
- [ ] Add confidence_score field to database
- [ ] Create verification checklist template
- [ ] Test with 5 real tasks (track any failures)
- [ ] Document schema examples for each agent

---

**Status:** Ready for production implementation  
**Next Step:** Faizel reviews, approves implementation roadmap  
**Timeline:** 4 weeks from approval to full deployment
