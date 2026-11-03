// A transition source describes the possible move; the role source describes the work.
const supportOutlook = {
  label: 'BLS · Advancement from computer support',
  url: 'https://www.bls.gov/ooh/computer-and-information-technology/computer-support-specialists.htm#tab-4'
};
const systemsOutlook = {
  label: 'BLS · Advancement from systems administration',
  url: 'https://www.bls.gov/ooh/computer-and-information-technology/network-and-computer-systems-administrators.htm#tab-4'
};
const managerTasks = {
  label: 'O*NET · IT management duties',
  url: 'https://www.onetonline.org/link/summary/11-3021.00'
};

export const startingPoints = [
  {
    id:'support', name:'User support', example:'I help people solve technology problems.',
    source:{label:'O*NET · User support duties',url:'https://www.onetonline.org/link/summary/15-1232.00'},
    transition:supportOutlook,
    moves:[
      {
        branch:'Technical work', name:'Systems administrator',
        change:'You move from fixing an individual user’s problem to maintaining the systems and networks many people depend on.',
        practice:'Pick a recurring support problem. Sketch which devices and services it touches, then write down what you would check first.',
        local:'Ask who assigns systems work and which skills a support specialist needs to demonstrate.',
        evidence:{label:'BLS · Systems administrator duties',url:'https://www.bls.gov/ooh/computer-and-information-technology/network-and-computer-systems-administrators.htm#tab-2'}
      },
      {
        branch:'People management', name:'Support team manager',
        change:'You shift from resolving your own requests to coordinating the people and resources that keep support running.',
        practice:'Draft a plan for a busy shift. Decide which requests need attention first, who could handle them, and when someone should escalate.',
        local:'Ask who selects team managers and whether coaching, scheduling or staff reviews are part of the role.',
        evidence:managerTasks
      }
    ]
  },
  {
    id:'systems', name:'Systems and networks', example:'I keep shared systems or networks running.',
    source:{label:'O*NET · Systems administration duties',url:'https://www.onetonline.org/link/summary/15-1244.00'},
    transition:systemsOutlook,
    moves:[
      {
        branch:'Technical work', name:'Network architect',
        change:'You move from maintaining a network to designing the connections, capacity and reliability it will need in the future.',
        practice:'Sketch a network for a small office. Explain one design choice and how people would stay connected if a component failed.',
        local:'Ask who reviews network designs and what a first design assignment looks like.',
        evidence:{label:'BLS · Network architecture duties',url:'https://www.bls.gov/ooh/computer-and-information-technology/computer-network-architects.htm#tab-2'}
      },
      {
        branch:'People management', name:'IT manager',
        change:'You help decide which technology projects a team undertakes, how to staff them, and what resources it needs.',
        practice:'Outline a system upgrade in one page. Name the users affected, people needed, tradeoffs and decision to make.',
        local:'Ask who approves projects, who manages staff and who controls the budget for this position.',
        evidence:managerTasks
      }
    ]
  }
];

export const responsibilities = [
  {id:'learning',titles:{support:'Help desk trainee',systems:'Network support trainee'},examples:{support:'Shadow a support specialist as they diagnose a ticket.',systems:'Practice a network check or restore a backup under supervision.'},name:'Learning on the job',description:'You practice a task with guidance and check your work with someone experienced.',question:'Who can let me practice one part of this work with supervision?'},
  {id:'practitioner',titles:{support:'User support specialist',systems:'Systems administrator'},examples:{support:'Own a support request from the first conversation through the fix.',systems:'Take responsibility for a system change and verify that services recovered.'},name:'Working independently',description:'You take responsibility for your own assignments and complete them independently.',question:'Which assignment could I own to show that I am ready for more responsibility?'},
  {id:'lead',titles:{support:'Technical support lead',systems:'Network technical lead'},examples:{support:'Guide colleagues through difficult tickets and review their fixes.',systems:'Coordinate the technical response to an outage and mentor other administrators.'},name:'Leading technical work',description:'You guide technical decisions or coach colleagues. A lead may do this without having direct reports.',question:'Is there a technical lead or specialist track here, and how do people qualify for it?'},
  {id:'supervisor',titles:{support:'Service desk supervisor',systems:'Systems team supervisor'},examples:{support:'Schedule the support team, coach staff and review their work.',systems:'Assign work and coach the people who keep the network running.'},name:'Supervising a team',description:'You oversee the work of individual team members. The job may include scheduling, coaching and reviewing their work.',question:'Which decisions about people and staffing would I have authority to make?'},
  {id:'middle',titles:{support:'Manager of support teams',systems:'Infrastructure department manager'},examples:{support:'Coordinate several support teams and negotiate staffing across them.',systems:'Set priorities across infrastructure teams with different technical leads.'},name:'Middle management',description:'You coordinate managers, multiple teams or a department and translate broader priorities into their work.',question:'Which leads or teams would report to me, and which decisions would still need approval?'},
  {id:'executive',titles:{support:'IT director or chief information officer',systems:'Infrastructure director or chief technology officer'},examples:{support:'Set service priorities and decide where to invest across the organization.',systems:'Make organization-wide decisions about infrastructure investment and risk.'},name:'Executive leadership',description:'You help set organization-wide technology priorities and investment decisions.',question:'Which budgets and priorities would this position control across the organization?'},
  {id:'unsure',titles:{support:'',systems:''},examples:{support:'Think of a difficult ticket. Did you resolve it, guide another person, or decide how a team handled it?',systems:'Think of the last outage. Did you fix the system, coordinate the work, or decide where to invest?'},name:'I’m not sure yet',description:'Start with your day-to-day responsibilities. A title like “network manager” can mean managing infrastructure, people, or both.',question:'What does this role own, who reports to it, and who approves the next move?'}
];
