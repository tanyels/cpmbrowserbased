# CPM KPI Review Tool – Strategy-to-KPI Cascade
## Product Requirements Document (PRD v2)

---

## 1. Purpose & Vision

The CPM KPI Review Tool v2 extends the original KPI rationalization tool into a **strategy-to-execution structuring platform**.

The primary objective is to enable organizations to **design, structure, and cascade strategy into measurable KPIs** across three levels, while remaining:
- Excel-backed
- Workshop-friendly
- Calculation-free
- Governance-light

This version introduces **Vision, Mission, Strategic Pillars, multi-level Objectives (L1–L3), Business Units, and strict KPI–Objective linking**, while deliberately excluding performance roll-ups or score calculations.

---

## 2. Strategic Cascade Model

### 2.1 Hierarchy Overview

Vision (1)  
→ Mission (1)  
→ Strategic Pillars (Many)  
→ L1 Objectives (Corporate)  
→ L2 Objectives (L2 Business Unit)  
→ L3 Objectives (L3 Business Unit)  
→ KPIs

---

## 3. Core Design Principles

- No performance calculations  
- No KPI roll-ups  
- No objective scoring  
- No governance workflows  
- No validation blocking  

Weights, hierarchy, and linkages exist **for structure and future readiness only**.

---

## 4. Strategy Layer

### 4.1 Vision
- Exactly one Vision
- Editable
- Stored historically in Excel

### 4.2 Mission
- Mandatory
- Editable

### 4.3 Strategic Pillars

| Attribute | Rule |
|---------|------|
| Code | Mandatory |
| Weight | Mandatory (documentation only) |
| Editable | Yes |
| Archivable | Yes |
| Linkage | 1 Pillar → 1 L1 Objective |

---

## 5. Objectives Model

### 5.1 Objective Levels

| Level | Meaning | Owner |
|------|--------|-------|
| L1 | Strategic Objectives | Corporate |
| L2 | Objectives | L2 Business Unit |
| L3 | Objectives | L3 Business Unit |

### 5.2 Objective Rules

- Auto-generated codes (OBJ_L1_XXX, OBJ_L2_XXX, OBJ_L3_XXX)
- Yearly scope
- Exactly one parent objective (except L1)
- Editable
- Archivable (except Operational)

---

## 6. Operational Objective (Default)

### 6.1 Definition

At **each objective level (L1, L2, L3)**, the system automatically creates a default objective:

**Operational Objective**

### 6.2 Rules

- Exists at all levels
- Treated as a normal objective
- Has code and level
- Appears in all KPI objective dropdowns
- Cannot be deleted
- Cannot be archived

Acts as a permanent safe landing zone for non-strategic KPIs.

---

## 7. Business Units

### 7.1 Naming Convention

| Level | Business Unit Type |
|------|-------------------|
| L1 | Corporate |
| L2 | L2 Business Unit |
| L3 | L3 Business Unit |

- No departments or divisions
- Each node is a Business Unit
- Editable via UI and Excel

---

## 8. KPI Model

### 8.1 KPI Linking
- Every KPI must be linked to exactly one Objective (L1, L2, or L3)
- Operational Objectives satisfy this rule

### 8.2 KPI Attributes

| Attribute | Rule |
|----------|------|
| Objective | Mandatory |
| Impact Type | Direct / Indirect / Complimentary |
| Weight | Documentation only |
| Editable | Yes |
| Re-linkable | Yes |

### 8.3 Objective Retirement Impact
- Retired objectives trigger red warnings on KPIs
- User must re-link KPIs to another objective or Operational

---

## 9. UX Structure

### 9.1 Navigation
Tabbed navigation:
1. Strategy
2. L1 Objectives
3. L2 Objectives
4. L3 Objectives
5. KPIs

### 9.2 Dropdown Logic
- Dropdowns populated dynamically
- L3 KPIs show only L3 objectives + Operational

---

## 10. Excel Data Architecture (Normalized)

### 10.1 Sheets

| Sheet | Purpose |
|-------|---------|
| Vision | Vision text |
| Mission | Mission text |
| Strategic_Pillars | Pillars |
| Objectives | All objectives (with level) |
| Business_Units | L1 / L2 / L3 |
| KPIs | KPI master |
| Objective_KPI_Link | Explicit relationships |

---

## 11. Export

- Full Strategy-to-KPI export
- KPI Cards include:
  - Objective chain
  - Business Unit
  - Impact type

---

## 12. Non-Functional Constraints

- No calculations
- No roll-ups
- No validations
- No approvals
- Excel remains system of record

---

## 13. Future (Out of Scope)

- KPI roll-ups
- Objective scoring
- Strategy performance dashboards
- Governance workflows

---

## 14. Success Criteria

- Full strategy cascade modeled
- Zero orphan KPIs
- Excel-only completion possible
- Workshop-ready UX

---

End of PRD v2
