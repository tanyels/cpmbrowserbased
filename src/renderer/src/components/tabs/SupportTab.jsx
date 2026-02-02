import React, { useState, useCallback } from 'react';

// ─── Documentation Data ───────────────────────────────────────────────────────

const DOCUMENTATION = {
  design: [
    {
      id: 'strategy',
      title: 'Strategy',
      summary: 'Define your organization\'s vision, mission, strategic pillars, and perspectives.',
      sections: [
        {
          heading: 'What It Does',
          content: 'The Strategy tab is your starting point for building a strategy cascade. Here you define the organization\'s Vision (where you want to be) and Mission (how you plan to get there), both in English and Arabic. You also create Strategic Pillars — the core value dimensions your strategy is built around — and optionally define Perspectives from the Balanced Scorecard framework (Financial, Customer, Internal Processes, Learning & Growth).'
        },
        {
          heading: 'Key Concepts',
          content: 'Strategic Pillars are weighted themes that must sum to 100%. Each pillar acts as a container for Level 1 Strategic Objectives. Perspectives are an optional second dimension for categorizing objectives — they provide a cross-cutting view across pillars. Together, pillars and perspectives form a matrix that organizes your entire strategic framework.'
        },
        {
          heading: 'Relationships',
          content: 'Pillars flow directly into L1 Objectives — every L1 objective must belong to a pillar. Pillar weights determine how much each strategic theme contributes to overall organizational performance. Perspectives are used in the Strategy Map to create a grid layout. Changes to pillar weights ripple through the entire weight cascade down to KPI-level scoring.'
        },
        {
          heading: 'Best Practices',
          items: [
            'Keep pillars to 3–5 themes for clarity and focus.',
            'Ensure pillar weights reflect true strategic priorities, not equal distribution.',
            'Write vision and mission statements that are specific and measurable where possible.',
            'Use perspectives to ensure balanced coverage across financial and non-financial dimensions.'
          ]
        }
      ]
    },
    {
      id: 'business-units',
      title: 'Business Units',
      summary: 'Build a three-level organizational hierarchy for strategy cascading.',
      sections: [
        {
          heading: 'What It Does',
          content: 'The Business Units tab lets you model your organizational structure as a three-level hierarchy: L1 (Corporate), L2 (Divisions/Departments), and L3 (Teams/Sections). Each unit has a unique abbreviation code and can contain child units. The system automatically creates operational objectives for each business unit.'
        },
        {
          heading: 'Key Concepts',
          content: 'The hierarchy determines how strategy cascades downward. L1 is your corporate entity. L2 units represent major divisions that own L2 objectives linked to corporate L1 objectives. L3 units are teams that own L3 objectives linked to their parent L2 objectives. Each level has its own scorecard showing weighted performance.'
        },
        {
          heading: 'Relationships',
          content: 'Business Units are the organizational backbone: Objectives at L2/L3 are owned by specific BUs. Team Members belong to BUs. The Scorecard tab aggregates KPI performance by BU. The BU hierarchy determines which parent objectives a unit can cascade from.'
        },
        {
          heading: 'Best Practices',
          items: [
            'Model the hierarchy to match your actual reporting structure.',
            'Use concise, unique abbreviations (e.g., "FIN", "HR", "OPS") for clean KPI code generation.',
            'Create L3 units only when teams have distinct objectives separate from their L2 parent.',
            'Don\'t delete BUs that have objectives or team members — archive or reassign first.'
          ]
        }
      ]
    },
    {
      id: 'team-members',
      title: 'Team Members',
      summary: 'Manage employees, reporting relationships, personal objectives, and individual KPIs.',
      sections: [
        {
          heading: 'What It Does',
          content: 'The Team Members tab manages your people. Add employees with their details (ID, job title, email, photo), assign them to Business Units, and establish manager-report relationships. Each employee can have Personal Objectives (individual goals linked to BU objectives) and Employee KPIs (individual performance metrics).'
        },
        {
          heading: 'Key Concepts',
          content: 'Personal Objectives connect individual goals to the organizational strategy cascade — an employee\'s personal objective can link to a BU-level objective, ensuring alignment. Employee KPIs support both single annual targets and monthly targets with positive/negative polarity. Employee Achievements track monthly actual values against targets.'
        },
        {
          heading: 'Relationships',
          content: 'Team Members belong to Business Units. Personal Objectives optionally link to organizational Objectives for cascade alignment. Employee KPIs roll up into the Employee Scorecard. The Reports_To field creates a management hierarchy visible in the Org View.'
        },
        {
          heading: 'Best Practices',
          items: [
            'Link personal objectives to BU objectives wherever possible for cascade alignment.',
            'Use monthly targets for KPIs that have seasonal variation.',
            'Set realistic weights that sum correctly under each personal objective.',
            'Keep employee data current — archive departed employees rather than deleting them.'
          ]
        }
      ]
    },
    {
      id: 'objectives-l1',
      title: 'L1 Objectives',
      summary: 'Define corporate-level Strategic Objectives linked to pillars.',
      sections: [
        {
          heading: 'What It Does',
          content: 'L1 Objectives are your top-level Strategic Objectives (SOs) — the corporate goals that define what the organization aims to achieve. Each L1 objective belongs to a Strategic Pillar, can optionally be categorized by Perspective, and has a weight that determines its contribution to the pillar\'s score. KPIs are attached directly to L1 objectives.'
        },
        {
          heading: 'Key Concepts',
          content: 'Weight validation is critical: the sum of all L1 objective weights under a pillar must equal that pillar\'s weight. Similarly, the sum of KPI weights under an L1 objective must equal the objective\'s weight. This ensures the entire scoring system is mathematically consistent from top to bottom.'
        },
        {
          heading: 'Relationships',
          content: 'L1 Objectives sit between Pillars (parent) and L2 Objectives (children). They are the anchor point for the entire cascade. L2 BUs configure their scorecards by assigning weights to L1 objectives. The Strategy Map visualizes L1 objectives with cause-and-effect links. KPIs under L1 objectives drive corporate-level scorecard performance.'
        },
        {
          heading: 'Best Practices',
          items: [
            'Use 2–4 objectives per pillar for manageability.',
            'Write objective names as outcomes, not activities (e.g., "Increase Market Share" not "Do Marketing").',
            'Validate weight totals frequently — the system highlights imbalances.',
            'Attach at least one KPI to every objective to make it measurable.'
          ]
        }
      ]
    },
    {
      id: 'objectives-l2',
      title: 'L2 Objectives',
      summary: 'Define division-level objectives cascading from L1 Strategic Objectives.',
      sections: [
        {
          heading: 'What It Does',
          content: 'L2 Objectives belong to L2 Business Units and cascade from L1 objectives. Before creating L2 objectives, you configure the BU Scorecard — assigning weights to parent L1 objectives to define how much each corporate goal matters to this division. Then you create L2 objectives under those parent L1 objectives, with weights that sum to the assigned parent weight.'
        },
        {
          heading: 'Key Concepts',
          content: 'Scorecard Configuration is a key step: each L2 BU explicitly declares which L1 objectives it contributes to and how much weight to assign. This creates accountability — a sales division might assign 60% to "Increase Revenue" and 40% to "Improve Customer Satisfaction." The system validates that L2 objective weights under each parent sum correctly.'
        },
        {
          heading: 'Relationships',
          content: 'L2 Objectives link upward to L1 Objectives (parent) and downward to L3 Objectives (children). They are owned by L2 Business Units. KPIs under L2 objectives drive the L2 BU scorecard. The Strategy Cascade tab shows this parent-child chain visually.'
        },
        {
          heading: 'Best Practices',
          items: [
            'Initialize scorecard config before creating objectives to set weight budgets.',
            'Ensure every L2 BU has objectives under its most relevant L1 parents.',
            'Include operational objectives for day-to-day KPIs that don\'t map to strategy.',
            'Review weight allocation quarterly to reflect shifting priorities.'
          ]
        }
      ]
    },
    {
      id: 'objectives-l3',
      title: 'L3 Objectives',
      summary: 'Define team-level objectives cascading from L2 division objectives.',
      sections: [
        {
          heading: 'What It Does',
          content: 'L3 Objectives are the most granular strategic objectives, owned by L3 Business Units (teams). They cascade from L2 objectives following the same scorecard configuration and weight validation pattern as L2. This completes the strategy cascade from corporate vision down to team-level execution.'
        },
        {
          heading: 'Key Concepts',
          content: 'L3 objectives follow identical mechanics to L2: configure scorecard weights to parent L2 objectives, create objectives under those parents, attach KPIs. The three-level cascade (L1→L2→L3) ensures every team\'s work connects back to corporate strategy through a traceable chain.'
        },
        {
          heading: 'Relationships',
          content: 'L3 Objectives link to L2 Objectives (parent) and are owned by L3 Business Units. KPIs under L3 objectives feed the L3 BU scorecard. Team Members in L3 BUs can link personal objectives to L3 organizational objectives.'
        },
        {
          heading: 'Best Practices',
          items: [
            'Only create L3 objectives when teams have distinct goals from their parent L2 BU.',
            'Keep L3 objectives actionable and within the team\'s direct control.',
            'Use leading indicators at L3 level to predict L2/L1 outcomes.',
            'Review L3 objectives monthly — they should adapt faster than L1/L2.'
          ]
        }
      ]
    },
    {
      id: 'kpis',
      title: 'KPIs',
      summary: 'Centralized KPI management with approval workflows and target configuration.',
      sections: [
        {
          heading: 'What It Does',
          content: 'The KPIs tab provides a centralized view of all Key Performance Indicators across the organization. Filter by level, business unit, objective, or approval status. Each KPI has a target (single or monthly), measurement unit, polarity (positive = higher is better, negative = lower is better), weight, and approval status.'
        },
        {
          heading: 'Key Concepts',
          content: 'Impact Type classifies KPIs as Direct (primary driver) or Indirect (supporting factor). Indicator Type distinguishes Leading (predictive/forward-looking) from Lagging (historical/results-based) indicators. Approval Status tracks the KPI through a workflow: Recommended → Under Discussion → Locked. Polarity determines how achievement is calculated.'
        },
        {
          heading: 'Relationships',
          content: 'Every KPI belongs to exactly one Objective. KPI weights must sum to their parent objective\'s weight. KPIs are measured through Measures (formula builder) and their actuals flow into Scorecard calculations. The Dependency Graph shows KPIs as the critical bridge between strategy (objectives) and execution (measures).'
        },
        {
          heading: 'Best Practices',
          items: [
            'Balance leading and lagging indicators — aim for at least 30% leading indicators.',
            'Set monthly targets for KPIs with seasonal patterns.',
            'Use negative polarity correctly for cost/defect metrics where lower is better.',
            'Lock KPIs only after stakeholder alignment to prevent mid-cycle confusion.'
          ]
        }
      ]
    }
  ],
  track: [
    {
      id: 'dashboard',
      title: 'Dashboard',
      summary: 'Executive overview of strategy structure, coverage metrics, and cascade health.',
      sections: [
        {
          heading: 'What It Does',
          content: 'The Dashboard provides a read-only executive summary of your entire strategy setup. It shows key statistics (pillar count, BU count, objective count by level, team member count, KPI count), strategic pillar coverage analysis, cascade breakdown by level, and KPI approval status summary. It also highlights warnings where configuration gaps exist.'
        },
        {
          heading: 'Key Concepts',
          content: 'Pillar Coverage shows how thoroughly each pillar is implemented across L1/L2/L3 levels with KPI counts and approval breakdowns. The Cascade Breakdown table shows averages (objectives per BU, KPIs per objective) to identify over- or under-specified areas. Warnings flag missing configurations like objectives without KPIs.'
        },
        {
          heading: 'Relationships',
          content: 'The Dashboard reads from every data entity in the system — it\'s the single-pane-of-glass for strategy health. It does not modify any data. Use it to identify gaps before diving into specific tabs to fix them.'
        },
        {
          heading: 'Best Practices',
          items: [
            'Review the Dashboard weekly during strategy setup to track completeness.',
            'Address warnings promptly — an objective without KPIs is unmeasurable.',
            'Use the export function for board/executive reporting.',
            'Compare cascade breakdown averages across BUs to ensure balanced coverage.'
          ]
        }
      ]
    },
    {
      id: 'strategy-map',
      title: 'Strategy Map',
      summary: 'Visual representation of L1 objectives with cause-and-effect linking.',
      sections: [
        {
          heading: 'What It Does',
          content: 'The Strategy Map is an interactive canvas where L1 Strategic Objectives are arranged visually by Pillar (rows) and Perspective (columns). You can drag objectives to position them, draw cause-and-effect links between objectives, customize pillar colors, and create a visual story of how your strategy connects.'
        },
        {
          heading: 'Key Concepts',
          content: 'Cause-and-effect links show strategic dependencies — for example, "Invest in Employee Training" (Learning perspective) causes "Improve Process Efficiency" (Internal perspective) which causes "Increase Customer Satisfaction" (Customer perspective) which causes "Grow Revenue" (Financial perspective). These links are purely visual and don\'t affect calculations.'
        },
        {
          heading: 'Relationships',
          content: 'The Strategy Map visualizes L1 Objectives from the Objectives tab, organized by Pillars and Perspectives from the Strategy tab. Objective Links are stored separately and persist across sessions. Positions are saved automatically.'
        },
        {
          heading: 'Best Practices',
          items: [
            'Arrange objectives in a bottom-up flow: enablers at bottom, outcomes at top.',
            'Use links sparingly — show the most important cause-and-effect chains.',
            'Color-code pillars to match your organization\'s branding.',
            'Present the strategy map to stakeholders to validate strategic logic.'
          ]
        }
      ]
    },
    {
      id: 'org-view',
      title: 'Organization View',
      summary: 'Integrated view of the organizational hierarchy with objectives and KPIs per BU.',
      sections: [
        {
          heading: 'What It Does',
          content: 'The Organization View displays the complete BU hierarchy (L1→L2→L3) as an expandable tree. For each business unit, you can see its strategic objectives, operational objectives, KPIs, and team members — all in one place. This is a read-only view for understanding organizational alignment.'
        },
        {
          heading: 'Key Concepts',
          content: 'This view answers the question "What is each business unit responsible for?" It distinguishes strategic objectives (linked to pillars) from operational objectives (day-to-day activities). It shows coverage — are there BUs with no objectives? Objectives with no KPIs?'
        },
        {
          heading: 'Relationships',
          content: 'Pulls from Business Units, Objectives, KPIs, Pillars, and Team Members. It\'s a cross-cutting view that helps identify organizational gaps and ensures every BU has clear accountability.'
        },
        {
          heading: 'Best Practices',
          items: [
            'Use this view during strategy alignment workshops to validate BU assignments.',
            'Check that every BU has both strategic and operational objectives.',
            'Verify team member distribution — understaffed BUs may struggle with execution.',
            'Compare objective counts across similar-level BUs for balance.'
          ]
        }
      ]
    },
    {
      id: 'strategy-cascade',
      title: 'Strategy Cascade',
      summary: 'Hierarchical view of the complete objective cascade from pillars to KPIs.',
      sections: [
        {
          heading: 'What It Does',
          content: 'The Strategy Cascade displays the full cascading tree: Pillars → L1 Objectives → L2 Objectives (by BU) → L3 Objectives (by BU) → KPIs. Each level is expandable, showing weights, BU ownership, KPI counts, and status. This is the definitive view of how strategy flows from vision to execution.'
        },
        {
          heading: 'Key Concepts',
          content: 'The cascade is the core concept of this tool — strategy execution requires that corporate goals (L1) are broken down into divisional goals (L2) and team goals (L3), each with measurable KPIs. This tab verifies the chain is complete and weights are properly distributed.'
        },
        {
          heading: 'Relationships',
          content: 'Shows the parent-child relationships between all Pillars, Objectives (L1/L2/L3), and KPIs. It\'s the structural complement to the Strategy Map (which shows cause-and-effect) — this shows the authority/responsibility cascade.'
        },
        {
          heading: 'Best Practices',
          items: [
            'Walk through the cascade top-to-bottom to verify no broken chains.',
            'Ensure every leaf node (bottom of cascade) has KPIs attached.',
            'Use the weight display to verify mathematical consistency at each level.',
            'Review quarterly to ensure the cascade reflects organizational changes.'
          ]
        }
      ]
    }
  ],
  measure: [
    {
      id: 'measures',
      title: 'Measures',
      summary: 'Create data collection measures with formula builder for KPI calculation.',
      sections: [
        {
          heading: 'What It Does',
          content: 'The Measures tab lets you define how each KPI\'s actual value is calculated. Create a Measure linked to a KPI, then build a formula using the visual formula builder. Formulas can reference data points (manual parameters), global values (shared constants), and other measures. Supported functions include SUM, AVG, MIN, MAX, ABS, FIRST, and LAST.'
        },
        {
          heading: 'Key Concepts',
          content: 'Each Measure has Parameters — named data inputs that you populate monthly in Data Entry. The Formula combines these parameters with operators and functions to produce a calculated value. This calculated value is then compared against the KPI\'s target to compute achievement percentage. Measures are the calculation engine that turns raw data into performance metrics.'
        },
        {
          heading: 'Relationships',
          content: 'Measures link to KPIs (one measure per KPI). They reference Global Values for shared constants and can reference other Measures for derived calculations. Parameter Values are entered in the Data Entry tab. Calculated Values flow into Achievements which feed the Scorecard.'
        },
        {
          heading: 'Best Practices',
          items: [
            'Keep formulas simple — complex formulas are harder to debug and audit.',
            'Use Global Values for constants that appear in multiple measures (e.g., exchange rates, headcount).',
            'Test formulas with sample data before relying on them for reporting.',
            'Document what each parameter represents for data entry clarity.'
          ]
        }
      ]
    },
    {
      id: 'global-values',
      title: 'Global Values',
      summary: 'Manage shared constants and reference data used across measure formulas.',
      sections: [
        {
          heading: 'What It Does',
          content: 'Global Values are organization-wide constants or reference numbers that can be used in any measure formula. Examples include exchange rates, total headcount, budget allocations, or industry benchmarks. Each global value has monthly values, allowing it to change over time while maintaining a single reference point.'
        },
        {
          heading: 'Key Concepts',
          content: 'Global Values support three types: number, percentage, and currency. They provide a single source of truth — update a global value once and every formula referencing it recalculates automatically. Monthly values allow time-varying constants without duplicating parameters across measures.'
        },
        {
          heading: 'Relationships',
          content: 'Global Values are referenced by Measures through the formula builder. They appear as a special row type in the Data Entry table. Changes to global values cascade through all formulas that reference them.'
        },
        {
          heading: 'Best Practices',
          items: [
            'Use global values for any number that appears in more than one formula.',
            'Update monthly values at the start of each period for accuracy.',
            'Name global values clearly (e.g., "USD_to_EUR_Rate" not "Rate1").',
            'Keep the list manageable — archive values no longer in use.'
          ]
        }
      ]
    },
    {
      id: 'data-entry',
      title: 'Data Entry',
      summary: 'Enter monthly parameter values and view calculated achievements.',
      sections: [
        {
          heading: 'What It Does',
          content: 'Data Entry is where actual performance data flows into the system. For each measure, a table displays months as columns with rows for each parameter, global value, and related measure reference. Enter raw numbers monthly — the system automatically calculates the formula result, compares it to the KPI target, and computes achievement percentage with color-coded indicators.'
        },
        {
          heading: 'Key Concepts',
          content: 'Achievement is calculated as (Actual / Target) × 100% for positive-polarity KPIs, or (Target / Actual) × 100% for negative-polarity KPIs. Achievement is capped at the configured maximum (default 200%) to prevent overachievement from distorting weighted averages. Color thresholds (Excellent/Good/Warning/Poor) are configured in Admin settings.'
        },
        {
          heading: 'Relationships',
          content: 'Data Entry populates Parameter Values which feed into Measure calculations. Calculated Values produce Achievements which flow into the Scorecard. Global Values appear as special rows. Monthly targets from KPI configuration determine achievement percentages.'
        },
        {
          heading: 'Best Practices',
          items: [
            'Establish a monthly data entry deadline and stick to it.',
            'Verify calculated values make sense before moving to scorecard review.',
            'Use the achievement color coding as an early warning system.',
            'Enter data consistently — missing months create gaps in YTD calculations.'
          ]
        }
      ]
    },
    {
      id: 'scorecard',
      title: 'Scorecard',
      summary: 'Monitor organizational performance through weighted KPI achievement by BU.',
      sections: [
        {
          heading: 'What It Does',
          content: 'The Scorecard aggregates KPI achievements into a weighted performance score for each Business Unit. Filter by level and BU, select a month or view YTD (year-to-date average). Each KPI row shows target, actual, achievement %, weight, and weighted contribution. The BU\'s overall score is the sum of weighted achievements.'
        },
        {
          heading: 'Key Concepts',
          content: 'Weighted Achievement is the core calculation: each KPI\'s achievement is multiplied by its weight and divided by total weight to produce a proportional score. YTD shows the average of all months from January through the selected month. Achievement caps prevent any single KPI from contributing more than its fair share.'
        },
        {
          heading: 'Relationships',
          content: 'The Scorecard consumes Achievements from Data Entry, KPI configurations (weights, targets), and Objective hierarchies. It uses BU Scorecard Config to determine which parent objectives apply. Color thresholds from Admin Settings determine visual indicators.'
        },
        {
          heading: 'Best Practices',
          items: [
            'Review scorecards monthly in management meetings for accountability.',
            'Compare BU scores against each other to identify best practices and gaps.',
            'Use YTD view for strategic discussions, monthly view for operational reviews.',
            'Investigate any KPI with sudden score changes — it may indicate data quality issues.'
          ]
        }
      ]
    },
    {
      id: 'employee-scorecard',
      title: 'Employee Scorecard',
      summary: 'Track individual employee performance through personal KPIs.',
      sections: [
        {
          heading: 'What It Does',
          content: 'The Employee Scorecard mirrors the organizational scorecard at the individual level. Select an employee and month to see their Personal Objectives with associated Employee KPIs. Enter actual achievement values monthly and see weighted performance scores. This supports individual performance management and compensation decisions.'
        },
        {
          heading: 'Key Concepts',
          content: 'Employee KPIs follow the same weight-and-achievement model as organizational KPIs. Personal objectives can link to BU objectives for cascade alignment. The employee\'s overall score is a weighted average of all their KPI achievements, providing a single performance number for evaluation.'
        },
        {
          heading: 'Relationships',
          content: 'Uses Team Members from the Team Members tab, Personal Objectives and Employee KPIs defined there, and Employee Achievements entered here. Linked personal objectives connect individual performance to organizational strategy.'
        },
        {
          heading: 'Best Practices',
          items: [
            'Align employee KPIs with BU KPIs wherever possible for cascade consistency.',
            'Use monthly reviews for coaching conversations, not just year-end evaluation.',
            'Ensure weights on employee KPIs reflect actual job priorities.',
            'Keep employee scorecards confidential — share only with the employee and their manager.'
          ]
        }
      ]
    }
  ],
  settings: [
    {
      id: 'admin-center',
      title: 'Admin Center',
      summary: 'Configure achievement thresholds, colors, caps, and system settings.',
      sections: [
        {
          heading: 'What It Does',
          content: 'The Admin Center controls system-wide configuration. Set achievement thresholds that define what constitutes Excellent (default ≥100%), Good (default ≥80%), and Warning (default ≥60%) performance. Customize the colors for each achievement level. Configure the achievement cap (default 200%) that prevents overperformance from inflating scores. Set organization name and currency symbol.'
        },
        {
          heading: 'Key Concepts',
          content: 'Achievement Thresholds are the boundaries between performance levels — they affect every scorecard, data entry display, and achievement indicator in the system. The Achievement Cap limits how much a single KPI can contribute — a KPI at 300% actual is capped at 200% (or your configured cap) to prevent score inflation. These are governance parameters that should be set once and changed rarely.'
        },
        {
          heading: 'Relationships',
          content: 'Settings apply globally across all scorecards, data entry views, and achievement calculations. Color settings affect every achievement indicator in the system. The achievement cap is used in both organizational and employee scorecard calculations.'
        },
        {
          heading: 'Best Practices',
          items: [
            'Set thresholds before entering data — changing them mid-cycle alters historical views.',
            'Use an achievement cap of 120–150% for conservative organizations, 200% for aggressive targets.',
            'Choose high-contrast colors that work in both light and dark mode.',
            'Document your threshold rationale for audit and governance purposes.'
          ]
        }
      ]
    }
  ]
};

const CATEGORY_META = {
  design: { label: 'Design', description: 'Strategy definition and organizational structure' },
  track: { label: 'Track', description: 'Visualization and monitoring views' },
  measure: { label: 'Measure', description: 'Data collection, calculation, and scoring' },
  settings: { label: 'Settings', description: 'System configuration and governance' }
};

// ─── Component ────────────────────────────────────────────────────────────────

function SupportTab() {
  const [selectedCategory, setSelectedCategory] = useState('design');
  const [selectedEntryId, setSelectedEntryId] = useState('strategy');

  // ── Documentation helpers ─────────────────────────────────────────────

  const currentEntries = DOCUMENTATION[selectedCategory] || [];
  const currentEntry = currentEntries.find(e => e.id === selectedEntryId) || currentEntries[0];

  const handleCategorySelect = useCallback((cat) => {
    setSelectedCategory(cat);
    const entries = DOCUMENTATION[cat];
    if (entries && entries.length > 0) setSelectedEntryId(entries[0].id);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="support-tab">
      <div className="support-docs">
        <div className="support-docs-categories">
          {Object.entries(CATEGORY_META).map(([key, meta]) => (
            <button
              key={key}
              className={`support-cat-btn ${selectedCategory === key ? 'active' : ''}`}
              onClick={() => handleCategorySelect(key)}
            >
              <span className="support-cat-label">{meta.label}</span>
              <span className="support-cat-desc">{meta.description}</span>
            </button>
          ))}
        </div>

        <div className="support-docs-list">
          {currentEntries.map(entry => (
            <button
              key={entry.id}
              className={`support-entry-btn ${selectedEntryId === entry.id ? 'active' : ''}`}
              onClick={() => setSelectedEntryId(entry.id)}
            >
              <span className="support-entry-title">{entry.title}</span>
              <span className="support-entry-summary">{entry.summary}</span>
            </button>
          ))}
        </div>

        <div className="support-docs-content">
          {currentEntry && (
            <>
              <h2 className="support-doc-title">{currentEntry.title}</h2>
              <p className="support-doc-summary">{currentEntry.summary}</p>
              {currentEntry.sections.map((sec, i) => (
                <div key={i} className="support-doc-section">
                  <h3>{sec.heading}</h3>
                  {sec.content && <p>{sec.content}</p>}
                  {sec.items && (
                    <ul className="support-doc-list">
                      {sec.items.map((item, j) => <li key={j}>{item}</li>)}
                    </ul>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default SupportTab;
