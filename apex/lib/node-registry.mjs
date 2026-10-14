// Names, colours, coordinates and bends audited against upstream ReasoningWeb.jsx.
// Backend capabilities follow the user's revised responsibilities, not upstream demo claims.
/** @type {Array<[string,string,string,number,number,number,number,string,string,string]>} */
const rows = [
 ['chief_of_staff','Chief of staff','consultant',250,212,18,9,'Coordinate relevant specialists and combine their evidence into one answer.','routing,memory.read','Coherent answer and blocked decisions'],
 ['memory','Memory','consultant',452,250,-18,8,'Persist and retrieve explicit facts, preferences, decisions and unfinished tasks; correct and delete with approval.','memory.read,memory.write,memory.edit,memory.delete','Saved records with provenance, or retrieval results'],
 ['strategist','Strategist','consultant',296,118,-22,6.5,'Create roadmaps, compare options, prioritise milestones and risks using saved decisions.','memory.read','Roadmap, priorities and risks'],
 ['researcher','Researcher','consultant',182,150,24,6.5,'Investigate supplied and authorised sources; cite evidence and disclose unavailable live search.','project.read,web.search','Source-linked findings and uncertainties'],
 ['finance','Finance','consultant',436,148,-20,6.5,'Analyse supplied budgets, expenses and quotations; calculate without inventing missing figures.','finance.calculate','Calculation receipt and financial summary'],
 ['editor','Editor','consultant',584,208,-26,6.5,'Improve drafts while preserving meaning; flag unsupported claims.','supplied.text','Revised draft and review notes'],
 ['sales','Sales','doer',158,266,22,6.5,'Prepare proposals and follow-up drafts from real CRM records; never send without approval.','crm.read','Draft proposal or outreach, never a sending receipt'],
 ['marketing','Marketing','doer',195,298,22,6.5,'Develop campaigns and audience positioning with Researcher, Design and Analytics when relevant.','analytics.read','Campaign plan and content calendar'],
 ['ops','Ops','doer',232,330,20,6.5,'Save operational checklists, track tasks and blocked deadlines, and inspect configured Loops schedules.','tasks.read,crm.read,ops.read,ops.write','Persistent checklists, operational plan and blockers'],
 ['social_media','Social','doer',330,374,-16,6.5,'Prepare platform-specific captions, posts and scripts; publishing requires a connector and approval.','supplied.text','Draft content and schedule'],
 ['engineering','Engineering','doer',426,350,-18,6.5,'Inspect CPU, RAM, disk, network and assistant health; propose IT fixes without changing settings.','system.inspect','Measured diagnostics, limitations and proposed fixes'],
 ['design','Design','doer',502,312,-22,6.5,'Produce visual briefs, layouts, palettes and UI recommendations; image generation/editing needs a connected tool.','supplied.text','Visual brief, layout or palette'],
 ['developer','Developer','doer',118,356,26,6,'Read authorised project code, investigate errors, prepare isolated patches and run approved tests.','project.read,patch.prepare,tests.run','Patch artifact, development log and actual test receipt'],
 ['analytics','Analytics','tool',256,388,20,5.5,'Compute task completion rates, recorded response times and failures from local execution data.','analytics.read','Measured counts, rates and timing coverage'],
 ['crm','CRM','tool',414,392,-18,5.5,'Maintain local lead records, stages, interactions and follow-up dates in persistent SQLite.','crm.read,crm.write','Structured saved lead records; no external CRM claim'],
 ['calendar','Calendar','tool',560,356,-24,5.5,'Read connected Google Calendar schedules and overlapping events. Invites and shared-event changes are not connected.','calendar.read','Actual events, conflicts and coverage, or Not configured'],
 ['email','Email','tool',608,286,-26,5.5,'Search connected Gmail and read message text; read back exact recipient, subject and message before approved sending.','email.read,email.send','Actual messages or provider acceptance receipt, never a delivery claim'],
 ['drive','Drive','tool',582,132,24,5.5,'Search authorised Google Drive files and read Google Docs or text documents. Sharing/deletion remain disabled.','drive.read','Actual file metadata or document contents, or Not configured'],
];
export const NODE_REGISTRY=rows.map(([id,name,kind,x,y,bend,radius,capability,tools,output])=>({id,name,kind,x,y,bend,radius,capability,tools:tools.split(','),output,color:kind==='consultant'?'#00e5ff':kind==='doer'?'#f5a623':'#7f9bb3',type:kind==='tool'?'integration':'agent',permissions:'Read only by default. Explicit approval for sending, publishing, deleting, spending, tests, deployment or system changes.'}));
export const NODE_IDS=NODE_REGISTRY.map(n=>n.id);
export const TEXT_AGENTS=NODE_REGISTRY.filter(n=>n.type==='agent');
export const getNode=id=>NODE_REGISTRY.find(n=>n.id===id);
export const NODE_ROSTER=NODE_REGISTRY.map(n=>[n.id,n.name,n.kind,n.x,n.y,!['developer','analytics','email','drive'].includes(n.id),n.bend,n.radius]);
export const NODE_EXAMPLES={
 chief_of_staff:{message:'Create a roadmap for a personal project. Prioritise planning, implementation and testing; clearly mark assumptions.'},
 memory:{message:'Show saved facts and unfinished tasks',input:{operation:'read',query:''}},
 strategist:{message:'Compare a one-week prototype with a one-month implementation. Give a roadmap and risks.'},
 researcher:{message:'Find the official Python download page. Search and read the source; cite the returned URL.'},
 finance:{message:'Calculate these supplied example income and expense amounts',input:{items:[{type:'income',amount:100},{type:'expense',amount:35}]}},
 editor:{message:'Improve this draft while keeping its meaning: Please review the project plan and reply by Friday.'},
 sales:{message:'Review saved CRM leads and draft a follow-up for pending opportunities. Do not send anything.'},
 marketing:{message:'Draft a small campaign plan for APEX using available task metrics. Mark audience assumptions.'},
 ops:{message:'Show saved checklists, tasks and workflows',input:{operation:'read'}},
 social_media:{message:'Draft a concise launch caption for APEX. Do not publish.'},
 engineering:{message:'Inspect current CPU, RAM, disk and network measurements. Explain limitations and propose fixes only.'},
 design:{message:'Create a cyan and gold visual brief for a compact assistant HUD. Do not claim to generate an image.'},
 developer:{message:'Review the authorised node registry and suggest improvements without applying changes',input:{files:['lib/node-registry.mjs']}},
 analytics:{message:'Report measured completion rates and response times'},
 crm:{message:'Show saved local leads',input:{operation:'read'}},
 calendar:{message:'Read my upcoming Google Calendar events and identify recorded overlaps',input:{operation:'read'}},
 email:{message:'Read my latest Gmail inbox messages',input:{operation:'read',query:'in:inbox'}},
 drive:{message:'List authorised Google Drive files',input:{operation:'read'}}
};
