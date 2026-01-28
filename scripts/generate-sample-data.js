const ExcelJS = require('exceljs');
const path = require('path');

async function generateSampleData() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CPM KPI Review Tool';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('KPI DETAILS');

  // Define headers matching the real NWC KPI Library structure (Domain removed)
  const headers = [
    'Department',
    'KPI Code',
    'Initiative Name',
    'KPI Name (English)',
    'KPI Name (Arabic)',
    'KPI Description (English)',
    'Formula',
    'Data Points',
    'Comments',
    'Discussion',
    'KPI Status',
    'Weight',
    'Target',
    'Achievement %',
    'Active/Inactive',
    'Aligned'
  ];

  worksheet.addRow(headers);

  // Style header row
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' }
  };
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  // Departments matching NWC structure
  const departments = [
    'Cultural Transformation',
    'Human Capital Operations',
    'Human Capital Projects',
    'Learning and Development',
    'Organizational Development',
    'Performance Management',
    'Policies and Procedures',
    'Strategy',
    'Systems and Digital Transformation',
    'Talent Acquisition',
    'Benefits and Compensation'
  ];

  // Sample KPIs with realistic NWC-style data
  const sampleKPIs = [
    // Cultural Transformation
    { dept: 'Cultural Transformation', initiative: 'Outstanding Employee Reward', nameEn: 'Nomination Evaluation Timeliness', nameAr: 'الالتزام بجدول تقييم الترشيحات', desc: 'Commitment to the specified timeframe (14 working days) for evaluating nominations and issuing recommendations.', formula: 'Number of nominations evaluated within 14 working days / Total number of nominations × 100', dataPoints: 'Nomination ID, Submission Date, Evaluation Date', status: 'New KPI', weight: 0.05, target: '>80%', achievement: 85, domain: 'Operational' },
    { dept: 'Cultural Transformation', initiative: 'We Care Channel - Suggestions', nameEn: 'Approved Employee Proposal Count', nameAr: 'عدد المقترحات المعتمدة للموظفين', desc: 'Measures the number of proposals that passed through the designated process.', formula: 'Total number of approved proposals / Number of received proposals × 100', dataPoints: 'Proposal ID, Submission Date, Status, Completion Date', status: 'New KPI', weight: 0.05, target: '>30%', achievement: 42, domain: 'Operational' },
    { dept: 'Cultural Transformation', initiative: 'We Care Channel - Complaints', nameEn: 'Percentage of We Care Requests Closed', nameAr: 'نسبة طلبات نهتم المغلقة', desc: 'Measures the percentage of closed requests in the system.', formula: 'Number of closed requests / Total number of requests × 100', dataPoints: 'Request ID, Submission Date, Closure Date, Status', status: 'New KPI', weight: 0.05, target: '>90%', achievement: 78, domain: 'Operational' },
    { dept: 'Cultural Transformation', initiative: 'Employee Engagement', nameEn: 'Employee Satisfaction Score', nameAr: 'درجة رضا الموظفين', desc: 'Annual employee satisfaction survey score.', formula: 'Sum of positive responses / Total responses × 100', dataPoints: 'Survey ID, Response Date, Score', status: 'Added KPI', weight: 0.10, target: '>75%', achievement: 72, domain: 'Strategic' },

    // Human Capital Operations
    { dept: 'Human Capital Operations', initiative: 'HR Service Delivery', nameEn: 'HR Request Resolution Time', nameAr: 'وقت حل طلبات الموارد البشرية', desc: 'Average time to resolve HR service requests.', formula: 'Sum of resolution times / Total requests', dataPoints: 'Request ID, Submit Date, Resolution Date', status: 'New KPI', weight: 0.05, target: '<48 hours', achievement: 92, domain: 'Operational' },
    { dept: 'Human Capital Operations', initiative: 'Employee Onboarding', nameEn: 'Onboarding Completion Rate', nameAr: 'معدل إتمام التوظيف', desc: 'Percentage of new hires completing onboarding within first week.', formula: 'Completed onboarding / Total new hires × 100', dataPoints: 'Employee ID, Start Date, Onboarding Completion Date', status: 'New KPI', weight: 0.05, target: '>95%', achievement: 88, domain: 'Operational' },
    { dept: 'Human Capital Operations', initiative: 'Payroll Processing', nameEn: 'Payroll Accuracy Rate', nameAr: 'معدل دقة الرواتب', desc: 'Percentage of payroll processed without errors.', formula: 'Error-free payrolls / Total payrolls × 100', dataPoints: 'Payroll ID, Processing Date, Error Count', status: 'Added KPI', weight: 0.08, target: '>99%', achievement: 99.5, domain: 'Operational' },

    // Human Capital Projects
    { dept: 'Human Capital Projects', initiative: 'HRIS Implementation', nameEn: 'Project Milestone Completion', nameAr: 'إتمام معالم المشروع', desc: 'Percentage of project milestones completed on schedule.', formula: 'On-time milestones / Total milestones × 100', dataPoints: 'Milestone ID, Planned Date, Actual Date', status: 'New KPI', weight: 0.10, target: '>90%', achievement: 85, domain: 'Project' },
    { dept: 'Human Capital Projects', initiative: 'System Integration', nameEn: 'Integration Success Rate', nameAr: 'معدل نجاح التكامل', desc: 'Percentage of successful system integrations.', formula: 'Successful integrations / Total integrations × 100', dataPoints: 'Integration ID, Status, Completion Date', status: 'New KPI', weight: 0.08, target: '>95%', achievement: 100, domain: 'Project' },

    // Learning and Development
    { dept: 'Learning and Development', initiative: 'Training Programs', nameEn: 'Training Hours per Employee', nameAr: 'ساعات التدريب لكل موظف', desc: 'Average training hours completed per employee annually.', formula: 'Total training hours / Number of employees', dataPoints: 'Training ID, Employee ID, Hours, Completion Date', status: 'New KPI', weight: 0.05, target: '>40 hours', achievement: 75, domain: 'HR Excellence' },
    { dept: 'Learning and Development', initiative: 'E-Learning Platform', nameEn: 'E-Learning Completion Rate', nameAr: 'معدل إتمام التعلم الإلكتروني', desc: 'Percentage of assigned e-learning courses completed.', formula: 'Completed courses / Assigned courses × 100', dataPoints: 'Course ID, Employee ID, Status, Completion Date', status: 'New KPI', weight: 0.05, target: '>80%', achievement: 68, domain: 'HR Excellence' },
    { dept: 'Learning and Development', initiative: 'Leadership Development', nameEn: 'Leadership Program Satisfaction', nameAr: 'رضا برنامج القيادة', desc: 'Participant satisfaction score for leadership programs.', formula: 'Average satisfaction score', dataPoints: 'Program ID, Participant ID, Score', status: 'Added KPI', weight: 0.05, target: '>4.0/5', achievement: 90, domain: 'Strategic' },

    // Organizational Development
    { dept: 'Organizational Development', initiative: 'Organization Design', nameEn: 'Structure Update Timeliness', nameAr: 'توقيت تحديث الهيكل', desc: 'Percentage of organizational structure updates completed on time.', formula: 'On-time updates / Total updates × 100', dataPoints: 'Update ID, Request Date, Completion Date', status: 'New KPI', weight: 0.05, target: '>90%', achievement: 82, domain: 'Operational' },
    { dept: 'Organizational Development', initiative: 'Job Evaluation', nameEn: 'Job Description Accuracy', nameAr: 'دقة الوصف الوظيفي', desc: 'Percentage of job descriptions reviewed and validated.', formula: 'Validated JDs / Total JDs × 100', dataPoints: 'Job ID, Review Date, Status', status: 'New KPI', weight: 0.05, target: '>95%', achievement: 91, domain: 'Operational' },

    // Performance Management
    { dept: 'Performance Management', initiative: 'Performance Reviews', nameEn: 'Review Completion Rate', nameAr: 'معدل إتمام التقييم', desc: 'Percentage of performance reviews completed on time.', formula: 'Completed reviews / Total employees × 100', dataPoints: 'Review ID, Employee ID, Due Date, Completion Date', status: 'New KPI', weight: 0.10, target: '>95%', achievement: 89, domain: 'HR Excellence' },
    { dept: 'Performance Management', initiative: 'Goal Setting', nameEn: 'Goal Alignment Rate', nameAr: 'معدل محاذاة الأهداف', desc: 'Percentage of employee goals aligned with department objectives.', formula: 'Aligned goals / Total goals × 100', dataPoints: 'Goal ID, Employee ID, Alignment Status', status: 'New KPI', weight: 0.08, target: '>90%', achievement: 94, domain: 'Strategic' },
    { dept: 'Performance Management', initiative: 'Feedback Culture', nameEn: 'Continuous Feedback Frequency', nameAr: 'تواتر التغذية الراجعة المستمرة', desc: 'Average number of feedback sessions per employee per quarter.', formula: 'Total feedback sessions / Number of employees', dataPoints: 'Feedback ID, Employee ID, Date', status: 'Added KPI', weight: 0.05, target: '>3', achievement: 80, domain: 'HR Excellence' },

    // Policies and Procedures
    { dept: 'Policies and Procedures', initiative: 'Policy Management', nameEn: 'Policy Review Compliance', nameAr: 'الامتثال لمراجعة السياسات', desc: 'Percentage of policies reviewed within scheduled timeline.', formula: 'On-time reviews / Total scheduled reviews × 100', dataPoints: 'Policy ID, Review Due Date, Actual Review Date', status: 'New KPI', weight: 0.05, target: '>90%', achievement: 85, domain: 'Operational' },
    { dept: 'Policies and Procedures', initiative: 'Compliance Training', nameEn: 'Policy Awareness Score', nameAr: 'درجة الوعي بالسياسات', desc: 'Employee awareness score on key policies.', formula: 'Average quiz score', dataPoints: 'Employee ID, Quiz ID, Score', status: 'New KPI', weight: 0.05, target: '>80%', achievement: 76, domain: 'Operational' },

    // Strategy
    { dept: 'Strategy', initiative: 'Strategic Planning', nameEn: 'Strategic Initiative Progress', nameAr: 'تقدم المبادرات الاستراتيجية', desc: 'Overall progress of strategic initiatives.', formula: 'Completed milestones / Total milestones × 100', dataPoints: 'Initiative ID, Milestone ID, Status', status: 'New KPI', weight: 0.15, target: '>85%', achievement: 78, domain: 'Strategic' },
    { dept: 'Strategy', initiative: 'KPI Framework', nameEn: 'KPI Reporting Timeliness', nameAr: 'توقيت تقارير مؤشرات الأداء', desc: 'Percentage of KPI reports submitted on time.', formula: 'On-time reports / Total reports × 100', dataPoints: 'Report ID, Due Date, Submit Date', status: 'New KPI', weight: 0.05, target: '>95%', achievement: 92, domain: 'Operational' },

    // Systems and Digital Transformation
    { dept: 'Systems and Digital Transformation', initiative: 'HR System Uptime', nameEn: 'System Availability Rate', nameAr: 'معدل توفر النظام', desc: 'Percentage of time HR systems are operational.', formula: 'Uptime hours / Total hours × 100', dataPoints: 'System ID, Uptime Log', status: 'New KPI', weight: 0.08, target: '>99.5%', achievement: 99.8, domain: 'Operational' },
    { dept: 'Systems and Digital Transformation', initiative: 'Process Automation', nameEn: 'Automation Implementation Rate', nameAr: 'معدل تنفيذ الأتمتة', desc: 'Percentage of identified processes automated.', formula: 'Automated processes / Total identified × 100', dataPoints: 'Process ID, Status, Implementation Date', status: 'New KPI', weight: 0.10, target: '>60%', achievement: 55, domain: 'Project' },
    { dept: 'Systems and Digital Transformation', initiative: 'Digital Services', nameEn: 'Employee Self-Service Adoption', nameAr: 'اعتماد الخدمة الذاتية للموظفين', desc: 'Percentage of employees using self-service portal.', formula: 'Active users / Total employees × 100', dataPoints: 'Employee ID, Portal Login Date', status: 'Added KPI', weight: 0.05, target: '>80%', achievement: 72, domain: 'Operational' },

    // Talent Acquisition
    { dept: 'Talent Acquisition', initiative: 'Recruitment', nameEn: 'Time to Fill', nameAr: 'وقت شغل الوظيفة', desc: 'Average days to fill an open position.', formula: 'Sum of days to fill / Number of positions filled', dataPoints: 'Position ID, Post Date, Fill Date', status: 'New KPI', weight: 0.08, target: '<45 days', achievement: 85, domain: 'Operational' },
    { dept: 'Talent Acquisition', initiative: 'Recruitment', nameEn: 'Offer Acceptance Rate', nameAr: 'معدل قبول العروض', desc: 'Percentage of job offers accepted by candidates.', formula: 'Accepted offers / Total offers × 100', dataPoints: 'Offer ID, Candidate ID, Status', status: 'New KPI', weight: 0.05, target: '>85%', achievement: 88, domain: 'Operational' },
    { dept: 'Talent Acquisition', initiative: 'Employer Branding', nameEn: 'Candidate Experience Score', nameAr: 'درجة تجربة المرشح', desc: 'Candidate satisfaction with recruitment process.', formula: 'Average survey score', dataPoints: 'Candidate ID, Survey Score', status: 'Added KPI', weight: 0.05, target: '>4.0/5', achievement: 78, domain: 'HR Excellence' },

    // Benefits and Compensation
    { dept: 'Benefits and Compensation', initiative: 'Compensation Review', nameEn: 'Market Competitiveness Ratio', nameAr: 'نسبة التنافسية السوقية', desc: 'Ratio of company compensation to market median.', formula: 'Company median / Market median × 100', dataPoints: 'Position ID, Company Salary, Market Salary', status: 'New KPI', weight: 0.10, target: '>95%', achievement: 0, domain: 'Strategic', active: 0 },
    { dept: 'Benefits and Compensation', initiative: 'Benefits Administration', nameEn: 'Benefits Enrollment Accuracy', nameAr: 'دقة التسجيل في المزايا', desc: 'Percentage of benefits enrollments processed without errors.', formula: 'Error-free enrollments / Total enrollments × 100', dataPoints: 'Employee ID, Enrollment Date, Error Flag', status: 'New KPI', weight: 0.05, target: '>99%', achievement: 0, domain: 'Operational', active: 0 },
  ];

  // Add KPI rows
  let kpiCounter = 1;
  sampleKPIs.forEach((kpi) => {
    const kpiCode = `KPI_${String(kpiCounter).padStart(3, '0')}`;
    const isActive = kpi.active !== undefined ? kpi.active : 1;
    // KPI Status: "Inactive" if not active, otherwise "Measure"
    const kpiStatus = isActive === 0 ? 'Inactive' : 'Measure';
    worksheet.addRow([
      kpi.dept,
      kpiCode,
      kpi.initiative,
      kpi.nameEn,
      kpi.nameAr,
      kpi.desc,
      kpi.formula,
      kpi.dataPoints,
      '', // Comments
      '', // Discussion
      kpiStatus,
      kpi.weight,
      kpi.target,
      kpi.achievement,
      isActive, // Active/Inactive
      '' // Aligned
    ]);
    kpiCounter++;
  });

  // Set column widths (Domain column removed, Discussion added)
  const columnWidths = [25, 12, 25, 35, 35, 50, 40, 30, 25, 40, 12, 10, 12, 12, 12, 20];
  columnWidths.forEach((width, i) => {
    worksheet.getColumn(i + 1).width = width;
  });

  // Save file
  const outputPath = path.join(__dirname, '..', 'Sample_KPI_Master_File.xlsx');
  await workbook.xlsx.writeFile(outputPath);
  console.log(`Sample data file created: ${outputPath}`);
  console.log(`Total KPIs: ${sampleKPIs.length}`);
  console.log(`Departments: ${[...new Set(sampleKPIs.map(k => k.dept))].length}`);
}

generateSampleData().catch(console.error);
