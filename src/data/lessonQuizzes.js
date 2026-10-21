// ---------------------------------------------------------------------------
// Per-lesson quiz question sets.
//
// Every lesson gets its own small question set instead of borrowing a rotating
// slot from the program's general quiz bank — that used to show, for example,
// barista questions on the "Basic Digital Literacy" quiz.
//
// Keys are the lesson id with the program prefix removed:
//   'housekeeping-basic-l3'  -> 'basic-l3'
//   'bookkeeping-core-u2-l1' -> 'core-u2-l1'
// Basic and Common lessons are identical in every program, so their sets live
// in one shared table and are reused by all six courses.
// ---------------------------------------------------------------------------

const mcq = (q, options, answer) => ({ type: 'mcq', q, options, answer })
const tf = (q, answer) => ({ type: 'tf', q, answer })
const id = (q, answer) => ({ type: 'id', q, answer })

// ------------------------------ Basic / Common ------------------------------
const sharedLessonQuizzes = {
  'basic-l1': [
    mcq('Which document would you use to formally request time off from work?', ['Leave request form', 'Sales invoice', 'Delivery receipt', 'Purchase order'], 'Leave request form'),
    tf('When reading workplace instructions, it is fine to skip the steps you think are unnecessary.', false),
    id('The central point of a paragraph is called the ______ idea.', 'main'),
    mcq('Which sentence is clearest for a workplace report?', ['Done already yesterday by me the task.', 'The task was completed yesterday.', 'Task yesterday done.', 'Yesterday task done by me already.'], 'The task was completed yesterday.'),
  ],
  'basic-l2': [
    mcq('Which behavior is the strongest sign of active listening?', ['Interrupting to correct the speaker', 'Repeating back what you understood', 'Checking your phone', 'Changing the topic'], 'Repeating back what you understood'),
    tf('Eye contact and posture are part of communication.', true),
    id('Restating a message in your own words to confirm understanding is called ______.', 'paraphrasing'),
    mcq('Which tone is appropriate when writing to a customer?', ['Sarcastic', 'Professional and courteous', 'Aggressive', 'Overly casual'], 'Professional and courteous'),
  ],
  'basic-l3': [
    mcq('Which of these is an email application?', ['Gmail', 'Excel', 'Photoshop', 'VLC'], 'Gmail'),
    tf('A strong password should be shared with co-workers so they can open your files.', false),
    id('The key combination Ctrl + C is used to ______ the selected text.', 'copy'),
    mcq('What should you do before opening an attachment from an unknown sender?', ['Open it immediately', 'Verify the sender and scan it for malware', 'Forward it to all staff', 'Reply with your password'], 'Verify the sender and scan it for malware'),
  ],
  'basic-l4': [
    mcq('What does punctuality at work demonstrate?', ['Reliability and respect for others', 'That you are overworked', 'That you dislike the job', 'Nothing important'], 'Reliability and respect for others'),
    tf('Personal social media accounts may be used to discuss confidential client information.', false),
    id('The set of rules that guides acceptable behavior in the workplace is the code of ______.', 'conduct'),
    mcq('A colleague keeps arriving late. What is the professional response?', ['Post about it online', 'Raise it with the supervisor privately', 'Ignore your own work', 'Confront them in front of clients'], 'Raise it with the supervisor privately'),
  ],
  'common-l1': [
    mcq('Which channel is best for reporting an urgent safety incident?', ['A memo next week', 'A call or direct message to the supervisor', 'A suggestion box', 'A social media post'], 'A call or direct message to the supervisor'),
    tf('Incident reports should be written as soon as possible after the event.', true),
    id('The written record of what was discussed in a meeting is called the ______.', 'minutes'),
    mcq('What is the best way to confirm instructions you received verbally?', ['Assume you understood', 'Write them down and repeat them back', 'Wait for a written complaint', 'Ask a client instead'], 'Write them down and repeat them back'),
  ],
  'common-l2': [
    mcq('What does OSH stand for?', ['Occupational Safety and Health', 'Office Staff Handbook', 'Operational Service Hours', 'Organized Safety Help'], 'Occupational Safety and Health'),
    tf('Fire exits must be kept clear of boxes and equipment at all times.', true),
    id('Gear worn to protect a worker from hazards is called ______ equipment.', 'personal protective'),
    mcq('During an earthquake while indoors you should:', ['Run to the elevator', 'Duck, cover and hold', 'Stand near the windows', 'Call clients first'], 'Duck, cover and hold'),
  ],
  'common-l3': [
    mcq('What is the first step in handling a customer complaint?', ['Defend the company', 'Listen without interrupting', 'Offer a refund immediately', 'Blame another staff member'], 'Listen without interrupting'),
    tf('Customer expectations are met only when the service is free of charge.', false),
    id('The measure of how happy customers are with a service is customer ______.', 'satisfaction'),
    mcq('A customer is angry about a delayed order. What should you say first?', ['That is not our problem.', 'I understand — let me check the status for you.', 'You should have ordered earlier.', 'Call again tomorrow.'], 'I understand — let me check the status for you.'),
  ],
  'common-l4': [
    mcq('Which practice helps a team meet deadlines?', ['Working without a plan', 'Setting priorities and tracking tasks', 'Avoiding updates', 'Doing everything at the last minute'], 'Setting priorities and tracking tasks'),
    tf('A task list should be reviewed and updated as work progresses.', true),
    id('Arranging tasks from most to least important is called ______.', 'prioritizing'),
    mcq('A teammate is behind on a shared task. What is the best action?', ['Ignore it', 'Offer help and inform the lead', 'Complain about it later', 'Take over without telling anyone'], 'Offer help and inform the lead'),
  ],
}

// --------------------------------- Core -------------------------------------
const coreLessonQuizzes = {
  housekeeping: {
    'core-u1-l1': [
      mcq('Housekeeping mainly delivers which guest expectation?', ['Clean, comfortable rooms', 'Menu planning', 'Airline bookings', 'Building construction'], 'Clean, comfortable rooms'),
      tf('Grooming standards apply to housekeeping staff because they deal with guests.', true),
      id('The department that cleans guest rooms and public areas is ______.', 'housekeeping'),
      mcq('Which is a duty of a room attendant?', ['Preparing payroll', 'Cleaning and preparing guest rooms', 'Designing the hotel website', 'Auditing financial statements'], 'Cleaning and preparing guest rooms'),
    ],
    'core-u1-l2': [
      mcq('Which tool is used to reach dust on high surfaces?', ['Mop', 'Extendable duster', 'Bucket', 'Caddie'], 'Extendable duster'),
      tf('Cleaning chemicals should be kept in labeled containers away from food.', true),
      id('The document that explains a chemical\'s hazards is the Safety Data ______.', 'sheet'),
      mcq('Why is correct chemical dilution important?', ['It makes cleaning slower', 'It cleans effectively without damaging surfaces', 'It uses more product', 'It avoids reading labels'], 'It cleans effectively without damaging surfaces'),
    ],
    'core-u1-l3': [
      mcq('What is the first step when cleaning a guest room?', ['Making the bed', 'Knocking and announcing entry', 'Cleaning the bathroom', 'Vacuuming the floor'], 'Knocking and announcing entry'),
      tf('Supplies are replenished before the final inspection of the room.', true),
      id('The last step of room preparation is the final ______.', 'inspection'),
      mcq('Which cleaning order is correct?', ['Bathroom, dusting, bed making', 'Dusting, bed making, bathroom cleaning', 'Bed making, dusting, bathroom cleaning', 'Floor, bathroom, dusting'], 'Dusting, bed making, bathroom cleaning'),
    ],
    'core-u2-l1': [
      mcq('Triple sheeting uses how many flat sheets?', ['One', 'Two', 'Three', 'Four'], 'Three'),
      tf('The bed is stripped before fresh linen is applied.', true),
      id('The sheet placed over the mattress and tucked on all sides is the ______ sheet.', 'fitted'),
      mcq('How should pillowcases be finished?', ['Left loose and wrinkled', 'Smooth, tucked and facing the same way', 'Placed under the bed', 'Changed once a week only'], 'Smooth, tucked and facing the same way'),
    ],
    'core-u2-l2': [
      mcq('A linen par level is:', ['The maximum price of linen', 'The minimum stock kept on hand', 'The number of laundry staff', 'The color of the linen'], 'The minimum stock kept on hand'),
      tf('Soiled linen is separated from clean linen immediately.', true),
      id('Linen already used by guests is called ______ linen.', 'soiled'),
      mcq('Which practice reduces linen loss?', ['Recording issues and returns', 'Storing linen in guest rooms', 'Loaning linen to staff', 'Mixing linen with trash'], 'Recording issues and returns'),
    ],
    'core-u3-l1': [
      mcq('Which bathroom area is cleaned first?', ['Floor', 'Mirror and sink', 'Toilet', 'Shower'], 'Mirror and sink'),
      tf('The same cloth may be used for the toilet and the sink to save time.', false),
      id('Using a separate color-coded cloth per area prevents ______.', 'cross-contamination'),
      mcq('Why is the bathroom floor cleaned last?', ['It dries fastest', 'So dirt from other surfaces does not fall on it', 'It is the least dirty', 'Guests do not see it'], 'So dirt from other surfaces does not fall on it'),
    ],
    'core-u4-l1': [
      mcq('What is the purpose of a room inspection checklist?', ['To delay room release', 'To verify cleanliness and functionality consistently', 'To record guest complaints only', 'To order supplies'], 'To verify cleanliness and functionality consistently'),
      tf('Defects found during inspection should be documented and escalated.', true),
      id('Rooms that pass inspection are reported to the front desk as ______ rooms.', 'ready'),
      mcq('Which item is checked for functionality during inspection?', ['TV remote and lights', 'Guest luggage', 'Room rate', 'Menu prices'], 'TV remote and lights'),
    ],
  },
  barista: {
    'core-u1-l1': [
      mcq('Which coffee species is known for higher acidity and complex flavor?', ['Robusta', 'Arabica', 'Liberica', 'Excelsa'], 'Arabica'),
      tf('Roast level has no effect on the flavor of coffee.', false),
      id('The two main commercial coffee species are Arabica and ______.', 'robusta'),
      mcq('The processing method mainly affects:', ['The color of the cup', 'The flavor profile of the bean', 'The price of the machine', 'The size of the grinder'], 'The flavor profile of the bean'),
    ],
    'core-u1-l2': [
      mcq('Which roast is the darkest?', ['Light', 'Medium', 'Dark', 'Cinnamon'], 'Dark'),
      tf('A fine grind is used for espresso.', true),
      id('A coarse grind suits a ______ press brewer.', 'french'),
      mcq('What happens when coffee is ground too fine for a drip brewer?', ['It brews faster', 'It over-extracts and tastes bitter', 'Nothing changes', 'It becomes decaf'], 'It over-extracts and tastes bitter'),
    ],
    'core-u2-l1': [
      mcq('What is the standard brew pressure for espresso?', ['3 bar', '9 bar', '15 bar', '20 bar'], '9 bar'),
      tf('The group head is backflushed as part of daily cleaning.', true),
      id('The part that holds the portafilter during extraction is the ______ head.', 'group'),
      mcq('Which routine keeps a grinder performing well?', ['Washing it with water', 'Brushing the burrs and removing oils regularly', 'Running rice through it daily', 'Never cleaning it'], 'Brushing the burrs and removing oils regularly'),
    ],
    'core-u2-l2': [
      mcq('A shot that pours too fast and tastes sour is usually:', ['Over-extracted', 'Under-extracted', 'Perfectly dialed', 'Decaffeinated'], 'Under-extracted'),
      tf('Adjusting the grind is the main way to change extraction time.', true),
      id('The amount of coffee used in the basket is called the ______.', 'dose'),
      mcq('A bitter, slow-pouring shot suggests:', ['The grind is too coarse', 'The grind is too fine', 'The water is too cold only', 'The basket is too large'], 'The grind is too fine'),
    ],
    'core-u3-l1': [
      mcq('Microfoam is created by:', ['Boiling the milk rapidly', 'Adding air, then folding it into the milk', 'Adding cream', 'Shaking the pitcher'], 'Adding air, then folding it into the milk'),
      tf('Milk is usually steamed to about 60-65 degrees Celsius for espresso drinks.', true),
      id('The glossy, velvety milk used for latte art is called ______.', 'microfoam'),
      mcq('Which milk is hardest to texture because of its low fat content?', ['Whole milk', 'Skim milk', 'Oat milk', 'Cream'], 'Skim milk'),
    ],
    'core-u3-l2': [
      mcq('Which pattern comes from pouring a steady stream while moving the pitcher side to side?', ['Heart', 'Rosetta', 'Tulip', 'Swan'], 'Rosetta'),
      tf('A clean, dry pitcher improves foam quality.', true),
      id('Pouring art straight from the pitcher without tools is called a ______ pour.', 'free'),
      mcq('Consistent latte art depends mostly on:', ['Very hot milk', 'Controlled pitcher height and flow', 'A large cup', 'Stirring the crema'], 'Controlled pitcher height and flow'),
    ],
    'core-u4-l1': [
      mcq('A traditional cappuccino is:', ['Mostly milk', 'Equal parts espresso, steamed milk and foam', 'Espresso with no milk', 'Only foam'], 'Equal parts espresso, steamed milk and foam'),
      tf('An Americano is espresso diluted with hot water.', true),
      id('A latte uses more steamed ______ than foam.', 'milk'),
      mcq('Why are standard recipes important?', ['They slow down service', 'They keep taste and cost consistent', 'They replace training', 'They reduce the cup size'], 'They keep taste and cost consistent'),
    ],
  },
  hilot: {
    'core-u1-l1': [
      mcq('Which system provides the framework and protection for the body?', ['Skeletal', 'Digestive', 'Endocrine', 'Respiratory'], 'Skeletal'),
      tf('Muscles work in pairs to move a joint.', true),
      id('The point where two bones meet is called a ______.', 'joint'),
      mcq('Which muscle group is at the back of the upper arm?', ['Biceps', 'Triceps', 'Deltoid', 'Pectoral'], 'Triceps'),
    ],
    'core-u1-l2': [
      mcq('Massage strokes directed toward the heart mainly support:', ['Bone growth', 'Venous return and lymph flow', 'Hair growth', 'Fat digestion'], 'Venous return and lymph flow'),
      tf('The lymphatic system helps remove waste and supports immunity.', true),
      id('The fluid that carries oxygen through the body is ______.', 'blood'),
      mcq('In which direction should effleurage generally be applied?', ['Away from the heart', 'Toward the heart', 'In circles only', 'In random directions'], 'Toward the heart'),
    ],
    'core-u2-l1': [
      mcq('Hilot is best described as:', ['A modern gym workout', 'A traditional Filipino healing art', 'A type of surgery', 'A beauty treatment only'], 'A traditional Filipino healing art'),
      tf('Hilot has cultural roots in Filipino communities.', true),
      id('The traditional Filipino healer who practices hilot is the ______.', 'manghihilot'),
      mcq('Modern hilot practice mainly aims to:', ['Replace medical care', 'Relieve muscle pain and stress', 'Perform only spiritual rituals', 'Sell herbal products'], 'Relieve muscle pain and stress'),
    ],
    'core-u2-l2': [
      mcq('Which stroke uses light, gliding movements?', ['Effleurage', 'Petrissage', 'Tapotement', 'Friction'], 'Effleurage'),
      tf('Tapotement is a rhythmic percussion stroke.', true),
      id('Kneading and squeezing of muscle tissue is called ______.', 'petrissage'),
      mcq('How should massage pressure be applied?', ['Always at maximum', 'Adjusted to the client\'s comfort', 'Only with the elbows', 'The same for every client'], 'Adjusted to the client\'s comfort'),
    ],
    'core-u3-l1': [
      mcq('What must be done before starting a back massage?', ['Apply oil to the hair', 'Drape the client and check comfort', 'Ask the client to stand', 'Turn up the lights'], 'Drape the client and check comfort'),
      tf('Strong pressure should be applied directly to the throat during a neck massage.', false),
      id('Covering the client with a sheet to protect privacy is called ______.', 'draping'),
      mcq('Which area commonly holds tension in office workers?', ['Shoulders and upper back', 'Knees', 'Ankles', 'Elbows'], 'Shoulders and upper back'),
    ],
    'core-u3-l2': [
      mcq('Reflexology focuses on:', ['Pressure points on the feet', 'Bone setting', 'Hair treatment', 'Skin whitening'], 'Pressure points on the feet'),
      tf('Limb massage generally follows the direction of blood flow toward the heart.', true),
      id('Massaging the feet with thumb pressure on specific points is called ______.', 'reflexology'),
      mcq('Which precaution applies to a client with varicose veins?', ['Deep pressure on the veins', 'Gentle strokes and medical clearance', 'Skip massage forever', 'Use hot stones'], 'Gentle strokes and medical clearance'),
    ],
    'core-u4-l1': [
      mcq('Which condition is a contraindication for massage?', ['Mild stress', 'Fever or an open skin infection', 'Muscle stiffness', 'Desk work'], 'Fever or an open skin infection'),
      tf('Informed consent is obtained before the session begins.', true),
      id('A condition in which massage must be avoided is called a ______.', 'contraindication'),
      mcq('The main purpose of the intake consultation is to:', ['Sell products', 'Understand the client\'s needs and health risks', 'Shorten the session', 'Replace the therapist'], 'Understand the client\'s needs and health risks'),
    ],
  },
  'event-management': {
    'core-u1-l1': [
      mcq('MICE stands for:', ['Meetings, Incentives, Conferences, Exhibitions', 'Music, Ideas, Catering, Events', 'Meetings, Invitations, Costs, Exhibits', 'Management, Industry, Culture, Events'], 'Meetings, Incentives, Conferences, Exhibitions'),
      tf('A wedding is an example of a social event.', true),
      id('The person responsible for the overall planning of an event is the event ______.', 'planner'),
      mcq('Which role coordinates suppliers on the event day?', ['Event coordinator', 'Guest', 'Photographer', 'Sponsor'], 'Event coordinator'),
    ],
    'core-u1-l2': [
      mcq('A mood board is used to:', ['Track the budget', 'Communicate the visual direction', 'List suppliers', 'Record attendance'], 'Communicate the visual direction'),
      tf('The event concept should reflect the client\'s objectives and audience.', true),
      id('The overall visual and emotional direction of an event is its ______.', 'theme'),
      mcq('What should guide the concept of a corporate launch?', ['The planner\'s personal taste', 'The client\'s brand and goals', 'The cheapest supplier', 'The venue\'s wallpaper'], 'The client\'s brand and goals'),
    ],
    'core-u2-l1': [
      mcq('Which is a fixed cost in an event budget?', ['Venue rental', 'Extra chairs rented on the day', 'Overtime crew', 'Emergency repairs'], 'Venue rental'),
      tf('A budget includes a contingency line for unexpected costs.', true),
      id('The amount set aside for unexpected expenses is the ______.', 'contingency'),
      mcq('Why should expenses be tracked during the event?', ['To avoid overspending', 'To delay payments', 'To raise supplier rates', 'To reduce attendance'], 'To avoid overspending'),
    ],
    'core-u2-l2': [
      mcq('Which factor matters most when choosing a venue?', ['Capacity and accessibility for guests', 'The color of the walls', 'Distance from the planner\'s home', 'Free parking for staff only'], 'Capacity and accessibility for guests'),
      tf('Supplier contracts should state deliverables, deadlines and payment terms.', true),
      id('The document that binds a supplier to deliver services is a ______.', 'contract'),
      mcq('Why is a site visit done?', ['To confirm layout and logistics', 'To sign the guest list', 'To choose the menu only', 'To pay the deposit only'], 'To confirm layout and logistics'),
    ],
    'core-u3-l1': [
      mcq('A program flow is:', ['A minute-by-minute schedule of activities', 'A list of guests', 'The venue map', 'The budget summary'], 'A minute-by-minute schedule of activities'),
      tf('Cues are coordinated with the technical team before the event.', true),
      id('The person who signals lights and sound cues is the stage ______.', 'manager'),
      mcq('Why are time buffers built into a program flow?', ['To fill empty time', 'To absorb delays', 'To lengthen the event', 'To reduce costs'], 'To absorb delays'),
    ],
    'core-u3-l2': [
      mcq('Registration desks should be:', ['Hidden from guests', 'Clearly signposted and staffed', 'Closed until noon', 'Manned by suppliers only'], 'Clearly signposted and staffed'),
      tf('A contingency plan should cover bad weather and supplier no-shows.', true),
      id('Directing guests to their seats is called ______.', 'ushering'),
      mcq('What is the first action when a supplier fails to arrive?', ['Cancel the event', 'Activate the contingency plan and inform the client', 'Argue with the supplier', 'Leave the venue'], 'Activate the contingency plan and inform the client'),
    ],
    'core-u4-l1': [
      mcq('A post-event report usually contains:', ['Attendance, financials and feedback', 'Photos only', 'The guest list only', 'Supplier contacts only'], 'Attendance, financials and feedback'),
      tf('A client debrief helps identify improvements for future events.', true),
      id('Gathering client comments after an event is called collecting ______.', 'feedback'),
      mcq('When should the post-event report be delivered?', ['Within an agreed short period after the event', 'Six months later', 'Before the event', 'Only if the client asks'], 'Within an agreed short period after the event'),
    ],
  },
  'virtual-assistant': {
    'core-u1-l1': [
      mcq('A VA niche is:', ['A specialized service area such as admin or social media', 'A type of laptop', 'A time zone', 'A payment method'], 'A specialized service area such as admin or social media'),
      tf('Virtual assistants usually work remotely for clients in different locations.', true),
      id('A self-employed professional serving several clients is a ______.', 'freelancer'),
      mcq('Which builds long-term client relationships?', ['Missing deadlines', 'Clear communication and reliability', 'Overpromising', 'Ignoring feedback'], 'Clear communication and reliability'),
    ],
    'core-u1-l2': [
      mcq('Why is a backup power source important for remote work?', ['To decorate the desk', 'To avoid downtime during outages', 'To increase internet speed', 'To store files'], 'To avoid downtime during outages'),
      tf('Time-zone differences should be considered when scheduling client meetings.', true),
      id('A dedicated space for working at home is a home ______.', 'office'),
      mcq('Which habit improves remote productivity?', ['Working twelve hours without breaks', 'Planning the day and blocking focus time', 'Keeping notifications on all night', 'Skipping task lists'], 'Planning the day and blocking focus time'),
    ],
    'core-u2-l1': [
      mcq('Inbox zero means:', ['Deleting all email', 'Every message is processed or filed', 'Never checking email', 'Reading email once a week'], 'Every message is processed or filed'),
      tf('Canned responses help answer recurring emails consistently.', true),
      id('Automatically sorting incoming messages into folders uses email ______.', 'filters'),
      mcq('What should you check before scheduling a meeting?', ['The client\'s availability and time zone', 'The largest free slot', 'Nothing at all', 'Only your own calendar'], 'The client\'s availability and time zone'),
    ],
    'core-u2-l2': [
      mcq('Which tool is best for creating a budget spreadsheet?', ['Google Sheets', 'Google Docs', 'Canva', 'Slack'], 'Google Sheets'),
      tf('Cloud folders should follow a consistent naming convention.', true),
      id('Saving files online so they are reachable anywhere is called ______ storage.', 'cloud'),
      mcq('Why should access permissions be set on shared folders?', ['To protect confidential files', 'To slow downloads', 'To use more storage', 'To change file colors'], 'To protect confidential files'),
    ],
    'core-u3-l1': [
      mcq('Which subject line is most professional?', ['hey', 'Meeting request: Project Kickoff - Oct 24', 'URGENT!!!', '(no subject)'], 'Meeting request: Project Kickoff - Oct 24'),
      tf('A video call should start by checking audio and camera settings.', true),
      id('Written workplace messages should keep a professional ______.', 'tone'),
      mcq('A client asks for a change you cannot deliver today. What is the best reply?', ['Ignore the message', 'Acknowledge it and give a realistic timeline', 'Say yes and delay silently', 'Blame the team'], 'Acknowledge it and give a realistic timeline'),
    ],
    'core-u3-l2': [
      mcq('A ticketing system is used to:', ['Track and resolve customer requests', 'Send marketing email', 'Design logos', 'Host video calls'], 'Track and resolve customer requests'),
      tf('Issues that cannot be resolved should be escalated with complete details.', true),
      id('The measure of how happy customers are is customer ______.', 'satisfaction'),
      mcq('What makes a support reply effective?', ['Long paragraphs of jargon', 'Clear, empathetic and specific answers', 'Copy-paste without reading', 'Delaying until the customer gives up'], 'Clear, empathetic and specific answers'),
    ],
    'core-u4-l1': [
      mcq('A content calendar helps to:', ['Plan and schedule posts in advance', 'Increase internet speed', 'Store passwords', 'Replace analytics'], 'Plan and schedule posts in advance'),
      tf('Analytics show which posts perform best.', true),
      id('Tools that publish posts at set times are called ______ tools.', 'scheduling'),
      mcq('Before posting on a client account you should:', ['Follow the approved content plan', 'Post whatever you like', 'Share the password publicly', 'Ignore brand guidelines'], 'Follow the approved content plan'),
    ],
    'core-u4-l2': [
      mcq('Touch typing means typing:', ['With two fingers', 'Without looking at the keyboard', 'With the right hand only', 'Using voice input'], 'Without looking at the keyboard'),
      tf('Accuracy matters more than speed when entering client data.', true),
      id('Typing speed is measured in words per ______.', 'minute'),
      mcq('Which practice reduces data entry errors?', ['Double-checking entries against the source', 'Typing as fast as possible', 'Skipping verification', 'Copy-pasting everything'], 'Double-checking entries against the source'),
    ],
  },
  bookkeeping: {
    'core-u1-l1': [
      mcq('Bookkeeping is best described as:', ['The systematic recording of business transactions', 'Auditing financial statements', 'Managing investments', 'Filing tax returns only'], 'The systematic recording of business transactions'),
      tf('Accounting is broader than bookkeeping because it includes analysis and reporting.', true),
      id('The sequence of steps from transaction to financial statements is the accounting ______.', 'cycle'),
      mcq('Who uses financial information?', ['The owner only', 'Owners, lenders, government and investors', 'Auditors only', 'Customers only'], 'Owners, lenders, government and investors'),
    ],
    'core-u1-l2': [
      mcq('The accounting equation is:', ['Assets = Liabilities + Equity', 'Assets = Equity - Liabilities', 'Equity = Assets + Liabilities', 'Liabilities = Assets + Equity'], 'Assets = Liabilities + Equity'),
      tf('Every transaction affects at least two accounts.', true),
      id('Increases in assets are recorded as ______.', 'debits'),
      mcq('A debit increases which account?', ['Revenue', 'Expense', 'Liability', 'Equity'], 'Expense'),
    ],
    'core-u1-l3': [
      mcq('Under the accrual concept, revenue is recorded when:', ['Cash is received', 'It is earned', 'The year ends', 'The customer requests it'], 'It is earned'),
      tf('The going concern assumption means the business is expected to keep operating.', true),
      id('Matching expenses with the revenue they helped earn is the ______ principle.', 'matching'),
      mcq('Which is the last step of the accounting cycle?', ['Journalizing', 'Posting', 'Preparing the trial balance', 'Closing the books'], 'Closing the books'),
    ],
    'core-u2-l1': [
      mcq('Which document proves a sale on credit?', ['Sales invoice', 'Bank statement', 'Payroll register', 'Petty cash voucher'], 'Sales invoice'),
      tf('The chart of accounts lists every account the business uses.', true),
      id('The document a seller issues to a buyer for goods delivered is an ______.', 'invoice'),
      mcq('Why must source documents be verified?', ['To ensure accuracy and legitimacy', 'To increase sales', 'To delay recording', 'To replace the ledger'], 'To ensure accuracy and legitimacy'),
    ],
    'core-u2-l2': [
      mcq('In what order does the general journal record transactions?', ['Alphabetical', 'Chronological', 'By amount', 'By account number'], 'Chronological'),
      tf('The debit entry is written before the credit entry in a journal.', true),
      id('A journal entry with more than one debit or credit is a ______ entry.', 'compound'),
      mcq('Which details belong in a journal entry?', ['Date, accounts, amounts and explanation', 'The amount only', 'The account title only', 'The date only'], 'Date, accounts, amounts and explanation'),
    ],
    'core-u2-l3': [
      mcq('Which special journal records sales on account?', ['Sales journal', 'Cash receipts journal', 'Purchases journal', 'General journal'], 'Sales journal'),
      tf('Subsidiary ledgers show the balance of each individual customer or supplier.', true),
      id('The ledger summarizing all customer accounts receivable is the ______ ledger.', 'subsidiary'),
      mcq('Special journals are used mainly to:', ['Handle high volumes of similar transactions', 'Replace the trial balance', 'Record adjusting entries', 'Compute payroll tax'], 'Handle high volumes of similar transactions'),
    ],
    'core-u3-l1': [
      mcq('Posting means transferring entries from:', ['The journal to the ledger', 'The ledger to the journal', 'The trial balance to the journal', 'The bank to the books'], 'The journal to the ledger'),
      tf('Each ledger account keeps a running balance.', true),
      id('The journal page number written in the ledger is the ______ reference.', 'folio'),
      mcq('What is posted to the ledger for each entry?', ['The total only', 'The date, amount and journal reference', 'The account title only', 'The explanation only'], 'The date, amount and journal reference'),
    ],
    'core-u3-l2': [
      mcq('A trial balance lists:', ['Every account and its balance', 'Revenue accounts only', 'Cash transactions only', 'The chart of accounts'], 'Every account and its balance'),
      tf('If a trial balance does not balance, an error definitely exists.', true),
      id('The trial balance prepared before adjustments is the ______ trial balance.', 'unadjusted'),
      mcq('Which technique helps locate trial balance errors?', ['Recomputing balances and tracing postings', 'Ignoring the difference', 'Deleting entries', 'Changing the fiscal year'], 'Recomputing balances and tracing postings'),
    ],
    'core-u3-l3': [
      mcq('Which of these is an adjusting entry?', ['Recording depreciation for the period', 'Recording a cash sale', 'Paying a supplier', 'Opening a bank account'], 'Recording depreciation for the period'),
      tf('Unearned revenue is a liability until the service is performed.', true),
      id('Expenses already incurred but not yet paid are accrued ______.', 'expenses'),
      mcq('The worksheet is used to produce which output?', ['The adjusted trial balance', 'The bank statement', 'The payroll register', 'The purchase order'], 'The adjusted trial balance'),
    ],
    'core-u4-l1': [
      mcq('Gross profit equals:', ['Net sales - cost of goods sold', 'Net sales - operating expenses', 'Revenue + expenses', 'Assets - liabilities'], 'Net sales - cost of goods sold'),
      tf('A multi-step income statement separates operating from non-operating items.', true),
      id('The profit left after all expenses are deducted is ______ income.', 'net'),
      mcq('Which account appears on the income statement?', ['Service revenue', 'Accounts receivable', 'Owner\'s capital', 'Equipment'], 'Service revenue'),
    ],
    'core-u4-l2': [
      mcq('Which of these is a current asset?', ['Cash', 'Building', 'Equipment', 'Patent'], 'Cash'),
      tf('The statement of financial position reports assets, liabilities and equity at a point in time.', true),
      id('Assets minus liabilities equals ______.', 'equity'),
      mcq('Which item is a non-current liability?', ['Loan payable after five years', 'Accounts payable', 'Accrued wages', 'Prepaid rent'], 'Loan payable after five years'),
    ],
    'core-u4-l3': [
      mcq('A deposit in transit is:', ['Recorded in the books but not yet on the bank statement', 'A bank error', 'An outstanding check', 'A service charge'], 'Recorded in the books but not yet on the bank statement'),
      tf('Outstanding checks are deducted from the bank balance in a reconciliation.', true),
      id('Separating duties among employees is a form of internal ______.', 'control'),
      mcq('Which is a good internal control for cash?', ['One person handles and records all cash', 'Segregation of duties and regular reconciliation', 'No documentation', 'An annual audit only'], 'Segregation of duties and regular reconciliation'),
    ],
    'core-u4-l4': [
      mcq('Net pay equals:', ['Gross pay minus deductions', 'Gross pay plus deductions', 'Gross pay only', 'Deductions minus gross pay'], 'Gross pay minus deductions'),
      tf('Business records must be kept for the period required by law.', true),
      id('Deductions required by law such as SSS and PhilHealth are ______ deductions.', 'statutory'),
      mcq('Which document supports the payroll entries?', ['Payroll register', 'Sales invoice', 'Bank statement', 'Delivery receipt'], 'Payroll register'),
    ],
  },
}

// Resolve the question set for a lesson. Lesson ids are `${programId}-${suffix}`,
// so the suffix alone identifies the set: basic/common are shared, core is
// scoped to the program.
export function lessonQuizQuestions(programId, lessonId) {
  if (!programId || !lessonId) return null
  const prefix = `${programId}-`
  if (!lessonId.startsWith(prefix)) return null
  const suffix = lessonId.slice(prefix.length)
  return sharedLessonQuizzes[suffix] || coreLessonQuizzes[programId]?.[suffix] || null
}

export const lessonQuizTimeLimit = 15
