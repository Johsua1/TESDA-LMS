// ---------------------------------------------------------------------------
// TESDA LMS - Training Program / Course mock data
// 6 programs: Housekeeping, Barista, Hilot/Massage, Event Management,
// Virtual Assistant (special/bonus program), Bookkeeping
// ---------------------------------------------------------------------------

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// Normalize lesson metadata: add order, publish flag, video URL and material ids
const normalizeLesson = (l, index) => ({
  videoUrl: '',
  published: true,
  order: index + 1,
  ...l,
  materials: (l.materials || []).map((m, mi) => ({
    id: m.id || `${l.id}-m${mi + 1}`,
    name: m.name,
    type: m.type,
    url: m.url || '',
  })),
})

// Shared Basic Competency lessons (foundational skills)
const buildBasicCompetency = (programId) => ({
  id: `${programId}-basic`,
  type: 'Basic',
  title: 'Basic Competency',
  description:
    'Foundational skills required of every trainee: communication, numeracy, digital literacy and workplace behavior.',
  lessons: [
    {
      id: `${programId}-basic-l1`,
      title: 'Reading, Writing & Comprehension',
      description:
        'Develop the ability to read, interpret and write workplace documents, forms and simple reports.',
      duration: 45,
      video: 'Introduction to Workplace Literacy',
      materials: [
        { name: 'Reading Comprehension Guide.pdf', type: 'pdf' },
        { name: 'Workplace Forms Template.docx', type: 'doc' },
      ],
      content:
        'This lesson builds the foundational literacy skills needed in a technical-vocational workplace. You will practice reading instructions, interpreting forms, and writing simple reports and messages clearly and accurately.',
      quizId: `${programId}-basic-q1`,
    },
    {
      id: `${programId}-basic-l2`,
      title: 'Basic Communication Skills',
      description:
        'Learn verbal and non-verbal communication techniques for professional workplace interaction.',
      duration: 40,
      video: 'Effective Workplace Communication',
      materials: [{ name: 'Communication Etiquette Handout.pdf', type: 'pdf' }],
      content:
        'Communication is the backbone of any workplace. This lesson covers active listening, professional tone, giving and receiving feedback, and adapting your communication style to different audiences.',
      quizId: `${programId}-basic-q2`,
    },
    {
      id: `${programId}-basic-l3`,
      title: 'Basic Digital Literacy',
      description:
        'Familiarize yourself with computers, the internet, email and basic productivity tools.',
      duration: 60,
      video: 'Getting Started with Computers',
      materials: [
        { name: 'Digital Skills Workbook.pdf', type: 'pdf' },
        { name: 'Keyboard Shortcuts Cheatsheet.pdf', type: 'pdf' },
      ],
      content:
        'Digital literacy is essential for modern employment. This lesson introduces operating systems, file management, internet browsing, email, and cloud-based productivity tools.',
      quizId: `${programId}-basic-q3`,
    },
    {
      id: `${programId}-basic-l4`,
      title: 'Workplace Behavior & Professionalism',
      description:
        'Understand workplace ethics, punctuality, grooming, and professional conduct.',
      duration: 35,
      video: 'Professional Conduct at Work',
      materials: [{ name: 'Code of Conduct.pdf', type: 'pdf' }],
      content:
        'Professionalism covers punctuality, appropriate attire, respect for colleagues, following rules and regulations, and taking responsibility for your work.',
      quizId: `${programId}-basic-q4`,
    },
  ],
})

// Shared Common Competency lessons (skills common across industries)
const buildCommonCompetency = (programId) => ({
  id: `${programId}-common`,
  type: 'Common',
  title: 'Common Competency',
  description:
    'Skills common across technical-vocational industries: workplace communication, safety, customer service and teamwork.',
  lessons: [
    {
      id: `${programId}-common-l1`,
      title: 'Workplace Communication',
      description:
        'Communicate effectively with clients, colleagues and supervisors using industry-appropriate language.',
      duration: 50,
      video: 'Communicating in the Workplace',
      materials: [{ name: 'Communication Scenarios.pdf', type: 'pdf' }],
      content:
        'This lesson focuses on industry-specific communication: handling inquiries, reporting incidents, participating in meetings, and documenting work activities.',
      quizId: `${programId}-common-q1`,
    },
    {
      id: `${programId}-common-l2`,
      title: 'Workplace Safety & Emergency Procedures',
      description:
        'Identify hazards, follow OSH standards, and respond to workplace emergencies.',
      duration: 55,
      video: 'Occupational Safety and Health',
      materials: [
        { name: 'OSH Standards Manual.pdf', type: 'pdf' },
        { name: 'Emergency Evacuation Plan.pdf', type: 'pdf' },
      ],
      content:
        'Occupational Safety and Health (OSH) is a legal requirement. Learn to identify hazards, use protective equipment, follow safety signage, and respond to emergencies such as fire, earthquake, and medical incidents.',
      quizId: `${programId}-common-q2`,
    },
    {
      id: `${programId}-common-l3`,
      title: 'Customer Service Excellence',
      description:
        'Deliver quality service that meets and exceeds customer expectations.',
      duration: 45,
      video: 'Service Quality Standards',
      materials: [{ name: 'Customer Service Standards.pdf', type: 'pdf' }],
      content:
        'Excellent customer service builds loyalty and reputation. Learn the principles of service quality, handling complaints, and creating positive customer experiences.',
      quizId: `${programId}-common-q3`,
    },
    {
      id: `${programId}-common-l4`,
      title: 'Working with Others & Time Management',
      description:
        'Collaborate effectively in teams and manage your time and priorities.',
      duration: 40,
      video: 'Teamwork and Productivity',
      materials: [{ name: 'Teamwork Activity Sheet.pdf', type: 'pdf' }],
      content:
        'Success in the workplace depends on teamwork and personal productivity. This lesson covers collaboration, conflict resolution, prioritization, and effective scheduling.',
      quizId: `${programId}-common-q4`,
    },
  ],
})

// Program-specific core competencies
const coreCompetencies = {
  housekeeping: [
    {
      title: 'Room Cleaning Procedures',
      description: 'Clean and prepare guest rooms according to establishment standards.',
      lessons: [
        {
          title: 'Introduction to Housekeeping Operations',
          description: 'Understand the role of housekeeping in the hospitality industry.',
          duration: 45,
          content:
            'Housekeeping is the heart of hospitality. This lesson introduces the department structure, roles and responsibilities, grooming standards, and the importance of cleanliness to guest satisfaction.',
          materials: [{ name: 'Housekeeping Dept. Overview.pdf', type: 'pdf' }],
        },
        {
          title: 'Cleaning Equipment & Chemicals',
          description: 'Identify, use and maintain cleaning tools, equipment and chemicals safely.',
          duration: 50,
          content:
            'Learn to identify common cleaning equipment such as vacuum cleaners, mops, and caddies. Understand chemical dilution, safety data sheets, and proper storage.',
          materials: [
            { name: 'Cleaning Equipment Catalogue.pdf', type: 'pdf' },
            { name: 'Chemical Safety Data Sheet.pdf', type: 'pdf' },
          ],
        },
        {
          title: 'Guest Room Preparation',
          description: 'Systematically clean and prepare a guest room for occupancy.',
          duration: 60,
          content:
            'Follow the standard sequence for guest room cleaning: entering the room, dusting, bed making, bathroom cleaning, replenishing supplies, and final inspection.',
          materials: [{ name: 'Room Cleaning Checklist.pdf', type: 'pdf' }],
        },
      ],
    },
    {
      title: 'Bed Making & Linen Handling',
      description: 'Perform professional bed making and manage linen inventory.',
      lessons: [
        {
          title: 'Bed Making Techniques',
          description: 'Make beds to hotel standards including bed stripping and triple sheeting.',
          duration: 45,
          content:
            'Learn the step-by-step process of stripping, making, and inspecting a bed. Covers fitted sheets, flat sheets, duvets, pillowcases and decorative arrangements.',
          materials: [{ name: 'Bed Making Steps.pdf', type: 'pdf' }],
        },
        {
          title: 'Linen Room Management',
          description: 'Sort, store and control linen inventory and laundering.',
          duration: 40,
          content:
            'Manage linen par levels, sort soiled linen, coordinate with laundry, and maintain linen room organization to avoid losses.',
          materials: [{ name: 'Linen Inventory Sheet.pdf', type: 'pdf' }],
        },
      ],
    },
    {
      title: 'Bathroom Cleaning & Sanitation',
      description: 'Deep-clean and sanitize bathrooms using proper techniques.',
      lessons: [
        {
          title: 'Bathroom Cleaning Sequence',
          description: 'Clean and sanitize all bathroom fixtures and surfaces.',
          duration: 50,
          content:
            'Learn top-to-bottom bathroom cleaning: mirrors, sink, toilet, shower/bathtub, floor, and amenities replenishment. Emphasizes hygiene and cross-contamination prevention.',
          materials: [{ name: 'Bathroom Cleaning Guide.pdf', type: 'pdf' }],
        },
      ],
    },
    {
      title: 'Guest Room Inspection',
      description: 'Inspect rooms and handle guest requests and complaints.',
      duration: 45,
      content:
        'Conduct systematic room inspections using a checklist, identify defects, report maintenance issues, and professionally handle guest requests and complaints.',
      materials: [{ name: 'Room Inspection Form.pdf', type: 'pdf' }],
      lessons: [
        {
          title: 'Room Inspection Standards',
          description: 'Apply quality standards during guest room inspection.',
          duration: 45,
          content:
            'Use inspection checklists to verify cleanliness, functionality, and presentation. Learn how to document and escalate issues.',
          materials: [{ name: 'Inspection Standards.pdf', type: 'pdf' }],
        },
      ],
    },
  ],
  barista: [
    {
      title: 'Coffee Fundamentals',
      description: 'Understand coffee varieties, origins, roasting and flavor profiles.',
      lessons: [
        {
          title: 'Introduction to Coffee',
          description: 'Explore the history, varieties and journey of coffee from bean to cup.',
          duration: 45,
          content:
            'Learn about Arabica and Robusta, coffee-growing regions, processing methods, and how origin and roast affect flavor.',
          materials: [{ name: 'Coffee Origins Chart.pdf', type: 'pdf' }],
        },
        {
          title: 'Coffee Roasting & Grinding',
          description: 'Understand roast levels and proper grinding for different brew methods.',
          duration: 50,
          content:
            'Roast level dramatically affects taste. Learn light, medium and dark roasts, and how grind size must match the brewing method.',
          materials: [{ name: 'Grind Size Guide.pdf', type: 'pdf' }],
        },
      ],
    },
    {
      title: 'Espresso Preparation',
      description: 'Calibrate and extract consistent, high-quality espresso shots.',
      lessons: [
        {
          title: 'The Espresso Machine',
          description: 'Operate and maintain the espresso machine and grinder.',
          duration: 55,
          content:
            'Identify machine parts, understand pressure and temperature, and perform daily cleaning and backflushing routines.',
          materials: [{ name: 'Espresso Machine Manual.pdf', type: 'pdf' }],
        },
        {
          title: 'Dialing In the Shot',
          description: 'Adjust grind and dose to achieve ideal extraction.',
          duration: 50,
          content:
            'Learn to diagnose over- and under-extraction, adjust grind, dose and tamp, and taste-test to standardize your espresso.',
          materials: [{ name: 'Extraction Troubleshooting.pdf', type: 'pdf' }],
        },
      ],
    },
    {
      title: 'Milk Steaming & Latte Art',
      description: 'Steam milk to the correct texture and pour latte art.',
      lessons: [
        {
          title: 'Milk Texturing',
          description: 'Steam milk to create microfoam for espresso beverages.',
          duration: 45,
          content:
            'Learn proper milk steaming technique for different temperatures and textures, including dairy and alternative milks.',
          materials: [{ name: 'Milk Steaming Steps.pdf', type: 'pdf' }],
        },
        {
          title: 'Basic Latte Art',
          description: 'Pour a heart and rosetta using free-pour technique.',
          duration: 50,
          content:
            'Master milk-pitcher control to pour hearts, tulips and rosettas. Practice consistency and cup presentation.',
          materials: [{ name: 'Latte Art Reference.pdf', type: 'pdf' }],
        },
      ],
    },
    {
      title: 'Beverage Menu & Customer Service',
      description: 'Prepare the full beverage menu and serve customers.',
      lessons: [
        {
          title: 'Building the Beverage Menu',
          description: 'Prepare espresso-based and brewed beverages to recipe.',
          duration: 55,
          content:
            'Prepare Americano, cappuccino, latte, flat white, mocha, and manual brews following standard recipes and presentation.',
          materials: [{ name: 'Standard Recipes.pdf', type: 'pdf' }],
        },
      ],
    },
  ],
  hilot: [
    {
      title: 'Anatomy & Physiology Fundamentals',
      description: 'Understand the human body systems relevant to massage therapy.',
      lessons: [
        {
          title: 'Skeletal & Muscular System',
          description: 'Identify major bones, muscles and joints of the human body.',
          duration: 55,
          content:
            'Learn the structure of the skeletal and muscular systems, muscle groups, and how they relate to massage techniques.',
          materials: [{ name: 'Anatomy Charts.pdf', type: 'pdf' }],
        },
        {
          title: 'Circulatory & Lymphatic Systems',
          description: 'Understand circulation and lymph flow for therapeutic massage.',
          duration: 45,
          content:
            'Understand how massage affects blood circulation and lymphatic drainage, and why direction of strokes matters.',
          materials: [{ name: 'Circulatory System Notes.pdf', type: 'pdf' }],
        },
      ],
    },
    {
      title: 'Hilot Techniques & Fundamentals',
      description: 'Apply traditional Filipino hilot massage techniques.',
      lessons: [
        {
          title: 'Introduction to Hilot',
          description: 'Understand the history and philosophy of Filipino hilot.',
          duration: 45,
          content:
            'Explore the traditional Filipino healing art of hilot, its cultural roots, and its modern therapeutic application.',
          materials: [{ name: 'Hilot History & Ethics.pdf', type: 'pdf' }],
        },
        {
          title: 'Basic Massage Strokes',
          description: 'Perform effleurage, petrissage, tapotement and friction.',
          duration: 60,
          content:
            'Learn the five fundamental massage strokes, correct hand placement, pressure application, and rhythm.',
          materials: [{ name: 'Massage Strokes Guide.pdf', type: 'pdf' }],
        },
      ],
    },
    {
      title: 'Full Body Massage Sequence',
      description: 'Perform a complete therapeutic full-body massage.',
      lessons: [
        {
          title: 'Back, Shoulder & Neck Massage',
          description: 'Perform massage on the back, shoulders and neck.',
          duration: 55,
          content:
            'Learn the sequence for the back, shoulders and neck including draping, pressure points and finishing strokes.',
          materials: [{ name: 'Back Massage Sequence.pdf', type: 'pdf' }],
        },
        {
          title: 'Limb & Foot Massage',
          description: 'Perform massage on arms, hands, legs and feet.',
          duration: 50,
          content:
            'Complete the full-body sequence with arm, hand, leg and foot massage, including reflexology basics.',
          materials: [{ name: 'Limb Massage Guide.pdf', type: 'pdf' }],
        },
      ],
    },
    {
      title: 'Client Care & Spa Operations',
      description: 'Manage client consultation, hygiene and spa protocols.',
      lessons: [
        {
          title: 'Client Consultation & Contraindications',
          description: 'Assess client needs and identify contraindications to massage.',
          duration: 45,
          content:
            'Learn intake consultation, contraindications, informed consent, and adapting treatments to client needs.',
          materials: [{ name: 'Client Intake Form.pdf', type: 'pdf' }],
        },
      ],
    },
  ],
  'event-management': [
    {
      title: 'Event Planning Fundamentals',
      description: 'Plan events from concept to execution.',
      lessons: [
        {
          title: 'Introduction to Event Management',
          description: 'Understand the event industry, types of events and roles.',
          duration: 45,
          content:
            'Learn about corporate, social, and MICE events, and the roles within an event team from planner to coordinator.',
          materials: [{ name: 'Event Industry Overview.pdf', type: 'pdf' }],
        },
        {
          title: 'Event Conceptualization & Theming',
          description: 'Develop event concepts, themes and objectives.',
          duration: 50,
          content:
            'Translate client goals into a cohesive event concept, including theme, mood board, and creative direction.',
          materials: [{ name: 'Concept Development Worksheet.pdf', type: 'pdf' }],
        },
      ],
    },
    {
      title: 'Budgeting & Logistics',
      description: 'Prepare event budgets and coordinate logistics.',
      lessons: [
        {
          title: 'Event Budgeting',
          description: 'Create and manage an event budget and cost sheet.',
          duration: 50,
          content:
            'Learn to build a line-item budget, estimate costs, negotiate with suppliers, and track expenses.',
          materials: [{ name: 'Event Budget Template.xlsx', type: 'xls' }],
        },
        {
          title: 'Venue & Supplier Coordination',
          description: 'Select venues and coordinate with suppliers and vendors.',
          duration: 45,
          content:
            'Evaluate venue capacity, layout and accessibility; coordinate catering, AV, decor and other suppliers.',
          materials: [{ name: 'Supplier Checklist.pdf', type: 'pdf' }],
        },
      ],
    },
    {
      title: 'Event Execution & Production',
      description: 'Run event day operations and stage production.',
      lessons: [
        {
          title: 'Program Flow & Stage Management',
          description: 'Create program flow and manage stage production.',
          duration: 55,
          content:
            'Build a minute-by-minute program flow, manage cues, and coordinate backstage with the technical team.',
          materials: [{ name: 'Program Flow Template.pdf', type: 'pdf' }],
        },
        {
          title: 'Event Day Operations',
          description: 'Manage registration, ushering and on-site coordination.',
          duration: 50,
          content:
            'Handle registration, guest management, ushering, and contingency planning during the event.',
          materials: [{ name: 'Event Day Run Sheet.pdf', type: 'pdf' }],
        },
      ],
    },
    {
      title: 'Post-Event Evaluation',
      description: 'Evaluate events and prepare post-event reports.',
      lessons: [
        {
          title: 'Post-Event Reporting',
          description: 'Prepare post-event reports and client debriefs.',
          duration: 40,
          content:
            'Compile attendance, financials and feedback into a post-event report, and conduct a client debrief.',
          materials: [{ name: 'Post-Event Report Template.pdf', type: 'pdf' }],
        },
      ],
    },
  ],
  'virtual-assistant': [
    {
      title: 'Introduction to Virtual Assistance',
      description: 'Understand the VA industry, roles and remote work fundamentals.',
      lessons: [
        {
          title: 'The Virtual Assistant Profession',
          description: 'Understand what a VA does, niches, and client relationships.',
          duration: 45,
          content:
            'Learn about the different VA niches (admin, social media, e-commerce, real estate), rates, and building client relationships.',
          materials: [{ name: 'VA Career Guide.pdf', type: 'pdf' }],
        },
        {
          title: 'Remote Work Setup & Productivity',
          description: 'Set up a home office and manage remote productivity.',
          duration: 40,
          content:
            'Configure your workstation, internet, backup power, and time-zone management for reliable remote work.',
          materials: [{ name: 'Remote Setup Checklist.pdf', type: 'pdf' }],
        },
      ],
    },
    {
      title: 'Administrative Support',
      description: 'Provide email, calendar and document management support.',
      lessons: [
        {
          title: 'Email & Calendar Management',
          description: 'Manage inboxes, filters and shared calendars.',
          duration: 50,
          content:
            'Learn inbox zero techniques, labeling, canned responses, scheduling, and calendar coordination.',
          materials: [{ name: 'Email Management Guide.pdf', type: 'pdf' }],
        },
        {
          title: 'Document & Data Management',
          description: 'Create documents, spreadsheets and manage cloud files.',
          duration: 50,
          content:
            'Work with Google Workspace and Microsoft 365 to create documents, spreadsheets, and organized cloud folders.',
          materials: [{ name: 'Document Templates.zip', type: 'zip' }],
        },
      ],
    },
    {
      title: 'Communication & Customer Support',
      description: 'Handle client communication and customer support tasks.',
      lessons: [
        {
          title: 'Professional Client Communication',
          description: 'Communicate professionally via email, chat and video.',
          duration: 45,
          content:
            'Draft professional emails, run meetings, and manage client communication tools like Slack and Zoom.',
          materials: [{ name: 'Client Email Templates.pdf', type: 'pdf' }],
        },
        {
          title: 'Customer Support Basics',
          description: 'Provide helpdesk and customer support using ticketing tools.',
          duration: 50,
          content:
            'Learn ticketing systems, response templates, escalation, and measuring customer satisfaction.',
          materials: [{ name: 'Support Playbook.pdf', type: 'pdf' }],
        },
      ],
    },
    {
      title: 'Social Media & Tool Proficiency',
      description: 'Manage social media and master common VA tools.',
      lessons: [
        {
          title: 'Social Media Management',
          description: 'Schedule and manage content across social platforms.',
          duration: 50,
          content:
            'Use scheduling tools, content calendars and analytics to manage social media accounts.',
          materials: [{ name: 'Content Calendar.xlsx', type: 'xls' }],
        },
        {
          title: 'Typing Proficiency & Data Entry',
          description: 'Develop fast and accurate typing for data entry tasks.',
          duration: 40,
          content:
            'Practice touch typing, accuracy drills, and efficient data entry. Complete the timed typing assessment.',
          materials: [{ name: 'Typing Practice Guide.pdf', type: 'pdf' }],
        },
      ],
    },
  ],
  bookkeeping: [
    {
      title: 'Accounting Fundamentals',
      description: 'Understand the purpose of bookkeeping and the principles behind every recorded transaction.',
      lessons: [
        {
          title: 'Introduction to Bookkeeping & Accounting',
          description: 'Distinguish bookkeeping from accounting and identify the duties of a bookkeeper.',
          duration: 45,
          content:
            'Bookkeeping is the systematic recording of business transactions. This lesson covers the duties of a bookkeeper, the stages of the accounting cycle, the users of financial information, and the business records that must be kept.',
          materials: [{ name: 'Bookkeeping Overview.pdf', type: 'pdf' }],
        },
        {
          title: 'The Accounting Equation & Double-Entry System',
          description: 'Apply the accounting equation and the rules of debit and credit.',
          duration: 55,
          content:
            'Every transaction keeps the accounting equation (Assets = Liabilities + Equity) in balance. Learn the rules of debit and credit for assets, liabilities, equity, revenue and expenses, and analyze transactions using the double-entry system.',
          materials: [
            { name: 'Accounting Equation Worksheet.xlsx', type: 'xls' },
            { name: 'Debit and Credit Rules.pdf', type: 'pdf' },
          ],
        },
        {
          title: 'Accounting Concepts & the Accounting Cycle',
          description: 'Identify the assumptions, principles and steps that guide financial recording.',
          duration: 50,
          content:
            'Study the fundamental concepts — accrual, going concern, matching, consistency and materiality — and walk through the full accounting cycle from source documents to the closing entries.',
          materials: [{ name: 'Accounting Cycle Diagram.pdf', type: 'pdf' }],
        },
      ],
    },
    {
      title: 'Recording Business Transactions',
      description: 'Analyze source documents and record transactions in the books of accounts.',
      lessons: [
        {
          title: 'Source Documents & the Chart of Accounts',
          description: 'Verify business documents and classify accounts correctly.',
          duration: 50,
          content:
            'Learn to check invoices, receipts, vouchers and statements for completeness and accuracy, then assign each transaction to the proper account using a well-designed chart of accounts.',
          materials: [{ name: 'Sample Source Documents.pdf', type: 'pdf' }],
        },
        {
          title: 'Journalizing in the General Journal',
          description: 'Record transactions chronologically with correct debits and credits.',
          duration: 60,
          content:
            'Practice recording entries in the general journal: date, account titles, debit and credit amounts, and a short explanation. Covers compound entries and correcting entries.',
          materials: [{ name: 'General Journal Template.xlsx', type: 'xls' }],
        },
        {
          title: 'Special Journals & Subsidiary Ledgers',
          description: 'Use special journals and subsidiary records for high-volume transactions.',
          duration: 55,
          content:
            'Learn how the sales, purchases, cash receipts and cash payments journals simplify recording, and how subsidiary ledgers track individual customers and suppliers.',
          materials: [{ name: 'Special Journals Guide.pdf', type: 'pdf' }],
        },
      ],
    },
    {
      title: 'Posting & the Trial Balance',
      description: 'Transfer journal entries to the ledger and prove the accuracy of the records.',
      lessons: [
        {
          title: 'Posting to the General Ledger',
          description: 'Post journal entries to the correct ledger accounts.',
          duration: 55,
          content:
            'Follow the posting procedure: locate the account, enter the date, amount and journal reference, then update the running balance for each account.',
          materials: [{ name: 'Ledger Posting Practice.xlsx', type: 'xls' }],
        },
        {
          title: 'Preparing the Trial Balance',
          description: 'Prepare a trial balance and locate errors when it does not balance.',
          duration: 45,
          content:
            'Prepare an unadjusted trial balance listing every account and its balance, then apply techniques such as recomputing, checking postings and tracing entries to find errors.',
          materials: [{ name: 'Trial Balance Worksheet.xlsx', type: 'xls' }],
        },
        {
          title: 'Adjusting Entries & the Worksheet',
          description: 'Record accruals, deferrals, depreciation and other period-end adjustments.',
          duration: 60,
          content:
            'Adjust the records at period end for accrued revenues and expenses, prepayments, unearned income, depreciation and inventory, and complete a worksheet to produce the adjusted trial balance.',
          materials: [{ name: 'Adjusting Entries Guide.pdf', type: 'pdf' }],
        },
      ],
    },
    {
      title: 'Financial Reports & Compliance',
      description: 'Prepare financial statements and keep records compliant with reporting requirements.',
      lessons: [
        {
          title: 'Preparing the Income Statement',
          description: 'Compute gross profit, operating income and net income.',
          duration: 55,
          content:
            'Prepare a single-step and multi-step income statement, classify revenues and expenses, and compute gross profit, operating income and net income for the period.',
          materials: [{ name: 'Income Statement Template.xlsx', type: 'xls' }],
        },
        {
          title: 'Preparing the Statement of Financial Position',
          description: 'Classify and present assets, liabilities and equity.',
          duration: 55,
          content:
            'Prepare the statement of financial position using the classified format, distinguishing current from non-current items and presenting equity for sole proprietorships, partnerships and corporations.',
          materials: [{ name: 'Statement of Financial Position Template.xlsx', type: 'xls' }],
        },
        {
          title: 'Bank Reconciliation & Internal Control',
          description: 'Reconcile the cash book with the bank statement and apply basic controls.',
          duration: 50,
          content:
            'Prepare a bank reconciliation by adjusting for deposits in transit, outstanding checks, bank charges and errors. Discuss segregation of duties, authorization and documentation as basic internal controls.',
          materials: [{ name: 'Bank Reconciliation Form.xlsx', type: 'xls' }],
        },
        {
          title: 'Payroll, Taxes & Record Keeping',
          description: 'Maintain payroll records and keep books compliant and audit-ready.',
          duration: 45,
          content:
            'Compute gross and net pay with statutory deductions, record payroll entries, and learn the retention, safekeeping and reporting requirements for business books and records.',
          materials: [
            { name: 'Payroll Register Template.xlsx', type: 'xls' },
            { name: 'Record Keeping Checklist.pdf', type: 'pdf' },
          ],
        },
      ],
    },
  ],
}

// Quiz bank per program (attached to specific lessons)
const quizBank = {
  housekeeping: [
    {
      title: 'Housekeeping Safety & Sanitation Quiz',
      passing: 75,
      timeLimit: 30,
      questions: [
        { type: 'mcq', q: 'Which chemical is best for disinfecting bathroom surfaces?', options: ['Bleach solution', 'Cooking oil', 'Shampoo', 'Fabric softener'], answer: 'Bleach solution' },
        { type: 'tf', q: 'Cleaning chemicals should always be stored in unlabeled containers.', answer: false },
        { type: 'id', q: 'The process of removing dirt and germs from surfaces is called ______.', answer: 'sanitizing' },
        { type: 'mcq', q: 'What is the correct order when cleaning a guest room?', options: ['Bathroom first, then bedroom', 'Dust top to bottom', 'Clean floor first', 'Make bed last only'], answer: 'Dust top to bottom' },
        { type: 'tf', q: 'Wet floor signs should be placed after mopping to prevent accidents.', answer: true },
      ],
    },
    {
      title: 'Room Cleaning Quiz',
      passing: 75,
      timeLimit: 30,
      questions: [
        { type: 'mcq', q: 'How many flat sheets are typically used in triple sheeting?', options: ['One', 'Two', 'Three', 'Four'], answer: 'Three' },
        { type: 'tf', q: 'You should knock and announce yourself before entering an occupied guest room.', answer: true },
        { type: 'id', q: 'A _____ is used to collect dirty linen and trash from guest rooms.', answer: 'caddie' },
        { type: 'mcq', q: 'Which area should be cleaned first in a bathroom?', options: ['Floor', 'Mirror and sink', 'Toilet', 'Shower'], answer: 'Mirror and sink' },
        { type: 'tf', q: 'A guest room should be inspected before being released for occupancy.', answer: true },
      ],
    },
    {
      title: 'Bed Making & Linen Quiz',
      passing: 75,
      timeLimit: 30,
      questions: [
        { type: 'mcq', q: 'What is the first step in bed making?', options: ['Stripping the bed', 'Placing the duvet', 'Fluffing pillows', 'Vacuuming'], answer: 'Stripping the bed' },
        { type: 'tf', q: 'Soiled linen should be sorted by color and fabric type.', answer: true },
        { type: 'id', q: 'The minimum stock of linen kept on hand is called the _____ level.', answer: 'par' },
        { type: 'mcq', q: 'Where should dirty linen never be placed?', options: ['On the floor', 'In a linen bag', 'In a cart', 'In a hamper'], answer: 'On the floor' },
      ],
    },
  ],
  barista: [
    {
      title: 'Coffee Fundamentals Quiz',
      passing: 75,
      timeLimit: 30,
      questions: [
        { type: 'mcq', q: 'Which coffee species is generally considered higher quality?', options: ['Arabica', 'Robusta', 'Liberica', 'Excelsa'], answer: 'Arabica' },
        { type: 'tf', q: 'Finer grind is used for espresso than for French press.', answer: true },
        { type: 'id', q: 'The process of heating milk with steam to create foam is called ______.', answer: 'steaming' },
        { type: 'mcq', q: 'A darker roast generally produces what flavor?', options: ['Smoky and bitter', 'Fruity and bright', 'Floral and light', 'Sour'], answer: 'Smoky and bitter' },
        { type: 'tf', q: 'Coffee beans should be stored in an airtight container away from light.', answer: true },
      ],
    },
    {
      title: 'Espresso Preparation Quiz',
      passing: 75,
      timeLimit: 30,
      questions: [
        { type: 'mcq', q: 'A standard single espresso shot is approximately how many ounces?', options: ['1 oz', '3 oz', '5 oz', '8 oz'], answer: '1 oz' },
        { type: 'tf', q: 'Under-extracted espresso tastes sour and thin.', answer: true },
        { type: 'id', q: 'The tool used to level and press coffee grounds is called a ______.', answer: 'tamper' },
        { type: 'mcq', q: 'What is the ideal espresso extraction time for a double shot?', options: ['20-30 seconds', '5 seconds', '60 seconds', '2 minutes'], answer: '20-30 seconds' },
      ],
    },
    {
      title: 'Milk Steaming & Latte Art Quiz',
      passing: 75,
      timeLimit: 30,
      questions: [
        { type: 'mcq', q: 'The ideal microfoam texture is best described as:', options: ['Glossy wet paint', 'Dry and stiff', 'Large bubbles', 'Watery'], answer: 'Glossy wet paint' },
        { type: 'tf', q: 'Milk should be steamed to about 60-65°C for best taste.', answer: true },
        { type: 'id', q: 'The free-pour pattern that looks like a leaf is called a ______.', answer: 'rosetta' },
        { type: 'mcq', q: 'Over-steaming milk results in:', options: ['Burnt, flat taste', 'Sweet flavor', 'Better foam', 'Colder milk'], answer: 'Burnt, flat taste' },
      ],
    },
  ],
  hilot: [
    {
      title: 'Anatomy & Physiology Quiz',
      passing: 75,
      timeLimit: 30,
      questions: [
        { type: 'mcq', q: 'Which system carries blood throughout the body?', options: ['Circulatory', 'Skeletal', 'Nervous', 'Digestive'], answer: 'Circulatory' },
        { type: 'tf', q: 'Massage strokes generally follow the direction of blood flow toward the heart.', answer: true },
        { type: 'id', q: 'The _____ system includes lymph nodes and vessels.', answer: 'lymphatic' },
        { type: 'mcq', q: 'The largest muscle group in the body is found in the:', options: ['Back and legs', 'Fingers', 'Ears', 'Neck'], answer: 'Back and legs' },
        { type: 'tf', q: 'Understanding anatomy helps a therapist avoid injury to clients.', answer: true },
      ],
    },
    {
      title: 'Hilot Techniques Quiz',
      passing: 75,
      timeLimit: 30,
      questions: [
        { type: 'mcq', q: 'A long, gliding stroke is called:', options: ['Effleurage', 'Tapotement', 'Petrissage', 'Friction'], answer: 'Effleurage' },
        { type: 'tf', q: 'Hilot is a traditional Filipino healing art.', answer: true },
        { type: 'id', q: 'Kneading and squeezing techniques are called ______.', answer: 'petrissage' },
        { type: 'mcq', q: 'Which stroke uses rhythmic tapping?', options: ['Tapotement', 'Effleurage', 'Friction', 'Petrissage'], answer: 'Tapotement' },
      ],
    },
    {
      title: 'Client Care & Safety Quiz',
      passing: 75,
      timeLimit: 30,
      questions: [
        { type: 'mcq', q: 'A condition where massage should be avoided is called a:', options: ['Contraindication', 'Prescription', 'Indication', 'Diagnosis'], answer: 'Contraindication' },
        { type: 'tf', q: 'Informed consent should be obtained before any massage session.', answer: true },
        { type: 'id', q: 'A ______ should always be completed before treatment begins.', answer: 'consultation' },
        { type: 'mcq', q: 'Massage should NOT be performed over:', options: ['Open wounds', 'Muscles', 'Relaxed areas', 'Clean skin'], answer: 'Open wounds' },
      ],
    },
  ],
  'event-management': [
    {
      title: 'Event Planning Quiz',
      passing: 75,
      timeLimit: 30,
      questions: [
        { type: 'mcq', q: 'MICE stands for Meetings, Incentives, Conferences and:', options: ['Exhibitions', 'Events', 'Entertainment', 'Excursions'], answer: 'Exhibitions' },
        { type: 'tf', q: 'A theme should align with the client’s objectives.', answer: true },
        { type: 'id', q: 'A ______ is used to present the visual direction of an event.', answer: 'moodboard' },
        { type: 'mcq', q: 'The first stage of event planning is:', options: ['Conceptualization', 'Execution', 'Evaluation', 'Billing'], answer: 'Conceptualization' },
        { type: 'tf', q: 'Event planning should always start with a clear objective.', answer: true },
      ],
    },
    {
      title: 'Budgeting & Logistics Quiz',
      passing: 75,
      timeLimit: 30,
      questions: [
        { type: 'mcq', q: 'A contingency fund in an event budget covers:', options: ['Unexpected costs', 'Staff salaries only', 'Decorations', 'Invitations'], answer: 'Unexpected costs' },
        { type: 'tf', q: 'Venue capacity should match the expected number of guests.', answer: true },
        { type: 'id', q: 'The person responsible for the overall event is the event ______.', answer: 'planner' },
        { type: 'mcq', q: 'Which document lists every expense of an event?', options: ['Budget', 'Guest list', 'Menu', 'Floor plan'], answer: 'Budget' },
      ],
    },
    {
      title: 'Event Execution Quiz',
      passing: 75,
      timeLimit: 30,
      questions: [
        { type: 'mcq', q: 'A minute-by-minute schedule of an event is called:', options: ['Run sheet', 'Menu', 'Contract', 'Invoice'], answer: 'Run sheet' },
        { type: 'tf', q: 'Backstage coordination is handled by stage management.', answer: true },
        { type: 'id', q: 'Managing guest arrival and check-in is called ______.', answer: 'registration' },
        { type: 'mcq', q: 'A post-event report typically includes:', options: ['Attendance and financials', 'Only photos', 'Guest complaints only', 'The menu'], answer: 'Attendance and financials' },
      ],
    },
  ],
  'virtual-assistant': [
    {
      title: 'Virtual Assistant Fundamentals Quiz',
      passing: 75,
      timeLimit: 30,
      questions: [
        { type: 'mcq', q: 'A VA who manages social media accounts is in which niche?', options: ['Social media management', 'Bookkeeping', 'Web development', 'Legal'], answer: 'Social media management' },
        { type: 'tf', q: 'Time zone awareness is important for virtual assistants.', answer: true },
        { type: 'id', q: 'Working from home is also called working ______.', answer: 'remotely' },
        { type: 'mcq', q: 'Which tool is commonly used for team chat?', options: ['Slack', 'Photoshop', 'Excel only', 'Notepad'], answer: 'Slack' },
        { type: 'tf', q: 'A reliable internet connection is essential for a VA.', answer: true },
      ],
    },
    {
      title: 'Administrative Support Quiz',
      passing: 75,
      timeLimit: 30,
      questions: [
        { type: 'mcq', q: 'Inbox zero is a technique for:', options: ['Email management', 'Calendar design', 'Data entry', 'Graphic design'], answer: 'Email management' },
        { type: 'tf', q: 'Shared calendars help teams avoid scheduling conflicts.', answer: true },
        { type: 'id', q: 'A pre-written email response is called a ______ response.', answer: 'canned' },
        { type: 'mcq', q: 'Which is a cloud storage service?', options: ['Google Drive', 'Notepad', 'Calculator', 'Paint'], answer: 'Google Drive' },
      ],
    },
    {
      title: 'Communication & Support Quiz',
      passing: 75,
      timeLimit: 30,
      questions: [
        { type: 'mcq', q: 'A professional email should always include:', options: ['A clear subject line', 'Emojis only', 'No greeting', 'Slang'], answer: 'A clear subject line' },
        { type: 'tf', q: 'Ticketing systems help track customer support requests.', answer: true },
        { type: 'id', q: 'Passing a support issue to a higher level is called ______.', answer: 'escalation' },
        { type: 'mcq', q: 'CSAT measures:', options: ['Customer satisfaction', 'Internet speed', 'Typing speed', 'Battery life'], answer: 'Customer satisfaction' },
      ],
    },
  ],
  bookkeeping: [
    {
      title: 'Accounting Fundamentals Quiz',
      passing: 75,
      timeLimit: 30,
      questions: [
        { type: 'mcq', q: 'Which accounting equation is correct?', options: ['Assets = Liabilities + Equity', 'Assets = Liabilities - Equity', 'Equity = Assets + Liabilities', 'Liabilities = Assets + Equity'], answer: 'Assets = Liabilities + Equity' },
        { type: 'tf', q: 'In double-entry bookkeeping, every transaction affects at least two accounts.', answer: true },
        { type: 'id', q: 'The left side of a T-account is called the ______ side.', answer: 'debit' },
        { type: 'mcq', q: 'Which document is the source document for a sale on account?', options: ['Sales invoice', 'Payroll register', 'Bank statement', 'Petty cash voucher'], answer: 'Sales invoice' },
        { type: 'tf', q: 'Bookkeeping and accounting mean exactly the same thing.', answer: false },
      ],
    },
    {
      title: 'Journalizing & Ledger Quiz',
      passing: 75,
      timeLimit: 30,
      questions: [
        { type: 'mcq', q: 'Which journal is used to record sales on credit?', options: ['Sales journal', 'Cash receipts journal', 'General journal', 'Petty cash journal'], answer: 'Sales journal' },
        { type: 'tf', q: 'Posting transfers entries from the journal to the ledger.', answer: true },
        { type: 'id', q: 'A ______ is a list of all the accounts used by a business.', answer: 'chart of accounts' },
        { type: 'mcq', q: 'A trial balance is prepared to:', options: ['Check that total debits equal total credits', 'Compute net income', 'Record adjusting entries', 'Close the books'], answer: 'Check that total debits equal total credits' },
      ],
    },
    {
      title: 'Financial Statements Quiz',
      passing: 75,
      timeLimit: 30,
      questions: [
        { type: 'mcq', q: 'Which statement reports revenues and expenses for a period?', options: ['Income statement', 'Statement of financial position', 'Trial balance', 'General journal'], answer: 'Income statement' },
        { type: 'tf', q: 'Accumulated depreciation is a contra-asset account.', answer: true },
        { type: 'id', q: 'Assets minus liabilities equals ______.', answer: 'equity' },
        { type: 'mcq', q: 'Which account appears in the statement of financial position?', options: ['Accounts payable', 'Service revenue', 'Rent expense', 'Sales discount'], answer: 'Accounts payable' },
      ],
    },
  ],
}

// Build the final program objects
function buildProgram(meta) {
  const id = meta.id
  const basic = buildBasicCompetency(id)
  const common = buildCommonCompetency(id)
  const coreList = coreCompetencies[id] || []
  const core = {
    id: `${id}-core`,
    type: 'Core',
    title: 'Core Competency',
    description: meta.coreDescription,
    lessons: [],
    units: coreList.map((unit, ui) => {
      const unitId = `${id}-core-u${ui + 1}`
      return {
        id: unitId,
        title: unit.title,
        description: unit.description,
        lessons: unit.lessons.map((l, li) => {
          const lessonId = `${unitId}-l${li + 1}`
          return {
            id: lessonId,
            title: l.title,
            description: l.description,
            duration: l.duration,
            video: l.title,
            materials: l.materials || [],
            content: l.content,
            quizId: null,
          }
        }),
      }
    }),
  }

  // Normalize lesson metadata (order, publish flag, video URL, material ids)
  ;[basic, common, core].forEach((comp) => {
    if (comp.units) {
      comp.units.forEach((u) => {
        u.lessons = u.lessons.map((l, i) => normalizeLesson(l, i))
      })
    } else {
      comp.lessons = comp.lessons.map((l, i) => normalizeLesson(l, i))
    }
  })

  // Quiz templates drawn from the program's bank. Each is cloned once per
  // lesson below — never shared — so a trainee's attempt on one lesson can
  // never be attributed to a different lesson.
  const quizTemplates = (quizBank[id] || []).map((q, i) => ({
    id: `${id}-quiz-${i + 1}`,
    programId: id,
    title: q.title,
    passing: q.passing,
    timeLimit: q.timeLimit,
    published: true,
    questions: q.questions.map((qq, qi) => ({ id: `${id}-quiz-${i + 1}-q${qi + 1}`, ...qq })),
  }))

  // Seed each exam with its own question bank (drawn from the quiz pool)
  const examQuestions = quizTemplates
    .flatMap((q) => q.questions)
    .slice(0, 10)
    .map((qq, qi) => ({ ...qq, id: `${id}-exam-1-q${qi + 1}` }))

  // Give every lesson (basic, common and core) its own quiz with a unique id
  // and unique question ids. Sharing a quizId across lessons made one attempt
  // show as "Failed" on every lesson that reused the same quiz.
  const allLessons = [basic, common, core].flatMap((comp) =>
    comp.units ? comp.units.flatMap((u) => u.lessons) : comp.lessons,
  )
  const quizzes = allLessons
    .map((lesson, i) => {
      if (!quizTemplates.length) {
        lesson.quizId = null
        return null
      }
      const template = quizTemplates[i % quizTemplates.length]
      const quizId = `${lesson.id}-quiz`
      lesson.quizId = quizId
      return {
        ...template,
        id: quizId,
        lessonId: lesson.id,
        title: `${lesson.title} Quiz`,
        questions: template.questions.map((qq, qi) => ({ ...qq, id: `${quizId}-q${qi + 1}` })),
      }
    })
    .filter(Boolean)

  return {
    id,
    code: meta.code,
    title: meta.title,
    category: meta.category,
    level: meta.level,
    special: !!meta.special,
    // Only programs flagged enrollable are open for online trainee enrollment.
    enrollable: !!meta.enrollable,
    description: meta.description,
    overview: meta.overview,
    duration: meta.duration,
    hours: meta.hours,
    fee: meta.fee,
    color: meta.color,
    image: meta.image,
    // Renders the cover as a soft backdrop on the course pages (see
    // components/courses/CourseBackdrop.jsx).
    coverBackground: !!meta.coverBackground,
    requirements: meta.requirements,
    trainerId: meta.trainerId,
    competencies: [basic, common, core],
    quizzes,
    exams: [
      {
        id: `${id}-exam-1`,
        programId: id,
        title: `${meta.title} - Competency Assessment Exam`,
        competency: 'Core Competency',
        questions: examQuestions,
        questionCount: examQuestions.length,
        timeLimit: 60,
        passing: 75,
        date: meta.examDate,
        status: 'Upcoming',
        published: true,
      },
    ],
  }
}

export const programs = [
  buildProgram({
    id: 'housekeeping',
    code: 'HK-102',
    title: 'Housekeeping NC II',
    category: 'Tourism & Hospitality',
    level: 'NC II',
    description:
      'Prepare trainees to clean and prepare guest rooms, handle linen, and deliver quality housekeeping services in hotels and resorts.',
    overview:
      'The Housekeeping NC II program equips trainees with the skills to maintain cleanliness and orderliness in guest rooms and public areas of hospitality establishments. It covers room cleaning, bed making, bathroom sanitation, linen management and guest room inspection.',
    duration: '3 months',
    hours: 160,
    fee: 8500,
    color: 'from-sky-500 to-blue-600',
    image: '/courses/housekeeping.jpg',
    trainerId: 'tr-001',
    examDate: '2026-11-20',
    coreDescription:
      'The core competencies of Housekeeping NC II: preparing guest rooms, cleaning procedures, bed making, bathroom cleaning, and guest room inspection.',
    requirements: [
      'At least 18 years old',
      'High School graduate or ALS equivalent',
      'Physically fit (medical certificate)',
      'Birth certificate (PSA)',
      '2 pcs. 2x2 ID picture',
      'Barangay clearance',
    ],
  }),
  buildProgram({
    id: 'barista',
    code: 'BAR-204',
    title: 'Barista NC II',
    category: 'Tourism & Hospitality',
    level: 'NC II',
    description:
      'Train in coffee preparation, espresso extraction, milk steaming and latte art to become a professional barista.',
    overview:
      'The Barista NC II program develops the skills required to prepare and serve a variety of espresso-based and brewed coffee beverages. It covers coffee fundamentals, espresso preparation, milk texturing, latte art, and beverage menu preparation with excellent customer service.',
    duration: '2 months',
    hours: 120,
    fee: 7500,
    color: 'from-amber-500 to-orange-600',
    image: '/courses/barista.jpg',
    trainerId: 'tr-002',
    examDate: '2026-11-25',
    coreDescription:
      'Core competencies of Barista NC II: coffee fundamentals, espresso preparation, milk steaming and latte art, and beverage menu preparation.',
    requirements: [
      'At least 18 years old',
      'High School graduate or ALS equivalent',
      'Physically fit (medical certificate)',
      'Birth certificate (PSA)',
      '2 pcs. 2x2 ID picture',
      'Barangay clearance',
    ],
  }),
  buildProgram({
    id: 'hilot',
    code: 'HIL-306',
    title: 'Hilot (Wellness Massage) NC II',
    category: 'Health & Wellness',
    level: 'NC II',
    description:
      'Learn traditional Filipino hilot and therapeutic massage techniques for wellness and spa establishments.',
    overview:
      'The Hilot (Wellness Massage) NC II program trains individuals in the art and science of Filipino hilot and therapeutic massage. It covers anatomy and physiology, massage techniques, full-body massage sequences, and professional client care and spa operations.',
    duration: '3 months',
    hours: 150,
    fee: 9000,
    color: 'from-emerald-500 to-teal-600',
    image: '/courses/hilot.jpg',
    trainerId: 'tr-003',
    examDate: '2026-12-01',
    coreDescription:
      'Core competencies of Hilot NC II: anatomy and physiology, hilot techniques, full-body massage sequence, and client care.',
    requirements: [
      'At least 18 years old',
      'High School graduate or ALS equivalent',
      'Physically fit (medical certificate)',
      'Negative skin test / health clearance',
      'Birth certificate (PSA)',
      '2 pcs. 2x2 ID picture',
    ],
  }),
  buildProgram({
    id: 'event-management',
    code: 'EVT-408',
    title: 'Event Management Services NC II',
    category: 'Tourism & Hospitality',
    level: 'NC II',
    description:
      'Plan, organize and execute events including budgeting, logistics, stage production and post-event evaluation.',
    overview:
      'The Event Management Services NC II program prepares trainees to plan and deliver successful events. It covers event conceptualization, budgeting, logistics and supplier coordination, event-day production, and post-event evaluation and reporting.',
    duration: '3 months',
    hours: 140,
    fee: 8800,
    color: 'from-fuchsia-500 to-purple-600',
    image: '/courses/event-management.jpg',
    trainerId: 'tr-004',
    examDate: '2026-12-05',
    coreDescription:
      'Core competencies of Event Management NC II: event planning, budgeting and logistics, event execution and production, and post-event evaluation.',
    requirements: [
      'At least 18 years old',
      'High School graduate or ALS equivalent',
      'Good communication skills',
      'Birth certificate (PSA)',
      '2 pcs. 2x2 ID picture',
      'Barangay clearance',
    ],
  }),
  buildProgram({
    id: 'virtual-assistant',
    code: 'VA-510',
    title: 'Virtual Assistant NC II',
    category: 'Information Technology',
    level: 'NC II',
    description:
      'Become a professional virtual assistant: admin support, communication, social media management and tool proficiency.',
    overview:
      'The Virtual Assistant NC II program prepares trainees for remote work as a VA. It covers the VA profession, remote work setup, administrative support, client communication, customer support, social media management, and tool proficiency — including a proctored typing test evaluation.',
    duration: '8 Weeks',
    hours: 100,
    fee: 5000,
    color: 'from-indigo-500 to-violet-600',
    image: '/courses/virtual-assistant.jpg',
    trainerId: 'tr-005',
    examDate: '2026-11-30',
    coreDescription:
      'Core competencies of the Virtual Assistant program: VA fundamentals, administrative support, communication and customer support, and social media & tool proficiency.',
    requirements: [
      'At least 18 years old',
      'High School graduate or ALS equivalent',
      'Own laptop/computer with webcam',
      'Stable internet connection (min. 5 Mbps)',
      'Birth certificate (PSA)',
      '2 pcs. 2x2 ID picture',
    ],
  }),
  buildProgram({
    id: 'bookkeeping',
    code: 'BK-612',
    title: 'Bookkeeping NC III',
    category: 'Business & Finance',
    level: 'NC III',
    description:
      'Record business transactions, maintain ledgers, prepare trial balances and produce financial statements for small and medium enterprises.',
    overview:
      'The Bookkeeping NC III program prepares trainees to keep complete and accurate books of accounts. It covers accounting fundamentals, journalizing and posting, the trial balance and adjusting entries, and the preparation of financial statements, bank reconciliation and payroll records for a business enterprise.',
    duration: '3 months',
    hours: 180,
    fee: 9000,
    color: 'from-slate-700 to-slate-900',
    image: '/courses/bookkeeping.jpg',
    coverBackground: true,
    trainerId: null,
    examDate: '2026-12-10',
    coreDescription:
      'Core competencies of Bookkeeping NC III: accounting fundamentals, recording business transactions, posting and the trial balance, and preparing financial reports.',
    requirements: [
      'At least 18 years old',
      'High School graduate or ALS equivalent',
      'Basic numeracy and computer skills',
      'Birth certificate (PSA)',
      '2 pcs. 2x2 ID picture',
      'Barangay clearance',
    ],
  }),
]

// The persisted store (db.programs) is the authoritative copy — trainers and
// admins mutate it. AppProvider calls setLivePrograms(db.programs) on every
// render so these pure helpers always resolve against the latest content.
let livePrograms = programs
export const setLivePrograms = (list) => {
  if (Array.isArray(list)) livePrograms = list
}
export const getLivePrograms = () => livePrograms

export const programById = (id) => livePrograms.find((p) => p.id === id)

// Sort a lesson list by its `order` field (falls back to array position)
const byOrder = (arr = []) => [...arr].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

// Flatten all lessons of a program into an ordered array
export const programLessons = (programId) => {
  const program = programById(programId)
  if (!program) return []
  const list = []
  program.competencies.forEach((comp) => {
    if (comp.units) {
      comp.units.forEach((unit) => {
        byOrder(unit.lessons).forEach((l) =>
          list.push({ ...l, competency: comp.type, unitTitle: unit.title, competencyId: comp.id, unitId: unit.id }),
        )
      })
    } else {
      byOrder(comp.lessons).forEach((l) =>
        list.push({ ...l, competency: comp.type, unitTitle: comp.title, competencyId: comp.id, unitId: null }),
      )
    }
  })
  return list
}

export const programLessonCount = (programId) => programLessons(programId).length
export const programQuizCount = (programId) => (programById(programId)?.quizzes || []).length

export default programs
