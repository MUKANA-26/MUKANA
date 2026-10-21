// Skills Development Hub: short lessons written for Mukana.
// Body format: "## Heading", "- bullet", "1. numbered", "Tip: callout", **bold**. quiz = [question, [options], correctIndex, explanation]
export const LESSON_CATEGORIES = [
  ["career_basics", "Career basics", "CVs, cover letters and finding opportunities."],
  ["communication", "Communication", "Write, speak and listen like a professional."],
  ["workplace", "Workplace skills", "Be the attachee or trainee people want to keep."],
  ["digital", "Digital skills", "Excel, online safety and everyday tools."],
  ["finance", "Money and finance", "Manage your first salary and understand business money."],
  ["business", "Business skills", "Projects, customers and ideas."],
  ["technical", "Technical foundations", "Data and programming first steps."],
];

export const LESSONS = [
  {
    slug: "write-a-cover-letter", category: "career_basics", title: "Write a cover letter that gets read", level: "beginner", minutes: 8, skills: ["Writing", "Applications"],
    summary: "Four short paragraphs that make a recruiter want to open your CV.",
    body: `A cover letter (or the note you write when applying on Mukana) is your chance to explain why you fit **this** opportunity. Recruiters often read the first three lines and decide whether to continue.

## The four-paragraph structure
1. **Opening:** say what you are applying for and one sentence on who you are, for example "I am a third-year Civil Engineering student at NUST applying for your site engineering attachment."
2. **Fit:** pick two requirements from the advert and show evidence you meet them.
3. **Motivation:** one specific reason you want to work with this company.
4. **Close:** thank them, say your CV is attached, and that you are available to start on your dates.

## What to avoid
- Copying the same letter for every company
- Long paragraphs and big words
- Apologising ("I know I have no experience, but...")

Tip: Use the exact words from the advert for the skills you have. Many companies scan for them.

## Example middle paragraph
"The advert asks for Excel and report writing. In my final-year project I built a budget model in Excel with charts, and I wrote a 40-page report that earned a distinction."`,
    exercise: "Open an advert you like on Mukana. Write the four paragraphs in under 180 words. Read it aloud and cut anything that is not specific to that company.",
    quiz: [
      ["How long should a cover letter or application note usually be?", ["A full page of storytelling", "Short: about four brief paragraphs", "Just one word", "Three pages"], 1, "Recruiters read many applications. Short, specific notes get read."],
      ["What should the second paragraph do?", ["Repeat your whole CV", "Show evidence for two requirements in the advert", "Ask about salary", "Describe your hobbies"], 1, "Match your evidence to what they asked for."],
      ["Which is better to open with?", ["To whom it may concern, I need a job.", "I am applying for the X attachment and I am a Y student at Z.", "Please give me a chance.", "Dear Sir, hello."], 1, "Say what you apply for and who you are right away."],
    ],
  },
  {
    slug: "find-opportunities-and-follow-up", category: "career_basics", title: "Find opportunities and follow up", level: "beginner", minutes: 8, skills: ["Job search", "Networking"],
    summary: "A weekly routine for finding attachments, trainee programmes and jobs, and following up politely.",
    body: `Most students apply to a few places and wait. People who get placed treat the search like a weekly routine.

## A simple weekly routine
- **Monday:** check new opportunities on Mukana and save the ones that fit.
- **Tuesday to Thursday:** apply to two or three opportunities with a tailored note.
- **Friday:** follow up on applications from last week and update your CV or profile.

## Use more than one source
- Mukana opportunities and job alerts for your field
- Your institution's attachment office and lecturers
- Career fairs and events
- People you know: ask classmates, seniors and mentors

## Following up
If you applied a week ago and heard nothing, send a short message: thank them, restate your interest and ask whether they need anything else. One polite follow-up is professional. More than two is pestering.

Tip: Set a job alert on Mukana so new matching opportunities are sent to you.`,
    exercise: "Create a job alert for your field. Then write down five people (lecturers, seniors, relatives) you will ask about opportunities this month.",
    quiz: [
      ["How many follow-up messages are reasonable after applying?", ["None ever", "One or two, politely", "Daily until they reply", "Five a week"], 1, "A polite follow-up shows interest. Too many looks like pressure."],
      ["Why use several sources?", ["It is more tiring", "Opportunities come from different places, including people you know", "Employers prefer it", "You do not need to"], 1, "Many placements come through people and events, not only adverts."],
      ["What does a job alert do?", ["Deletes old jobs", "Notifies you when matching opportunities are published", "Writes your CV", "Sends your CV automatically"], 1, "You hear about matches as soon as they open."],
    ],
  },
  {
    slug: "attachment-logbook-and-report", category: "workplace", title: "Keep a strong attachment logbook and report", level: "beginner", minutes: 9, skills: ["Report writing", "Documentation"],
    summary: "Daily habits that make your logbook easy and your report excellent.",
    body: `Your attachment logbook and final report are assessed by your institution and also show employers how you think.

## Daily logbook habit
Spend five minutes at the end of every day writing:
- What tasks you did (be specific: "calibrated pressure gauge" not "helped in workshop")
- What you learned or found difficult
- Tools, equipment or software you used
- Any safety observations

Get your supervisor to sign and comment every week. Do not wait until the last weekend to fill in a month.

## Final report structure
1. Introduction and the company profile
2. Your departments and duties
3. Skills learned and how they link to your course
4. Challenges and how you handled them
5. Conclusion and recommendations
6. Appendices (photos, forms and charts, with permission)

Tip: Take permission before photographing anything and never include confidential data.

## Make it count
Write down numbers: how many machines you serviced, how many reports you prepared. Concrete results show the value of your attachment and become CV points later.`,
    exercise: "Start today: write three sentences about what you did yesterday at college or work using the logbook format. Repeat for a week.",
    quiz: [
      ["When is the best time to write the logbook?", ["At the end of each day", "Once a month", "After the attachment", "Never"], 0, "Short daily notes are more accurate and easier."],
      ["What should a final report link?", ["Only the company history", "Your tasks to what you studied", "Only photos", "Only pay"], 1, "The report shows how theory meets practice."],
      ["What must you do before taking photographs at work?", ["Nothing", "Get permission and avoid confidential data", "Post them online", "Delete the logbook"], 1, "Respect company confidentiality."],
    ],
  },
  {
    slug: "first-week-at-work", category: "workplace", title: "Your first week at a new workplace", level: "beginner", minutes: 7, skills: ["Professionalism", "Teamwork"],
    summary: "How to make a good first impression and learn fast.",
    body: `The first week sets the tone. You do not need to know everything, but you do need to show you are reliable and eager.

## Before day one
- Confirm the address, start time and who to ask for
- Plan transport and arrive 15 minutes early
- Dress smartly and modestly unless told otherwise
- Carry a notebook, pen, your ID and documents

## During the week
- **Introduce yourself** to people in your section and learn their names
- **Take notes** on instructions so you do not ask twice
- **Ask questions** early, after you have tried to find the answer
- **Observe** how people communicate and handle problems

## Do and don't
- Do keep your phone on silent and use it only for work or breaks
- Do thank people who help you
- Don't gossip or complain about the workplace
- Don't leave without telling your supervisor

Tip: At the end of the week ask your supervisor: "What is one thing I can do better next week?"`,
    exercise: "Write a short script for introducing yourself to a new team in 20 seconds: your name, your programme or role, and one thing you want to learn.",
    quiz: [
      ["How early should you arrive on the first day?", ["Exactly on time", "About 15 minutes early", "An hour late", "Whenever"], 1, "Arriving early shows reliability."],
      ["What is a good habit when given instructions?", ["Trust your memory", "Write them down", "Ignore them", "Ask the same question daily"], 1, "Notes save everyone time."],
      ["Which question helps you improve?", ["Why is the pay low?", "What is one thing I can do better next week?", "Can I go home early?", "Who is the worst colleague?"], 1, "Asking for feedback shows maturity."],
    ],
  },
  {
    slug: "professional-email", category: "communication", title: "Write professional emails and messages", level: "beginner", minutes: 7, skills: ["Written communication", "Email"],
    summary: "Clear subject lines, short messages and polite closings.",
    body: `Email and chat messages are how professionals judge you before they meet you.

## The anatomy of a good email
- **Subject:** specific, for example "Application: Industrial attachment, Jane Moyo"
- **Greeting:** "Dear Mr Dube," or "Good morning Ms Ncube,"
- **Purpose in the first line:** why you are writing
- **Details:** short paragraphs or bullet points
- **Closing:** "Kind regards," followed by your full name and phone number

## Quick rules
- Use a professional email address (name.surname, not nicknames)
- Keep it short and check spelling
- Attach files with clear names, for example "Jane-Moyo-CV.pdf"
- Reply within a day when you can

## WhatsApp at work
If a supervisor uses WhatsApp, keep messages short, polite and about work. Avoid voice notes unless they ask for them, and do not send jokes or forwards.

Tip: Read your message aloud before sending. If it sounds rude or confusing, rewrite it.`,
    exercise: "Write an email to a recruiter asking about the status of your application, in under 80 words.",
    quiz: [
      ["What makes a good subject line?", ["Hi", "URGENT!!!", "Specific: what it is and who it is from", "No subject"], 2, "A clear subject helps the reader file and find it."],
      ["Which email address looks most professional?", ["sweetgirl99@mail.com", "jane.moyo@mail.com", "jamo_lol@mail.com", "ladyj@mail.com"], 1, "Your name is the safest choice."],
      ["How should you name an attached CV file?", ["cv final final.pdf", "Jane-Moyo-CV.pdf", "document1.pdf", "IMG_2034.pdf"], 1, "Clear file names show care."],
    ],
  },
  {
    slug: "present-with-confidence", category: "communication", title: "Present with confidence", level: "beginner", minutes: 8, skills: ["Presentation", "Public speaking"],
    summary: "Structure, practice and body language for presentations and interviews.",
    body: `Presenting well helps in class, at work and in interviews.

## Plan in three parts
1. **Open:** one sentence that tells people why they should listen
2. **Middle:** no more than three key points, each with an example
3. **Close:** repeat the main message and say what happens next

## Slides
- One idea per slide and big text
- Use pictures and charts instead of paragraphs
- Do not read the slide word for word

## Delivery
- Stand tall, breathe, and pause between points
- Make eye contact with different people
- Speak slower than you think you need to
- It is normal to be nervous. Practise out loud at least three times.

Tip: If you lose your place, pause, take a breath and say "Let me return to my main point."

## If the power goes off
Have a plan B: a printed copy of your notes and the ability to explain without slides.`,
    exercise: "Choose a topic you know well and give a two-minute talk to a friend or your phone camera. Watch it and note one thing to improve.",
    quiz: [
      ["How many key points are best in a short talk?", ["Ten", "Up to three", "None", "As many as possible"], 1, "People remember a few clear points."],
      ["What is a good plan for a power cut during a presentation?", ["Cancel", "Have printed notes and be ready to speak without slides", "Wait for hours", "Read from the phone only"], 1, "Preparing for problems shows professionalism."],
      ["What should you do with your slides?", ["Read them word for word", "Use them as support, with few words", "Fill them with text", "Skip them"], 1, "Slides support you; they are not the talk."],
    ],
  },
  {
    slug: "teamwork-and-listening", category: "communication", title: "Teamwork and active listening", level: "beginner", minutes: 7, skills: ["Teamwork", "Listening"],
    summary: "How to work well with people, even when you disagree.",
    body: `Most work is done in teams. Employers rate teamwork and listening as top skills for graduates.

## Active listening
- Give your full attention and put your phone away
- Let the other person finish before you speak
- Repeat back what you heard: "So you need the report by Friday?"
- Ask questions to understand, not to argue

## Working with others
- Agree who does what and by when
- Share information early, including problems
- Give credit to others and say thank you
- Accept feedback without defending yourself

## When you disagree
1. Listen to the other view first
2. Focus on the goal you share
3. Suggest options and agree a test or a decision rule
4. Move on once decided

Tip: In meetings, summarise decisions and actions in a short message afterwards so nothing is forgotten.`,
    exercise: "In your next conversation, practise repeating back one sentence before replying. Notice how the other person responds.",
    quiz: [
      ["What is a good sign of active listening?", ["Interrupting often", "Repeating back what you heard", "Looking at your phone", "Changing the subject"], 1, "Repeating shows you understood."],
      ["What should you do first in a disagreement?", ["Win the argument", "Listen to the other view", "Walk away", "Complain to others"], 1, "Understand before you respond."],
      ["Why send a summary after a meeting?", ["To fill the inbox", "So decisions and actions are clear", "To impress the boss", "No reason"], 1, "Written summaries prevent confusion."],
    ],
  },
  {
    slug: "manage-your-time", category: "workplace", title: "Manage your time and priorities", level: "beginner", minutes: 8, skills: ["Time management", "Planning"],
    summary: "A simple system to get important things done on time.",
    body: `Good time management is not about being busy. It is about doing the right things at the right time.

## The weekly plan
1. On Sunday or Monday morning list everything you must do
2. Mark each task **Urgent** (deadline soon) and **Important** (matters for your goals)
3. Do Urgent and Important first, schedule Important but not urgent, delegate or drop the rest
4. Put tasks into time blocks in your calendar or notebook

## Daily habits
- Start with the hardest task while your energy is high
- Work in 25-minute blocks with 5-minute breaks
- Keep your phone on silent during focus blocks
- End the day by writing tomorrow's top three tasks

## When you are overloaded
Tell the people who depend on you early and ask which task matters most. Do not wait until the deadline.

Tip: A task that takes under two minutes should be done immediately instead of added to the list.`,
    exercise: "Write your top three tasks for tomorrow tonight. Do the first one before checking your phone.",
    quiz: [
      ["What should you do first?", ["Urgent and important tasks", "Easy tasks only", "Tasks others like", "Nothing"], 0, "These carry the highest cost if delayed."],
      ["What should you do if you cannot finish everything?", ["Say nothing", "Tell people early and ask for priorities", "Work through the night every day", "Quit"], 1, "Early communication prevents bigger problems."],
      ["What is a good focus technique?", ["Check social media every minute", "Work in 25-minute blocks with short breaks", "Multitask on five things", "Study with the TV on"], 1, "Short focused blocks improve concentration."],
    ],
  },
  {
    slug: "excel-formulas-essentials", category: "digital", title: "Excel essentials: formulas that matter", level: "beginner", minutes: 10, skills: ["Excel", "Data Analysis"],
    summary: "SUM, AVERAGE, IF, VLOOKUP and cell references explained with examples.",
    body: `Excel is used in almost every office. Learn these basics and you will stand out.

## Formulas start with =
- **=SUM(B2:B10)** adds a range
- **=AVERAGE(B2:B10)** gives the mean
- **=MAX(B2:B10)** and **=MIN(B2:B10)** find the highest and lowest
- **=COUNT(B2:B10)** counts numbers

## Making decisions with IF
**=IF(C2>=50,"Pass","Fail")** shows Pass when the score is 50 or more. You can combine conditions with AND and OR.

## Looking up values
**=VLOOKUP(A2, Table, 2, FALSE)** finds A2 in the first column of a table and returns the value from column 2. Use FALSE for exact matches. Newer Excel also has XLOOKUP.

## Cell references
- **B2** changes when you copy the formula (relative)
- **$B$2** stays fixed (absolute), useful for a tax rate cell
- **B$2** or **$B2** fix only the row or column

## Good habits
- Keep one table per sheet with headings in the first row
- Do not merge cells in data tables
- Check totals with a second method

Tip: Press F4 after clicking a cell reference to cycle through relative and absolute.`,
    exercise: "Build a simple monthly budget: list income and expenses, use SUM for totals and an IF to show 'Over budget' when expenses exceed income.",
    quiz: [
      ["What does =SUM(B2:B10) do?", ["Counts text", "Adds the numbers in B2 to B10", "Finds the biggest", "Sorts the data"], 1, "SUM adds a range."],
      ["What does $B$2 mean?", ["The cell moves when copied", "The reference stays fixed", "A dollar amount", "A comment"], 1, "Dollar signs lock the reference."],
      ["Which function checks a condition and returns different results?", ["SUM", "IF", "COUNT", "MAX"], 1, "IF tests a condition."],
    ],
  },
  {
    slug: "excel-tidy-data-and-pivot-tables", category: "digital", title: "Excel: tidy data and pivot tables", level: "intermediate", minutes: 10, skills: ["Excel", "Data Analysis", "Reporting"],
    summary: "Prepare a clean table and summarise it in seconds with a PivotTable.",
    body: `A PivotTable summarises thousands of rows into a short report in a few clicks, but only if your data is tidy.

## Tidy data checklist
- One row per record (for example one sale)
- One column per field (date, product, branch, amount)
- Headings in the first row, no blank rows or columns
- Consistent spelling ("Harare" not "harare" or "Hre")
- Dates as real dates and numbers as numbers, not text

## Create a PivotTable
1. Click any cell in your data
2. Insert, then PivotTable, then OK
3. Drag **Branch** to Rows, **Product** to Columns, **Amount** to Values
4. Right-click a value to change Sum to Count or Average
5. Use Slicers to filter by month or region

## Charts
Select the PivotTable and use PivotChart to turn the summary into a column or pie chart.

Tip: Refresh the PivotTable after changing the source data (right-click, Refresh).

## Common mistakes
- Totals that look wrong because numbers are stored as text
- New rows added below the data and not included in the range. Turn your data into a Table (Ctrl+T) so it grows automatically.`,
    exercise: "Take any list of sales or marks, convert it to a Table with Ctrl+T and build a PivotTable that shows totals by category.",
    quiz: [
      ["What should the first row of your data contain?", ["Blank cells", "Headings", "Totals", "Notes"], 1, "Headings are needed for PivotTables."],
      ["Why turn data into a Table (Ctrl+T)?", ["It looks nicer only", "It grows automatically when you add rows", "It deletes data", "It hides data"], 1, "Tables expand with new rows."],
      ["What does Refresh do on a PivotTable?", ["Updates it with changed source data", "Deletes it", "Prints it", "Closes Excel"], 0, "Pivot tables do not update on their own."],
    ],
  },
  {
    slug: "stay-safe-online", category: "digital", title: "Stay safe online while job hunting", level: "beginner", minutes: 7, skills: ["Digital safety", "Cyber awareness"],
    summary: "Spot fake job adverts, protect your accounts and your documents.",
    body: `Scammers target job seekers with fake adverts. Protect yourself.

## Red flags
- You are asked to pay a "registration", "interview" or "uniform" fee
- The advert promises high pay for little work
- The sender uses a free email address while claiming to be a big company
- You are rushed or asked to keep it secret

Genuine employers do not charge to hire you.

## Protect your accounts
- Use a long, unique password for each important account
- Turn on two-step verification in your Mukana settings
- Never share one-time codes sent to your phone
- Log out on shared computers

## Protect your documents
- Share your ID, bank and home address only after you are sure the employer is real
- Send CVs as PDF files
- Do not put your national ID number on a CV

Tip: If you are unsure, check the company profile and verified badge on Mukana, or ask a lecturer or mentor.`,
    exercise: "Turn on two-step verification on your email and on Mukana. Then write down three red flags you will watch for.",
    quiz: [
      ["A job asks for a fee to attend an interview. What do you do?", ["Pay quickly", "Treat it as a likely scam and report it", "Ask friends to pay", "Send your ID"], 1, "Real employers do not charge."],
      ["What is two-step verification?", ["Two passwords the same", "A second proof of identity such as a code from an app", "Two emails", "A bank account"], 1, "It blocks people who only have your password."],
      ["Should you put your national ID number on your CV?", ["Yes, always", "No", "Only on social media", "Yes, in the headline"], 1, "Keep sensitive identifiers private."],
    ],
  },
  {
    slug: "think-with-data", category: "technical", title: "Think with data", level: "beginner", minutes: 9, skills: ["Data Analysis", "Statistics"],
    summary: "Ask a question, find the data, clean it and explain the answer.",
    body: `Data skills are valuable in finance, agriculture, health, marketing and engineering.

## A simple process
1. **Ask:** what decision are we trying to make? ("Which product sells best in Bulawayo?")
2. **Collect:** gather the data from sales records, surveys or sensors
3. **Clean:** remove duplicates, fix spelling and handle missing values
4. **Analyse:** use totals, averages, percentages and charts
5. **Explain:** tell the story in plain words and recommend an action

## Basic measures
- **Mean** (average), **median** (middle) and **mode** (most common)
- **Range** shows how spread out values are
- Percentages and growth rates compare things of different sizes

## Charts that work
- Column charts for comparisons
- Line charts for change over time
- Pie charts only for a few shares of a whole

Tip: One chart, one message. Add a title that states the finding, such as "Sales rose 12% after the promotion".

## Be careful
Correlation does not prove cause. Always check the source and sample size of the data.`,
    exercise: "Find a small dataset (for example your last ten test marks). Calculate the mean and median, draw a line chart, and write two sentences about what you notice.",
    quiz: [
      ["What is the first step in a data task?", ["Draw a chart", "Ask the question you want to answer", "Buy software", "Delete data"], 1, "A clear question guides everything else."],
      ["Which chart shows change over time best?", ["Pie chart", "Line chart", "Table of text", "Map"], 1, "Line charts show trends."],
      ["Why clean data?", ["To make it look pretty", "Errors and duplicates give wrong answers", "It is required by law", "To shrink the file"], 1, "Dirty data leads to wrong conclusions."],
    ],
  },
  {
    slug: "python-first-steps", category: "technical", title: "Python: your first steps", level: "beginner", minutes: 12, skills: ["Python", "Programming", "Problem Solving"],
    summary: "Variables, decisions, loops and functions in plain language.",
    body: `Python is popular for data, automation and software development. This lesson explains the ideas. Try the examples in a free online editor or on your computer.

## Variables store values
A variable is a named box. For example, name = "Tendai" and marks = 72 store text and a number. Use print(name) to show it.

## Decisions with if
An if statement runs code only when a condition is true. For example: if marks >= 50, print "Pass", otherwise print "Fail". Indentation (the spaces at the start of a line) tells Python which lines belong to the if.

## Loops repeat work
A for loop repeats code for each item in a list. For example, for mark in [60, 45, 82]: check each mark and print the result. Loops save you from writing the same line many times.

## Functions package ideas
A function is a reusable block with a name. def average(numbers) can calculate the average of any list, and you can call it many times.

## Lists and dictionaries
- A **list** holds items in order: ["Harare", "Bulawayo", "Mutare"]
- A **dictionary** stores pairs: {"Harare": 2000, "Bulawayo": 1500}

Tip: Read error messages from the bottom up: the last line says what went wrong and the line above shows where.

## How to practise
Solve one small problem a day: a mark calculator, a unit converter, a simple budget. Keep your code on GitHub to show employers.`,
    exercise: "Write a program that asks for three marks, calculates the average and prints Pass if it is 50 or more. Then change it to use a function.",
    quiz: [
      ["What does a variable do?", ["Deletes data", "Stores a value under a name", "Draws a chart", "Opens a file"], 1, "Variables hold values."],
      ["Which keyword runs code only when a condition is true?", ["for", "if", "def", "print"], 1, "if tests a condition."],
      ["What is a function?", ["A reusable named block of code", "A comment", "A file type", "An error"], 0, "Functions make code reusable."],
    ],
  },
  {
    slug: "first-salary-budget", category: "finance", title: "Budget your first salary or allowance", level: "beginner", minutes: 8, skills: ["Budgeting", "Personal finance"],
    summary: "Needs, wants and saving: a simple plan that works on a small income.",
    body: `Whether you earn an attachment allowance or a first salary, a plan helps your money last.

## Step by step
1. **List your income** for the month (allowance, salary, support)
2. **List fixed costs:** rent, transport, data, groceries
3. **List variable costs:** clothes, outings, airtime
4. **Pay yourself first:** put a small amount aside for savings or emergencies, even 5 to 10 percent
5. **Track** what you spend for a month and adjust

## Tools
A notebook, a mobile money statement or a simple Excel sheet is enough. Check where small purchases add up.

## Good habits
- Build an emergency fund of one month's costs first
- Avoid borrowing for things you want but do not need
- Compare prices before buying data or transport passes
- Be careful with offers that promise fast returns: they are often scams

Tip: A budget is not a punishment. It is permission to spend on the things you value, without guilt.`,
    exercise: "Make a one-month budget for a typical allowance. Decide your savings amount first, then see what is left for everything else.",
    quiz: [
      ["What does 'pay yourself first' mean?", ["Spend on treats first", "Set aside savings before spending", "Pay others last", "Borrow money"], 1, "Savings come off the top."],
      ["What is an emergency fund for?", ["Shopping", "Unexpected costs like illness or repairs", "Gifts only", "Investments only"], 1, "It protects you from shocks."],
      ["What should you be careful about?", ["Offers promising fast, high returns", "Writing a budget", "Saving", "Tracking spending"], 0, "Fast-return schemes are often scams."],
    ],
  },
  {
    slug: "bookkeeping-basics", category: "finance", title: "Bookkeeping basics for small businesses", level: "beginner", minutes: 10, skills: ["Bookkeeping", "Accounting"],
    summary: "Record sales and expenses properly and read a simple profit statement.",
    body: `Every business, from a tuckshop to a factory, needs records.

## What to record
- **Sales:** date, customer, items, amount and how paid
- **Purchases and expenses:** date, supplier, item and amount, with receipts
- **Cash and bank:** every payment in and out

## The cash book
A cash book lists money received and paid in date order. At the end of the month, compare it with your bank or mobile money statement to find errors.

## A simple profit statement
- Sales **minus** cost of goods sold = **gross profit**
- Gross profit **minus** other expenses (rent, transport, wages, data) = **net profit**

## Keep proof
File receipts, invoices and statements by month. Number your invoices. Keep personal and business money separate.

Tip: Update your records weekly. Waiting until the end of the year makes mistakes more likely.

## Next steps
Learn a tool such as Excel, Sage or QuickBooks, and consider an accounting qualification (for example ACCA or a college certificate) if you want to build a career in this area.`,
    exercise: "Record one week of sales and expenses for an imaginary tuckshop in a table. Calculate gross profit and net profit.",
    quiz: [
      ["What is net profit?", ["Sales only", "Gross profit minus other expenses", "Cash in the bank", "Loans"], 1, "Net profit is what remains after all expenses."],
      ["Why keep personal and business money separate?", ["No reason", "It keeps records clear and accurate", "Tax forbids it", "Banks demand it"], 1, "Mixing them hides the real performance."],
      ["How often should you update records?", ["Weekly", "Every five years", "Never", "Only when audited"], 0, "Regular updates reduce errors."],
    ],
  },
  {
    slug: "project-management-basics", category: "business", title: "Project management basics", level: "intermediate", minutes: 9, skills: ["Project Management", "Planning"],
    summary: "Scope, schedule, budget and risks in plain language.",
    body: `A project is a temporary effort with a goal, a deadline and a budget. Building a classroom, launching an app or organising a graduation event are all projects.

## The five stages
1. **Initiate:** define the goal and who benefits
2. **Plan:** list tasks, owners, dates, costs and risks
3. **Execute:** do the work and communicate
4. **Monitor:** compare progress with the plan and adjust
5. **Close:** hand over, learn lessons and thank the team

## The triangle
Scope (what), time (when) and cost (how much) are linked. If you add scope, you need more time or money.

## Useful tools
- A task list with owners and deadlines
- A simple Gantt chart in Excel
- A risk list: what could go wrong, how likely, what will we do?
- A weekly status update: done, doing, problems

Tip: Break big tasks into pieces of no more than two days of work so progress is easy to see.

## Soft skills
Clear communication, fair sharing of work and calm problem solving matter as much as the tools.`,
    exercise: "Plan a one-day event for your class. List ten tasks, who does each, deadlines and two risks with a backup plan.",
    quiz: [
      ["What does the project triangle link?", ["Scope, time and cost", "Names, dates and places", "Boss, team and client", "Plan, do and rest"], 0, "Changing one affects the others."],
      ["Why keep a risk list?", ["To worry", "To plan responses before problems happen", "To delay work", "To impress"], 1, "Planning for risks saves time."],
      ["How big should a task be?", ["As large as possible", "Small enough to track, about two days or less", "Always a year", "No size"], 1, "Small tasks make progress visible."],
    ],
  },
  {
    slug: "great-customer-service", category: "business", title: "Great customer service", level: "beginner", minutes: 7, skills: ["Customer Service", "Communication"],
    summary: "Listen, solve and follow through, even with difficult customers.",
    body: `Customer service is part of almost every job, from banks to hotels to online support.

## The four steps
1. **Greet and listen:** smile, give full attention and let the customer explain
2. **Understand:** ask questions and repeat the problem back
3. **Solve:** offer a solution or explain what you can do and when
4. **Follow up:** make sure the problem is really solved

## Handling an upset customer
- Stay calm and do not take it personally
- Say "I understand" and "I am sorry for the problem"
- Focus on what you can do, not what you cannot
- If you do not know, say you will find out and give a time

## Written service
In emails and chat, reply quickly, keep sentences short and use the customer's name.

Tip: A customer who has a problem fixed well often becomes more loyal than one who never had a problem.`,
    exercise: "Write the exact words you would say to a customer whose order arrived late. Include an apology, a solution and a time.",
    quiz: [
      ["What is the first step with an upset customer?", ["Argue", "Listen and stay calm", "Walk away", "Blame the team"], 1, "Listening calms the situation."],
      ["What should you do if you do not know the answer?", ["Guess", "Say you will find out and give a time", "Ignore", "Hang up"], 1, "Honest follow-through builds trust."],
      ["Why follow up?", ["To check the problem is solved", "To waste time", "To sell more", "It is not needed"], 0, "Follow-up shows you care."],
    ],
  },
  {
    slug: "solve-problems-step-by-step", category: "workplace", title: "Solve problems step by step", level: "beginner", minutes: 8, skills: ["Problem Solving", "Critical thinking"],
    summary: "A five-step method for fixing problems at work or in your studies.",
    body: `Employers hire people who solve problems instead of only reporting them.

## The five steps
1. **Define the problem** clearly. What exactly is wrong, and since when?
2. **Find the causes.** Ask "why?" five times to reach the root.
3. **List options.** Aim for three possible solutions.
4. **Choose and test.** Pick the best option, try it on a small scale.
5. **Check and learn.** Did it work? What will you do differently next time?

## Tools
- A fishbone diagram groups causes by people, process, equipment and materials
- A pros and cons list compares options
- A checklist prevents the same error again

## Example
A water pump keeps tripping. Why? The motor overheats. Why? The vent is blocked. Why? Dust is not cleaned. Why? No maintenance schedule. Solution: add a weekly cleaning task.

Tip: Bring a possible solution, not just a problem, when you speak to your supervisor.`,
    exercise: "Choose a recurring problem (late submissions, a noisy study space) and apply the five steps on one page.",
    quiz: [
      ["What is the first step?", ["Blame someone", "Define the problem clearly", "Buy something", "Ignore it"], 1, "A clear definition keeps you on track."],
      ["What does asking 'why?' repeatedly help you find?", ["The root cause", "The cheapest option", "A friend", "A new job"], 0, "It moves past symptoms."],
      ["What should you bring to your supervisor?", ["Only the problem", "The problem and a possible solution", "A complaint", "Nothing"], 1, "Solutions show initiative."],
    ],
  },
  {
    slug: "validate-a-business-idea", category: "business", title: "Validate a business idea before you spend", level: "beginner", minutes: 9, skills: ["Entrepreneurship", "Market Research"],
    summary: "Test your idea with real people before investing money.",
    body: `Many small businesses fail because the owner built something nobody wanted. Test first.

## Questions to answer
- **Who** has the problem? (students, farmers, small shops)
- **What** is the problem and how do they solve it now?
- **Why** would they choose you? (price, quality, convenience)
- **How** will you reach them? (WhatsApp, flyers, referrals)

## Quick tests
1. Talk to ten potential customers. Ask about their problem, not about your idea.
2. Offer a simple version (a trial, a sample or a pre-order) and see who pays.
3. Count the costs honestly: stock, transport, data, your time
4. Calculate break-even: how many sales do you need to cover costs?

## Simple numbers
- Price minus cost per item = profit per item
- Fixed costs divided by profit per item = items needed to break even

Tip: Start small and keep your day job or studies while you learn. Reinvest early profits.

## Rules and support
Find out what registration, licences or permits your business needs and seek advice from small business support services.`,
    exercise: "Write your idea in one sentence. Interview three potential customers this week and note their answers. Calculate your break-even.",
    quiz: [
      ["What is the best first step?", ["Rent a shop", "Talk to potential customers", "Buy lots of stock", "Print signs"], 1, "Learn from real customers before spending."],
      ["What is break-even?", ["Sales needed to cover all costs", "Your profit", "A discount", "Your debt"], 0, "Beyond break-even you earn profit."],
      ["Why start small?", ["It is boring", "It reduces risk while you learn", "It is illegal to start big", "It gives free stock"], 1, "Small experiments are cheaper."],
    ],
  },
  {
    slug: "build-your-professional-profile", category: "career_basics", title: "Build a professional profile that gets noticed", level: "beginner", minutes: 8, skills: ["Personal branding", "Networking"],
    summary: "Use your Mukana profile, headline and network to attract opportunities.",
    body: `Your online profile is often the first thing an employer sees.

## Make your profile strong
- **Photo:** clear, friendly, plain background, dressed smartly
- **Headline:** say what you study or do and what you want, for example "BSc Computer Science student at UZ, seeking attachment in software development"
- **Skills:** list at least six real skills and ask friends to endorse them
- **Projects:** describe one or two things you built, with results
- **CV:** upload a clean one-page PDF

## Grow your network
- Connect with classmates, lecturers, seniors and people you meet at events
- Send a short note with each invitation
- Congratulate others and share useful tips
- Join a group in your field and take part

## Be professional
Post and message as if your future employer will read it, because they might.

Tip: Turn on "Open to work" so recruiters searching for candidates can find you, and keep your availability dates current.`,
    exercise: "Rewrite your headline in under 110 characters, then invite five people to connect with a personal note.",
    quiz: [
      ["What makes a good headline?", ["A single word", "What you study or do and what you want", "A joke", "Blank"], 1, "A headline explains you in one line."],
      ["How can you show skills credibly?", ["List skills with projects and endorsements", "Say nothing", "Copy someone else's", "Use only adjectives"], 0, "Proof beats claims."],
      ["What does 'Open to work' do?", ["Hides your profile", "Lets recruiters know you are looking", "Deletes your account", "Closes messages"], 1, "It signals you are available."],
    ],
  },
];
