// Each activity is something a reader can choose to explore. It describes a
// task in the cited occupation, independent of the historical worker's title.
export const explorerRecords = [
  {
    id: 'computer-support',
    title: 'Computer support specialist',
    tags: ['fix', 'explain', 'investigate'],
    task: 'Listen to someone describe a computer problem, narrow down what went wrong, and explain a fix they can follow.',
    taskSource: {
      title: 'O*NET · What user support specialists do',
      url: 'https://www.onetonline.org/link/summary/15-1232.00'
    },
    experiment: 'Imagine a phone plays music but makes no sound. On paper, list three questions you would ask its owner. Pick one answer and write the next thing you would check.',
    door: {
      person: 'Joseph Thompson',
      year: '1951',
      story: 'MIT chose Thompson from a group of local high school students to operate the Whirlwind computer. Jack Gilmore taught him to run programs from punched tape. You can read Thompson’s own account of learning on the job.',
      source: {
        title: 'Thompson’s oral history, pages 8–10',
        url: 'https://archive.computerhistory.org/resources/access/text/2019/02/102738731-05-01-acc.pdf#page=8'
      },
      limit: 'Thompson worked in computer operations at MIT. How Black workers first entered a particular help desk is a separate question.'
    },
    next: 'Compare the hands-on and team leadership directions on the IT career map. Which daily task would you like to try?',
    pathUrl: '/career-map/'
  },
  {
    id: 'technical-writing',
    title: 'Technical writer',
    tags: ['explain', 'fix', 'design', 'organize'],
    task: 'Find out how something works, turn it into instructions, and revise unclear steps or illustrations.',
    taskSource: {
      title: 'O*NET · What technical writers do',
      url: 'https://www.onetonline.org/link/details/27-3042.00'
    },
    experiment: 'Draw a shape made of four squares. Hide it and write instructions for drawing it. Ask someone to follow only your words, or follow them yourself on fresh paper. Rewrite the first confusing step.',
    door: {
      person: 'Katherine Johnson',
      year: '1960',
      story: 'Johnson and Ted Skopinski wrote a NASA report explaining how to send a satellite over a chosen spot on Earth. NASA says she was the first woman in its Flight Research Division credited as an author of a research report.',
      source: {
        title: 'NASA · How Johnson gained author credit',
        url: 'https://www.nasa.gov/people-of-nasa/katherine-g-johnson/'
      },
      artifact: {
        title: 'Read their original NASA report',
        url: 'https://ntrs.nasa.gov/api/citations/19980227091/downloads/19980227091.pdf'
      },
      limit: 'Johnson was a mathematician writing about her research. Her byline documents authorship at NASA. Hiring into technical writer jobs has its own history.'
    },
    next: 'Pick a guide you use at home or school. Find one step a newcomer might misunderstand and rewrite it in your own words.'
  },
  {
    id: 'electrician',
    title: 'Electrician',
    tags: ['fix', 'investigate', 'design'],
    task: 'Read drawings, plan where equipment belongs, and use tests to find faults in electrical systems.',
    taskSource: {
      title: 'O*NET · What electricians do',
      url: 'https://www.onetonline.org/link/summary/47-2111.00'
    },
    experiment: 'On paper, sketch a reading room with two lamps and two switches. Invent a symbol for each. Use a legend to show which switch controls each lamp, then ask someone to read the plan.',
    door: {
      person: 'Sam Taylor and Charles Vernon Stewart III',
      year: '1922',
      story: 'Publishers refused to send electrical lessons to Black readers. A friend ordered the lessons so Taylor and Stewart could study. Stewart later helped his stepfather Taylor start Taylor Electric in Chicago.',
      source: {
        title: 'The HistoryMakers · Stewart’s account and interview',
        url: 'https://www.thehistorymakers.org/biography/charles-stewart-iii'
      },
      limit: 'This account describes how Taylor and Stewart learned. It leaves open how any individual electrician joined the company.'
    },
    next: 'Open the Chicago path and find two different decisions: who selects apprentices today, and who hires electricians?',
    pathUrl: '/preview/p/electrician/?example=1#who-decides'
  },
  {
    id: 'registered-nurse',
    title: 'Registered nurse',
    tags: ['care', 'organize', 'investigate'],
    task: 'Listen to a patient, notice changes, plan care with a team, and record what the next nurse needs to know.',
    taskSource: {
      title: 'O*NET · What registered nurses do',
      url: 'https://www.onetonline.org/link/summary/29-1141.00'
    },
    experiment: 'A fictional patient named Alex says, “My room is noisy and I feel worried.” On paper, write two questions you would ask Alex. Write a handoff note that separates what Alex said from what you still need to ask.',
    door: {
      person: 'Anna B. Coles',
      year: '1968',
      story: 'Coles graduated from the Freedmen’s Hospital nursing school. In 1968 she became the first dean of Howard University’s College of Nursing. The school’s alumni recorded that change in who led nursing education.',
      source: {
        title: 'Freedmen’s Hospital nursing alumni · School history',
        url: 'https://www.fhsnac.org/about.html'
      },
      limit: 'The alumni record names a graduate who became a dean. It leaves open which graduates were hired by the hospital.'
    },
    next: 'Open the Howard nursing path. Which decision belonged to the university’s trustees, and which work did Coles lead?',
    pathUrl: '/preview/p/registered-nurse/?example=1#decisions'
  },
  {
    id: 'public-school-teacher',
    title: 'High school teacher',
    tags: ['care', 'explain', 'design', 'organize'],
    task: 'Design a lesson, explain an idea in more than one way, and use students’ questions to decide what to try next.',
    taskSource: {
      title: 'O*NET · What high school teachers do',
      url: 'https://www.onetonline.org/link/summary/25-2031.00'
    },
    experiment: 'Choose a rule from a game you know. Teach it with one example and one drawing on paper. Ask a learner when the rule would apply, or write the question you would use to check their understanding.',
    door: {
      person: 'Charles Lincoln Harper',
      year: '1924',
      story: 'Atlanta opened its first public high school for Black students. As its first principal, Harper hired teachers for the new school. The school’s historic nomination preserves the account of his role.',
      source: {
        title: 'Georgia historic nomination · School record, page 7',
        url: 'https://npgallery.nps.gov/GetAsset/9814b816-e5bd-4513-8b58-415d397c5297#page=7'
      },
      limit: 'This record names who hired teachers at this Atlanta school. Another school needs its own hiring record.'
    },
    next: 'Open the Atlanta teacher path. Find the decision Harper could make and a question the school record leaves open.',
    pathUrl: '/p/k12-teacher/?example=1#path-preview'
  }
];
