// Local, deterministic job recommendations. This intentionally uses a small
// demo catalogue so the feature works without Adzuna credentials or AI quota.

const JOBS = [
  { id: 'demo-1', title: 'Frontend Developer', company: 'Harbour Digital', location: 'Sydney, NSW', workMode: 'Hybrid', jobType: 'Full-time', salaryMin: 90000, salaryMax: 125000, currency: 'AUD', skills: ['JavaScript', 'React', 'HTML', 'CSS', 'Git'], description: 'Build accessible React applications using JavaScript, HTML, CSS and Git in an agile product team.' },
  { id: 'demo-2', title: 'Full Stack Developer', company: 'Southern Cross Tech', location: 'Melbourne, VIC', workMode: 'Hybrid', jobType: 'Full-time', salaryMin: 105000, salaryMax: 145000, currency: 'AUD', skills: ['JavaScript', 'React', 'Node.js', 'Express', 'SQL', 'Git'], description: 'Develop React interfaces and Node.js APIs backed by SQL, with testing and continuous delivery.' },
  { id: 'demo-3', title: 'Backend Developer', company: 'Cloud Gum', location: 'Brisbane, QLD', workMode: 'Remote', jobType: 'Full-time', salaryMin: 100000, salaryMax: 140000, currency: 'AUD', skills: ['Node.js', 'Express', 'Python', 'SQL', 'REST APIs'], description: 'Design reliable REST APIs and services using Node.js, Express, Python and relational databases.' },
  { id: 'demo-4', title: 'Data Analyst', company: 'Insight Australia', location: 'Sydney, NSW', workMode: 'Hybrid', jobType: 'Full-time', salaryMin: 80000, salaryMax: 110000, currency: 'AUD', skills: ['SQL', 'Excel', 'Python', 'Power BI', 'Data Analysis'], description: 'Turn business data into insights using SQL, Excel, Python and Power BI dashboards.' },
  { id: 'demo-5', title: 'Business Analyst', company: 'Meridian Consulting', location: 'Canberra, ACT', workMode: 'Hybrid', jobType: 'Contract', salaryMin: 95000, salaryMax: 130000, currency: 'AUD', skills: ['Requirements Gathering', 'Stakeholder Management', 'Agile', 'Jira', 'Data Analysis'], description: 'Work with stakeholders to document requirements, improve processes and deliver agile technology projects.' },
  { id: 'demo-6', title: 'Project Coordinator', company: 'Pacific Projects', location: 'Melbourne, VIC', workMode: 'On-site', jobType: 'Full-time', salaryMin: 75000, salaryMax: 100000, currency: 'AUD', skills: ['Project Management', 'Communication', 'Microsoft Office', 'Scheduling', 'Stakeholder Management'], description: 'Coordinate schedules, reporting, stakeholders and delivery activities across multiple projects.' },
  { id: 'demo-7', title: 'Customer Success Specialist', company: 'BrightPath Software', location: 'Australia', workMode: 'Remote', jobType: 'Full-time', salaryMin: 70000, salaryMax: 95000, currency: 'AUD', skills: ['Customer Service', 'Communication', 'CRM', 'Problem Solving', 'Sales'], description: 'Help customers adopt software through strong communication, CRM management and practical problem solving.' },
  { id: 'demo-8', title: 'Digital Marketing Coordinator', company: 'Koala Creative', location: 'Sydney, NSW', workMode: 'Hybrid', jobType: 'Full-time', salaryMin: 70000, salaryMax: 95000, currency: 'AUD', skills: ['Digital Marketing', 'SEO', 'Social Media', 'Google Analytics', 'Content'], description: 'Plan content and campaigns across SEO, social media and analytics channels.' },
  { id: 'demo-9', title: 'Operations Supervisor', company: 'Metro Hospitality Group', location: 'Sydney, NSW', workMode: 'On-site', jobType: 'Full-time', salaryMin: 75000, salaryMax: 100000, currency: 'AUD', skills: ['Leadership', 'Operations', 'Customer Service', 'Team Management', 'Scheduling'], description: 'Lead daily operations, customer service, team performance, rostering and continuous improvement.' },
  { id: 'demo-10', title: 'Restaurant Manager', company: 'Table & Co.', location: 'Sydney, NSW', workMode: 'On-site', jobType: 'Full-time', salaryMin: 75000, salaryMax: 95000, currency: 'AUD', skills: ['Hospitality', 'Leadership', 'Customer Service', 'Team Management', 'Food Safety'], description: 'Manage restaurant operations, guest experience, food safety and a high-performing service team.' },
];

function parse(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try { return JSON.parse(value); } catch (_) { return [String(value)]; }
}

function resumeText(resume) {
  return [resume.summary, resume.skills, resume.experience, resume.education,
    resume.projects, resume.certifications]
    .flatMap(parse)
    .map((value) => typeof value === 'string' ? value : JSON.stringify(value))
    .join(' ')
    .toLowerCase();
}

function recommendJobs(resume, limit = 8) {
  const text = resumeText(resume);
  const recommendations = JOBS.map((job) => {
    const matchedSkills = job.skills.filter((skill) => text.includes(skill.toLowerCase()));
    const missingSkills = job.skills.filter((skill) => !matchedSkills.includes(skill));
    const titleTerms = job.title.toLowerCase().split(/\s+/).filter((term) => term.length > 3);
    const titleMatches = titleTerms.filter((term) => text.includes(term)).length;
    const matchScore = Math.min(96, Math.round(
      25 + (matchedSkills.length / job.skills.length) * 60 +
      (titleMatches / Math.max(titleTerms.length, 1)) * 11
    ));
    const reason = matchedSkills.length
      ? `Your experience with ${matchedSkills.slice(0, 3).join(', ')} aligns with this role.`
      : 'This is an adjacent role worth exploring based on your broader experience.';
    return { job, matchScore, matchedSkills, missingSkills: missingSkills.slice(0, 3), reason };
  }).sort((a, b) => b.matchScore - a.matchScore).slice(0, limit);

  const suggestedRoles = [...new Set(recommendations.slice(0, 5).map((item) => item.job.title))];
  return { recommendations, suggestedRoles, source: 'local_rules' };
}

module.exports = { recommendJobs };
