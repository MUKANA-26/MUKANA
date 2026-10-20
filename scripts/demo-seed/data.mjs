// Static content pools for the demo data: names, institutions, fields, companies, roles, post texts and photo ids.

export const FEMALE = ["Tendai", "Rutendo", "Chipo", "Nyasha", "Rudo", "Tsitsi", "Kudzai", "Vimbai", "Ruvimbo", "Tanaka", "Precious", "Memory", "Shamiso", "Mercy", "Faith", "Nomusa", "Sithembile", "Zanele", "Lindiwe", "Nobuhle", "Nokuthula", "Busisiwe", "Lungile", "Thandeka", "Primrose", "Tariro", "Chiedza", "Ropafadzo", "Natasha", "Sandra", "Melody", "Patience", "Chenai", "Danai", "Fadzai", "Gamuchirai", "Anesu", "Netsai", "Thabisile", "Mbali"];
export const MALE = ["Tafadzwa", "Tinashe", "Takudzwa", "Blessing", "Simbarashe", "Munashe", "Panashe", "Kudakwashe", "Tapiwa", "Tawanda", "Wellington", "Lloyd", "Nkosana", "Bhekithemba", "Sipho", "Themba", "Mthabisi", "Ndumiso", "Bongani", "Thabani", "Sibusiso", "Prince", "Brian", "Tatenda", "Farai", "Takunda", "Tonderai", "Rangarirai", "Leroy", "Anotida", "Joseph", "Collen", "Admire", "Shingirai", "Nigel", "Garikai", "Mandla", "Dumisani", "Vusa", "Mqondisi"];
export const SURNAMES = ["Moyo", "Ncube", "Dube", "Sibanda", "Ndlovu", "Nkomo", "Mpofu", "Mahlangu", "Chigumba", "Mutasa", "Chikwanha", "Mudzingwa", "Marufu", "Chinembiri", "Gumbo", "Mukucha", "Zhou", "Hove", "Mapfumo", "Makoni", "Banda", "Tshuma", "Khumalo", "Masuku", "Chitiyo", "Madziva", "Katsande", "Mutsvairo", "Nyathi", "Chirwa", "Mhlanga", "Zimunya", "Murombedzi", "Gwatidzo", "Chidavaenzi", "Mawere", "Chuma", "Maphosa", "Sithole", "Mavhunga", "Dzvairo", "Kanjere", "Mushonga", "Tembo", "Mabuza", "Zulu", "Gwenzi", "Chari", "Matiza", "Nyoni"];

export const INSTITUTIONS = [
  { name: "University of Zimbabwe", city: "Harare", province: "Harare" },
  { name: "National University of Science and Technology (NUST)", city: "Bulawayo", province: "Bulawayo" },
  { name: "Midlands State University", city: "Gweru", province: "Midlands" },
  { name: "Harare Institute of Technology", city: "Harare", province: "Harare" },
  { name: "Chinhoyi University of Technology", city: "Chinhoyi", province: "Mashonaland West" },
  { name: "Bindura University of Science Education", city: "Bindura", province: "Mashonaland Central" },
  { name: "Great Zimbabwe University", city: "Masvingo", province: "Masvingo" },
  { name: "Lupane State University", city: "Lupane", province: "Matabeleland North" },
  { name: "Africa University", city: "Mutare", province: "Manicaland" },
  { name: "Women's University in Africa", city: "Harare", province: "Harare" },
  { name: "Gwanda State University", city: "Gwanda", province: "Matabeleland South" },
  { name: "Harare Polytechnic", city: "Harare", province: "Harare" },
];

/** Study fields: programme names, skills and what the course work looks like. */
export const FIELDS = {
  cs: {
    field: "Computer Science",
    programmes: ["BSc Computer Science", "BSc Software Engineering", "BSc Information Systems"],
    skills: ["Python", "JavaScript", "SQL", "React", "Git", "Java", "Linux", "Networking", "Data Analysis", "Excel", "Problem Solving"],
    coursework: ["Data Structures", "Databases", "Operating Systems", "Software Engineering", "Web Development", "Computer Networks"],
    projects: [
      ["Student attendance tracker", "A web app that records lecture attendance with QR codes. Built with React and a SQL database."],
      ["Bus timetable app", "Mobile-friendly app showing commuter bus routes and times for Harare."],
      ["Inventory system for a tuckshop", "Stock, sales and low-stock alerts for a small shop, written in Python."],
      ["Final-year chatbot", "A helpdesk chatbot that answers common questions for university students."],
    ],
    certs: [["Python for Everybody", "Coursera", 2025], ["Cisco Networking Basics", "Cisco Networking Academy", 2024], ["Git and GitHub Essentials", "LinkedIn Learning", 2025]],
    headline: "Software student",
  },
  acc: {
    field: "Accounting",
    programmes: ["BCom Accounting", "BCom Accounting Honours", "BCom Banking and Finance"],
    skills: ["Excel", "Sage Pastel", "QuickBooks", "Financial Reporting", "Bookkeeping", "Budgeting", "Auditing", "Tax", "IFRS", "Communication"],
    coursework: ["Financial Accounting", "Management Accounting", "Auditing", "Taxation", "Corporate Finance"],
    projects: [
      ["Budgeting template for small businesses", "An Excel model for monthly budgets, cash flow and break-even analysis."],
      ["Audit case study", "Prepared an audit plan and working papers for a retail case company."],
    ],
    certs: [["ACCA Foundation papers", "ACCA", 2025], ["Excel for Finance", "Coursera", 2024], ["Sage Pastel Xpress", "Sage Training", 2025]],
    headline: "Accounting student",
  },
  civil: {
    field: "Civil Engineering",
    programmes: ["BEng Civil Engineering", "BSc Construction Management", "BEng Water Engineering"],
    skills: ["AutoCAD", "Surveying", "Structural Analysis", "Project Management", "Site Supervision", "Revit", "Concrete Technology", "Excel", "Report Writing"],
    coursework: ["Structural Analysis", "Soil Mechanics", "Hydraulics", "Surveying", "Concrete Design"],
    projects: [
      ["Low-cost housing design", "Designed a two-room low-cost house with bill of quantities."],
      ["Rural footbridge study", "Structural analysis and cost estimate for a footbridge over a seasonal river."],
    ],
    certs: [["AutoCAD Essentials", "Autodesk", 2025], ["Health and Safety on Site", "SAZ", 2024]],
    headline: "Civil engineering student",
  },
  elec: {
    field: "Electrical Engineering",
    programmes: ["BEng Electrical Engineering", "BEng Electronic Engineering", "BEng Telecommunications Engineering"],
    skills: ["Circuit Design", "PLC Programming", "MATLAB", "Power Systems", "AutoCAD", "Maintenance", "Fault Finding", "Networking", "Safety Procedures"],
    coursework: ["Circuit Theory", "Power Systems", "Control Systems", "Digital Electronics", "Machines"],
    projects: [
      ["Solar phone charging station", "A small solar charging kiosk with a battery monitor."],
      ["Automatic water pump controller", "Arduino-based controller that protects a borehole pump from dry running."],
    ],
    certs: [["PLC Programming Basics", "Siemens", 2025], ["Electrical Safety", "ZESA Training Centre", 2024]],
    headline: "Electrical engineering student",
  },
  mech: {
    field: "Mechanical Engineering",
    programmes: ["BEng Mechanical Engineering", "BEng Industrial and Manufacturing Engineering"],
    skills: ["SolidWorks", "AutoCAD", "Maintenance", "Quality Control", "Lean Manufacturing", "Thermodynamics", "Workshop Practice", "Excel"],
    coursework: ["Thermodynamics", "Machine Design", "Fluid Mechanics", "Manufacturing Processes"],
    projects: [
      ["Maize sheller", "Designed a hand-operated maize sheller for smallholder farmers."],
      ["Gearbox failure analysis", "Root-cause analysis for a conveyor gearbox failure."],
    ],
    certs: [["SolidWorks Associate", "Dassault Systèmes", 2025], ["Welding Fundamentals", "VTC", 2024]],
    headline: "Mechanical engineering student",
  },
  agri: {
    field: "Agriculture",
    programmes: ["BSc Agriculture", "BSc Agribusiness", "BSc Crop Science"],
    skills: ["Crop Science", "Farm Management", "Irrigation", "Soil Analysis", "Agribusiness", "Data Collection", "Excel", "Report Writing"],
    coursework: ["Soil Science", "Crop Production", "Agricultural Economics", "Irrigation Engineering"],
    projects: [
      ["Soya bean trial", "Field trial comparing three soya bean varieties under rain-fed conditions."],
      ["Farm gross-margin analysis", "Gross margins for tobacco, maize and horticulture on a model farm."],
    ],
    certs: [["Good Agricultural Practices", "Agritex", 2025], ["Drip Irrigation Design", "Harare Polytechnic", 2024]],
    headline: "Agriculture student",
  },
  mkt: {
    field: "Marketing",
    programmes: ["BCom Marketing", "BSc Business Management", "BCom Business Administration"],
    skills: ["Social Media Marketing", "Market Research", "Canva", "Sales", "Customer Service", "Communication", "Excel", "Content Writing"],
    coursework: ["Marketing Principles", "Consumer Behaviour", "Brand Management", "Business Statistics"],
    projects: [
      ["Campaign for a local bakery", "Social media campaign plan that grew a bakery's page by 40% in a month."],
      ["Customer survey", "Designed and analysed a 150-person customer satisfaction survey."],
    ],
    certs: [["Digital Marketing Fundamentals", "Google", 2025], ["Canva Design Essentials", "Canva", 2024]],
    headline: "Marketing student",
  },
  hr: {
    field: "Human Resource Management",
    programmes: ["BSc Human Resource Management", "BCom Human Resource Management"],
    skills: ["Recruitment", "Labour Law", "Payroll", "Excel", "Communication", "Training and Development", "Interviewing", "Report Writing"],
    coursework: ["Labour Relations", "Recruitment and Selection", "Organisational Behaviour", "Training and Development"],
    projects: [["Staff turnover study", "Survey and recommendations on staff turnover at a medium-sized firm."]],
    certs: [["HR Fundamentals", "IPMZ", 2025]],
    headline: "HR student",
  },
  mine: {
    field: "Mining Engineering",
    programmes: ["BEng Mining Engineering", "BSc Geology", "BEng Metallurgical Engineering"],
    skills: ["Geological Mapping", "Surveying", "Mine Planning", "Safety Management", "AutoCAD", "Data Analysis", "Excel", "Report Writing"],
    coursework: ["Rock Mechanics", "Mine Ventilation", "Mineral Processing", "Surveying"],
    projects: [
      ["Pit slope stability study", "Stability analysis for an open-pit wall using field mapping data."],
      ["Small-scale mining safety audit", "Safety audit and recommendations for a small gold mine."],
    ],
    certs: [["Mine Safety Induction", "Chamber of Mines", 2025], ["Surpac Basics", "Dassault Systèmes", 2024]],
    headline: "Mining student",
  },
  sc: {
    field: "Supply Chain Management",
    programmes: ["BCom Supply Chain Management", "BSc Logistics and Transport"],
    skills: ["Procurement", "Inventory Management", "Logistics Planning", "Excel", "SAP", "Negotiation", "Report Writing"],
    coursework: ["Procurement", "Warehouse Management", "Transport Economics", "Operations Management"],
    projects: [["Warehouse layout redesign", "Redesigned a warehouse layout to cut picking time by 20% in a simulation."]],
    certs: [["Supply Chain Foundations", "Coursera", 2025]],
    headline: "Supply chain student",
  },
  stat: {
    field: "Statistics",
    programmes: ["BSc Statistics", "BSc Data Science", "BSc Mathematics and Statistics"],
    skills: ["R", "Python", "SQL", "Power BI", "Statistics", "Excel", "Data Visualisation", "Report Writing"],
    coursework: ["Probability", "Regression Analysis", "Time Series", "Data Mining"],
    projects: [
      ["Maize yield forecasting", "Regression and time-series model for provincial maize yields."],
      ["Power BI dashboard", "Dashboard of public health indicators for Zimbabwe."],
    ],
    certs: [["Data Analysis with R", "Coursera", 2025], ["Power BI Fundamentals", "Microsoft", 2025]],
    headline: "Data and statistics student",
  },
  hosp: {
    field: "Hospitality and Tourism",
    programmes: ["BSc Hospitality and Tourism", "Diploma in Hotel and Catering"],
    skills: ["Customer Service", "Front Office", "Event Planning", "Communication", "Food Safety", "Team Leadership"],
    coursework: ["Front Office Operations", "Food and Beverage", "Tourism Planning"],
    projects: [["Heritage tour package", "Designed a two-day heritage tour package with a costed itinerary."]],
    certs: [["Food Safety Level 2", "ZTA", 2025]],
    headline: "Hospitality student",
  },
};

export const FIELD_KEYS = Object.keys(FIELDS);

export const QUALS = {
  bachelors: ["Bachelor of Science", "Bachelor of Commerce", "Bachelor of Engineering"],
};
export const DEGREE_CLASSES = ["first", "upper_second", "upper_second", "lower_second", "lower_second", "third"];

export const BIO_STARTS = [
  "Hardworking and curious",
  "Motivated and reliable",
  "Practical, organised and eager to learn",
  "Team player who enjoys solving real problems",
  "Detail-oriented and disciplined",
];

// -------------------------------------------------------------------------------- companies (real names; every one is marked as a demo)
// [name, industry, city, province, short]
export const COMPANIES = [
  ["Econet Wireless Zimbabwe", "Telecommunications", "Harare", "Harare", "Econet"],
  ["Delta Beverages", "Manufacturing", "Harare", "Harare", "Delta"],
  ["Old Mutual Zimbabwe", "Banking & Finance", "Harare", "Harare", "Old Mutual"],
  ["CBZ Bank", "Banking & Finance", "Harare", "Harare", "CBZ"],
  ["NMB Bank", "Banking & Finance", "Harare", "Harare", "NMB"],
  ["Zimplats", "Mining", "Ngezi", "Mashonaland West", "Zimplats"],
  ["Innscor Africa", "Manufacturing", "Harare", "Harare", "Innscor"],
  ["TelOne", "Telecommunications", "Harare", "Harare", "TelOne"],
  ["ZETDC", "Energy & Utilities", "Harare", "Harare", "ZETDC"],
  ["Hwange Colliery Company", "Mining", "Hwange", "Matabeleland North", "Hwange Colliery"],
  ["National Foods", "Manufacturing", "Harare", "Harare", "National Foods"],
  ["Cassava Smartech", "Information Technology", "Harare", "Harare", "Cassava"],
  ["Steward Bank", "Banking & Finance", "Harare", "Harare", "Steward"],
  ["FBC Bank", "Banking & Finance", "Harare", "Harare", "FBC"],
  ["Padenga Holdings", "Agriculture", "Harare", "Harare", "Padenga"],
  ["Seed Co", "Agriculture", "Harare", "Harare", "Seed Co"],
  ["Dairibord Zimbabwe", "Manufacturing", "Harare", "Harare", "Dairibord"],
  ["Meikles Limited", "Hospitality & Tourism", "Harare", "Harare", "Meikles"],
  ["OK Zimbabwe", "Retail & Wholesale", "Harare", "Harare", "OK Zimbabwe"],
  ["ZB Bank", "Banking & Finance", "Harare", "Harare", "ZB"],
  ["Zimbabwe Stock Exchange", "Banking & Finance", "Harare", "Harare", "ZSE"],
  ["Ariston Holdings", "Agriculture", "Marondera", "Mashonaland East", "Ariston"],
  ["Hippo Valley Estates", "Agriculture", "Chiredzi", "Masvingo", "Hippo Valley"],
  ["Mimosa Mining Company", "Mining", "Zvishavane", "Midlands", "Mimosa"],
  ["Unki Mine", "Mining", "Shurugwi", "Midlands", "Unki"],
  // The last five are left unverified so the admin verification flow can be tested.
  ["Air Zimbabwe", "Transport & Logistics", "Harare", "Harare", "Air Zimbabwe"],
  ["Mashonaland Holdings", "Construction & Engineering", "Harare", "Harare", "Mashonaland Holdings"],
  ["Willowvale Mazda Motor Industries", "Manufacturing", "Harare", "Harare", "WMMI"],
  ["CARE International Zimbabwe", "NGO & Development", "Harare", "Harare", "CARE"],
  ["Zimbabwe Fertiliser Company", "Manufacturing", "Harare", "Harare", "ZFC"],
];
export const UNVERIFIED_FROM = 25; // index of the first unverified company

export const COMPANY_BLURBS = {
  "Telecommunications": "Connectivity, mobile money and digital services for millions of customers.",
  "Manufacturing": "Manufacturing and distribution with graduate and attachment programmes across the plant and head office.",
  "Banking & Finance": "Retail, corporate and digital banking with structured trainee programmes.",
  "Mining": "Mining and processing operations with strong safety, geology and engineering teams.",
  "Energy & Utilities": "Power generation, transmission and distribution.",
  "Information Technology": "Software, fintech and cloud services built in Zimbabwe for Africa.",
  "Agriculture": "Farming, seed and agri-processing with research and field teams.",
  "Hospitality & Tourism": "Hotels, conferencing and tourism services.",
  "Retail & Wholesale": "Supermarkets, stores and supply chain across the country.",
  "Transport & Logistics": "Passenger and freight transport.",
  "Construction & Engineering": "Property, construction and engineering projects.",
  "NGO & Development": "Programmes in health, livelihoods and community development.",
};

/** Opportunity pools by industry: [type, title, field key list, extra skills, min level / qualification, paid?] */
const R = (type, title, fields, skills, minLevel, qual, paid) => ({ type, title, fields, skills, minLevel, qual, paid });
export const ROLES = {
  "Telecommunications": [
    R("industrial_attachment", "Network Operations Attachee", ["elec", "cs"], ["Networking", "Fault Finding"], 3.1, null, false),
    R("internship", "Software Development Intern", ["cs"], ["JavaScript", "Git"], 3.2, "bachelors", true),
    R("graduate_trainee", "Graduate Trainee: Data Analyst", ["stat", "cs"], ["SQL", "Power BI"], null, "bachelors", true),
    R("entry_level", "Customer Insights Analyst", ["stat", "mkt"], ["Excel", "Data Analysis"], null, "bachelors", true),
  ],
  "Manufacturing": [
    R("industrial_attachment", "Production Engineering Attachee", ["mech", "elec"], ["Maintenance", "Quality Control"], 3.1, null, false),
    R("graduate_trainee", "Graduate Trainee: Supply Chain", ["sc", "mkt"], ["Procurement", "Excel"], null, "bachelors", true),
    R("internship", "Quality Assurance Intern", ["mech", "agri"], ["Quality Control", "Report Writing"], 3.2, "bachelors", true),
    R("entry_level", "Production Planner", ["sc", "mech"], ["Excel", "Logistics Planning"], null, "bachelors", true),
  ],
  "Banking & Finance": [
    R("industrial_attachment", "Finance and Banking Attachee", ["acc"], ["Excel", "Financial Reporting"], 3.1, null, false),
    R("graduate_trainee", "Graduate Trainee: Banking Operations", ["acc", "mkt"], ["Customer Service", "Excel"], null, "bachelors", true),
    R("internship", "Internal Audit Intern", ["acc"], ["Auditing", "Excel"], 3.2, "bachelors", true),
    R("entry_level", "Credit Analyst", ["acc", "stat"], ["Financial Reporting", "Data Analysis"], null, "bachelors", true),
  ],
  "Mining": [
    R("industrial_attachment", "Mining Engineering Attachee", ["mine"], ["Surveying", "Safety Management"], 3.1, null, true),
    R("graduate_trainee", "Graduate Trainee: Metallurgy", ["mine", "mech"], ["Mineral Processing", "Excel"], null, "bachelors", true),
    R("internship", "Geology Intern", ["mine"], ["Geological Mapping", "AutoCAD"], 3.2, "bachelors", true),
    R("entry_level", "Safety, Health and Environment Officer", ["mine", "civil"], ["Safety Management", "Report Writing"], null, "bachelors", true),
  ],
  "Energy & Utilities": [
    R("industrial_attachment", "Electrical Maintenance Attachee", ["elec"], ["Power Systems", "Maintenance"], 3.1, null, false),
    R("graduate_trainee", "Graduate Trainee Engineer", ["elec", "mech", "civil"], ["AutoCAD", "Project Management"], null, "bachelors", true),
    R("internship", "Power Systems Intern", ["elec"], ["MATLAB", "Power Systems"], 3.2, "bachelors", true),
  ],
  "Information Technology": [
    R("industrial_attachment", "Software Engineering Attachee", ["cs"], ["Python", "SQL", "Git"], 2.2, null, true),
    R("internship", "Data Engineering Intern", ["cs", "stat"], ["SQL", "Python"], 3.1, "bachelors", true),
    R("graduate_trainee", "Graduate Trainee Developer", ["cs"], ["JavaScript", "React"], null, "bachelors", true),
    R("entry_level", "Junior QA Engineer", ["cs"], ["Testing", "Git"], null, "bachelors", true),
  ],
  "Agriculture": [
    R("industrial_attachment", "Agronomy Attachee", ["agri"], ["Crop Science", "Data Collection"], 3.1, null, false),
    R("graduate_trainee", "Graduate Trainee: Agribusiness", ["agri", "mkt"], ["Agribusiness", "Excel"], null, "bachelors", true),
    R("internship", "Research and Trials Intern", ["agri", "stat"], ["Data Collection", "Excel"], 3.2, "bachelors", true),
  ],
  "Hospitality & Tourism": [
    R("industrial_attachment", "Front Office Attachee", ["hosp"], ["Customer Service", "Front Office"], 2.2, null, false),
    R("graduate_trainee", "Graduate Trainee: Hotel Management", ["hosp", "mkt"], ["Team Leadership", "Customer Service"], null, "bachelors", true),
    R("internship", "Events and Conferencing Intern", ["hosp", "mkt"], ["Event Planning", "Communication"], 3.1, "bachelors", false),
  ],
  "Retail & Wholesale": [
    R("industrial_attachment", "Retail Operations Attachee", ["mkt", "sc"], ["Customer Service", "Inventory Management"], 2.2, null, false),
    R("graduate_trainee", "Graduate Trainee: Store Management", ["mkt", "sc", "hr"], ["Team Leadership", "Excel"], null, "bachelors", true),
    R("entry_level", "Merchandising Analyst", ["mkt", "stat"], ["Excel", "Market Research"], null, "bachelors", true),
  ],
  "Transport & Logistics": [
    R("industrial_attachment", "Logistics Attachee", ["sc"], ["Logistics Planning", "Excel"], 3.1, null, false),
    R("graduate_trainee", "Graduate Trainee: Operations", ["sc", "mech"], ["Operations", "Excel"], null, "bachelors", true),
  ],
  "Construction & Engineering": [
    R("industrial_attachment", "Site Engineering Attachee", ["civil"], ["AutoCAD", "Site Supervision"], 3.1, null, true),
    R("graduate_trainee", "Graduate Trainee: Project Engineer", ["civil", "mech"], ["Project Management", "AutoCAD"], null, "bachelors", true),
  ],
  "NGO & Development": [
    R("industrial_attachment", "Monitoring and Evaluation Attachee", ["stat", "agri", "hr"], ["Data Collection", "Report Writing"], 2.2, null, false),
    R("internship", "Programmes Support Intern", ["mkt", "hr", "agri"], ["Communication", "Report Writing"], 3.1, "bachelors", false),
    R("entry_level", "Community Development Officer", ["agri", "hr"], ["Communication", "Data Collection"], null, "bachelors", true),
  ],
};

export const SHIFT_LOCATIONS = { Harare: "Harare", Bulawayo: "Bulawayo" };

// -------------------------------------------------------------------------------- feed
export const TAGS_CAND = ["Attachment", "GraduateTrainee", "CVTips", "Interview", "Careers", "Internship", "Learning", "OpenToWork", "Zimbabwe", "Students"];
export const POSTS_CAND = [
  "Just finished updating my CV with the Mukana CV builder. Clean, one page, and it finally looks like me! {t} {t}",
  "Interview tomorrow morning, nervous but ready. I practised with the SAR method from the Learn page. Wish me luck! {t}",
  "Three things I learned while preparing my attachment applications:\n1. Apply early\n2. Tailor your CV to each role\n3. Follow up politely\n{t} {t}",
  "Completed the Excel basics quiz and earned my first skill badge today. Small win, big smile. {t}",
  "Looking for an attachment placement from January. Happy to relocate within Zimbabwe. If you know a team that is hiring, please point me their way. {t} {t}",
  "Our final-year project demo went better than expected. Thank you to everyone who tested the prototype. {t}",
  "Study group tonight at the library at 6pm, bring your notes! Anyone from my programme is welcome. {t}",
  "Reminder to myself and to you: your first job does not have to be your dream job. It has to teach you something. {t}",
  "Anyone have tips for a first video interview? Internet in my area is unreliable so I am planning a backup. {t}",
  "Spent the weekend learning Git properly. Branches finally make sense. {t}",
  "Grateful for the mentorship I got this week. If you are a student, ask for advice, people are kinder than you think. {t}",
  "Short thread on how I prepare for aptitude tests: practise daily for 20 minutes, time yourself, review mistakes. {t}",
  "Our department just announced the attachment placement dates. Time to get those applications in! {t}",
  "Finished my attachment logbook for the month. Writing every day really helps. {t}",
  "Does anyone know of graduate trainee programmes in Bulawayo? Asking for a friend (okay, for me). {t}",
  "Excited to share that I have joined a new study group on Mukana. Come and say hi! {t}",
  "Presenting my project to a panel next week. Practising in front of the mirror, and my cat. {t}",
  "Open to work: graduate looking for a trainee role in my field. Messages welcome. {t} {t}",
];
export const POSTS_COMPANY = [
  "[Demo post] We are building our next intake of attachees and graduate trainees. Check our open opportunities on Mukana. {t} {t}",
  "[Demo post] Tip from our recruiting team: tell us what you built, not only what you studied. Projects make CVs stand out. {t}",
  "[Demo post] Our teams welcomed this season's attachees today. Looking forward to learning from each other. {t}",
  "[Demo post] Join our free webinar on writing a CV that gets read. Details on the Events page. {t}",
  "[Demo post] Why we like hiring locally: the talent is here. Apply for our opportunities and show us what you can do. {t}",
  "[Demo post] Interview season is open. Keep your phone on and check Mukana for invitations. {t}",
];
export const COMMENTS = [
  "Congratulations! 👏", "Well done, keep going!", "This is really helpful, thank you for sharing.", "All the best!", "Following this, thanks.", "Great tip.", "Needed to read this today.", "Count me in!", "Nicely said.", "Inspiring, thank you!", "Good luck, you will do great.", "Sharing with my class.", "Can you share more details?", "Yes! Same here.", "Proud of you.", "Love this.", "Thanks for the advice.", "Well deserved.",
];
export const MESSAGES = [
  ["Hi! Saw your post about the attachment search. Any luck so far?", "Hello! Yes, I have two interviews next week. How about you?", "Applying to a few more this week. Let me know if you hear of any openings.", "Will do. Good luck with the interviews!"],
  ["Hey, are you joining the study group tonight?", "Yes, I will be there at 6. Bringing my notes.", "Perfect. See you there."],
  ["Hello, thank you for connecting. Your CV looks great!", "Thank you! The CV builder on Mukana made it easy.", "Could you share any tips for the aptitude tests?", "Practise a little every day and time yourself. It really helps."],
  ["Congratulations on the badge!", "Thanks! The quizzes are short and fun.", "Going to try the digital safety one now."],
  ["Hi, do you know anyone at a mining company looking for attachees?", "I can ask my lecturer. Send me your CV.", "Thank you so much."],
];
export const RECOMMENDATIONS = [
  "We worked together on a group project for a full semester. Reliable, well organised and always willing to help the team. I would happily work with them again.",
  "A quick learner who takes feedback well. Their final-year presentation was clear and confident. I recommend them for any role in their field.",
  "I have known them since our first year. They turn up on time, finish what they start and explain things patiently to classmates.",
  "Strong communicator and hard worker. During our attachment preparation they organised a study group that helped many of us.",
];
export const GROUPS = [
  ["Harare Tech Students", "Software, data and IT students and graduates in and around Harare. Share projects, tips and opportunities."],
  ["Accounting and Finance Careers", "Graduates and students in accounting and finance: ACCA tips, interview prep and openings."],
  ["Engineering Attachment Network", "Civil, electrical, mechanical and mining students looking for attachment placements."],
  ["Bulawayo Graduates", "Graduates and students based in Bulawayo and Matabeleland sharing job leads."],
  ["Agriculture and Agribusiness Zimbabwe", "Students and professionals in agriculture, research and agribusiness."],
];
export const GROUP_POSTS = [
  "Welcome everyone! Introduce yourself: your programme, your institution and what you are looking for.",
  "Weekly thread: share one opportunity you found this week.",
  "Does anyone have notes or past papers to share for the coming exams?",
  "Reminder: the career fair is coming up. Update your CV and your profile before then.",
  "What is one skill you are learning right now?",
];
export const MENTOR_TOPICS = [["Careers", "Interviews"], ["Software", "Data"], ["Accounting", "ACCA"], ["Engineering", "Attachment"], ["CV writing"], ["Mining", "Safety"], ["Agribusiness"], ["Marketing", "Branding"]];

/**
 * Free-to-use Unsplash photos (checked to load). Grouped by what they show so captions fit.
 * Use as https://images.unsplash.com/photo-<id>?w=1600&q=80
 */
export const PHOTOS = {
  team: ["1521737604893-d14cc237f11d", "1522071820081-009f0129c71c", "1517048676732-d65bc937f952", "1552664730-d307ca884978", "1600880292203-757bb62b4baf", "1542744173-8e7e53415bb0", "1504384308090-c894fdcc538d", "1553028826-f4804a6dba3b", "1568992687947-868a62a9f521", "1517245386807-bb43f82c33c4"],
  office: ["1556761175-5973dc0f32e7", "1553877522-43269d4ea984", "1519389950473-47ba0277781c", "1497032628192-86f99bcd76bc"],
  tech: ["1531482615713-2afd69097998", "1498050108023-c5249f4df085", "1454165804606-c3d57bc86b40", "1486312338219-ce68d2c6f44d", "1516321318423-f06f85e504b3", "1580894894513-541e068a3e2b", "1559526324-4b87b5e36e44"],
  study: ["1488190211105-8b0e65b80b4e", "1523240795612-9a054b0db644", "1524178232363-1fb2b075b655", "1434030216411-0b793f4b4173", "1509062522246-3755977927d7"],
  graduation: ["1541339907198-e08756dedf3f"],
  careers: ["1551836022-d5d88e9218df", "1521791136064-7986c2920216", "1565688534245-05d6b5be184a", "1522202176988-66273c2fd55f"],
  engineering: ["1581091226825-a6a2a5aee158", "1581092160562-40aa08e78837", "1532094349884-543bc11b234d"],
  covers: ["1497032628192-86f99bcd76bc", "1524178232363-1fb2b075b655", "1504384308090-c894fdcc538d", "1517048676732-d65bc937f952", "1556761175-5973dc0f32e7", "1553877522-43269d4ea984"],
};
