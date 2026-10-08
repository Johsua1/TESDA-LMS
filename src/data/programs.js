// ---------------------------------------------------------------------------
// TESDA LMS - Training Program / Course mock data
// 5 programs: Housekeeping, Barista, Hilot/Massage, Event Management,
// Virtual Assistant (special/bonus program)
// ---------------------------------------------------------------------------

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

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
}

// Quiz bank per program (attached to specific lessons)
const quizBank = {
  housekeeping: [
    {
      title: 'Housekeeping Safety & Sanitation Quiz',
      passing: 75,
      timeLimit: 10,
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
      timeLimit: 10,
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
      timeLimit: 8,
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
      timeLimit: 10,
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
      timeLimit: 10,
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
      timeLimit: 8,
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
      timeLimit: 10,
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
      timeLimit: 10,
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
      timeLimit: 8,
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
      timeLimit: 10,
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
      timeLimit: 10,
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
      timeLimit: 8,
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
      timeLimit: 10,
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
      timeLimit: 10,
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
      timeLimit: 8,
      questions: [
        { type: 'mcq', q: 'A professional email should always include:', options: ['A clear subject line', 'Emojis only', 'No greeting', 'Slang'], answer: 'A clear subject line' },
        { type: 'tf', q: 'Ticketing systems help track customer support requests.', answer: true },
        { type: 'id', q: 'Passing a support issue to a higher level is called ______.', answer: 'escalation' },
        { type: 'mcq', q: 'CSAT measures:', options: ['Customer satisfaction', 'Internet speed', 'Typing speed', 'Battery life'], answer: 'Customer satisfaction' },
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

  const quizzes = (quizBank[id] || []).map((q, i) => ({
    id: `${id}-quiz-${i + 1}`,
    programId: id,
    title: q.title,
    passing: q.passing,
    timeLimit: q.timeLimit,
    questions: q.questions.map((qq, qi) => ({ id: `${id}-quiz-${i + 1}-q${qi + 1}`, ...qq })),
  }))

  // attach quizzes to core lessons round-robin
  const coreLessonsFlat = core.units.flatMap((u) => u.lessons)
  coreLessonsFlat.forEach((lesson, i) => {
    if (quizzes.length) lesson.quizId = quizzes[i % quizzes.length].id
  })

  return {
    id,
    code: meta.code,
    title: meta.title,
    category: meta.category,
    level: meta.level,
    special: !!meta.special,
    description: meta.description,
    overview: meta.overview,
    duration: meta.duration,
    hours: meta.hours,
    fee: meta.fee,
    color: meta.color,
    emoji: meta.emoji,
    image: meta.image,
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
        questionCount: 10,
        timeLimit: 30,
        passing: 75,
        date: meta.examDate,
        status: 'Upcoming',
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
    emoji: '🧹',
    image: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=60',
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
    emoji: '☕',
    image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=60',
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
    emoji: '💆',
    image: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=1200&q=60',
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
    emoji: '🎉',
    image: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=60',
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
    title: 'Virtual Assistant (Special Program)',
    category: 'Information Technology',
    level: 'Special',
    special: true,
    description:
      'Become a professional virtual assistant: admin support, communication, social media management and tool proficiency.',
    overview:
      'The Virtual Assistant special program prepares trainees for remote work as a VA. It covers the VA profession, remote work setup, administrative support, client communication, customer support, social media management, and tool proficiency — including a proctored typing test evaluation.',
    duration: '2 months',
    hours: 100,
    fee: 6500,
    color: 'from-indigo-500 to-violet-600',
    emoji: '💻',
    image: 'https://images.unsplash.com/photo-1587560699334-cc4ff634909a?auto=format&fit=crop&w=1200&q=60',
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
]

export const programById = (id) => programs.find((p) => p.id === id)

// Flatten all lessons of a program into an ordered array
export const programLessons = (programId) => {
  const program = programById(programId)
  if (!program) return []
  const list = []
  program.competencies.forEach((comp) => {
    if (comp.units) {
      comp.units.forEach((unit) => {
        unit.lessons.forEach((l) => list.push({ ...l, competency: comp.type, unitTitle: unit.title, competencyId: comp.id }))
      })
    } else {
      comp.lessons.forEach((l) => list.push({ ...l, competency: comp.type, unitTitle: comp.title, competencyId: comp.id }))
    }
  })
  return list
}

export const programLessonCount = (programId) => programLessons(programId).length
export const programQuizCount = (programId) => (programById(programId)?.quizzes || []).length

export default programs
