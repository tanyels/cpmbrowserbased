# CPM Strategy Cascade Tool

A cross-platform desktop application for designing, structuring, and cascading corporate strategy into measurable KPIs across organizational levels.

## Features

### Track & Visualize
- **Interactive Strategy Map** - Visual representation of strategic pillars and objectives
- **Organization Chart** - Hierarchical view of business units with employee counts
- **Strategy Cascade View** - See how objectives and KPIs flow down organizational levels
- **Real-time Dashboard** - Overview of strategy execution status

### Design & Structure
- **Vision, Mission & Strategic Pillars** - Define your strategic foundation with weighted pillars
- **Business Units Hierarchy** - L1 (Corporate) → L2 (Division) → L3 (Department)
- **Team Members Management** - Employee hierarchy with reporting relationships
- **Cascaded Objectives** - Link objectives across organizational levels
- **KPIs** - Define KPIs with targets, weights, polarity, and approval status

### Measure & Analyze
- **Formula Builder** - Create complex measures using data points, global values, and functions (SUM, AVG, MIN, MAX, etc.)
- **Global Values** - Define constants used across multiple measures
- **Monthly Data Entry** - Input actual values for each KPI by month
- **Business Unit Scorecards** - Gauge charts, trend lines, and KPI tables with drill-down
- **Employee Scorecards** - Personal objectives and KPIs for team members
- **KPI Detail Modal** - Click any KPI to view detailed charts and edit properties

### Configure
- **Achievement Thresholds** - Customize Excellent/Good/Warning/Poor thresholds
- **Custom Color Schemes** - Define colors for each achievement level
- **Single or Monthly Targets** - Set same target for all months or different per month
- **Overachievement Caps** - Configure maximum achievement percentage for BU and Employee scorecards

## Tech Stack

- **Desktop Framework**: Electron
- **UI Framework**: React 18 with React Router
- **Build Tool**: Vite
- **Excel Processing**: ExcelJS
- **Packaging**: electron-builder

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/cpm-strategy-cascade.git
cd cpm-strategy-cascade
```

2. Install dependencies:
```bash
npm install
```

### Development

Run the app in development mode:

```bash
npm start
```

This will:
1. Start the Vite dev server for the React UI
2. Launch Electron once the dev server is ready

### Building for Production

Build for Windows:
```bash
npm run build:renderer
npm run package:win
```

Build for macOS:
```bash
npm run build:renderer
npm run package:mac
```

The installer will be created in the `release` folder.

## Project Structure

```
CPM_FullSoftware/
├── src/
│   ├── main/                    # Electron main process
│   │   ├── main.js              # Main entry point & IPC handlers
│   │   └── preload.js           # Preload script for IPC bridge
│   └── renderer/                # React UI
│       ├── src/
│       │   ├── components/
│       │   │   ├── tabs/        # Tab components
│       │   │   │   ├── DashboardTab.jsx
│       │   │   │   ├── StrategyMapTab.jsx
│       │   │   │   ├── OrgViewTab.jsx
│       │   │   │   ├── StrategyCascadeTab.jsx
│       │   │   │   ├── StrategyTab.jsx
│       │   │   │   ├── BusinessUnitsTab.jsx
│       │   │   │   ├── TeamMembersTab.jsx
│       │   │   │   ├── ObjectivesTab.jsx
│       │   │   │   ├── KPIsTab.jsx
│       │   │   │   ├── MeasureTab.jsx
│       │   │   │   ├── ScorecardTab.jsx
│       │   │   │   ├── EmployeeScorecardView.jsx
│       │   │   │   └── AdminTab.jsx
│       │   │   ├── FileSelection.jsx
│       │   │   └── MainLayout.jsx
│       │   ├── contexts/
│       │   │   └── StrategyContext.jsx  # Global state management
│       │   ├── App.jsx
│       │   ├── main.jsx
│       │   └── styles.css
│       └── index.html
├── scripts/
│   └── generate-sample-data.js
├── assets/
└── package.json
```

## Excel File Structure

The application uses a single Excel file with multiple sheets:

| Sheet | Purpose |
|-------|---------|
| Strategy | Vision, mission, strategic pillars |
| Business_Units | Organizational hierarchy (L1, L2, L3) |
| Team_Members | Employee data and reporting relationships |
| L1_Objectives | Corporate-level objectives |
| L2_Objectives | Division-level objectives |
| L3_Objectives | Department-level objectives |
| KPIs | KPI definitions with targets and weights |
| Global_Values | Constants for measure formulas |
| Measures | Formula definitions for KPIs |
| Parameter_Values | Monthly data entry values |
| Calculated_Values | Computed measure results |
| Achievements | KPI achievement percentages |
| Personal_Objectives | Employee personal objectives |
| Employee_KPIs | Employee-level KPIs |
| Employee_Achievements | Employee KPI achievements |
| Settings | Application configuration |

## Workflow

1. **Create or Open File** - Start with a new strategy file or open existing
2. **Define Strategy** - Set vision, mission, and strategic pillars
3. **Set Up Organization** - Create business unit hierarchy
4. **Add Team Members** - Define employees and reporting structure
5. **Create Objectives** - Cascade objectives from L1 to L3
6. **Define KPIs** - Link KPIs to objectives with targets
7. **Build Measures** - Create formulas for calculating KPI values
8. **Enter Data** - Input monthly actuals
9. **Track Performance** - View scorecards and dashboards

## License

MIT License

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
