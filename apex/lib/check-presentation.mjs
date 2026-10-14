/** @type {Array<[string, number]>} */
export const CHECK_PRESENTATION_STAGES=[['existing',0],['fade',1.5],['core',2.5],['intensity',3.5],['connections',5],['nodes',6],['circuits',7],['waves',8],['shockwave',13],['settle',14.5],['completed',15.5]];
export function checkPresentationStage(seconds,completed=false){const stage=CHECK_PRESENTATION_STAGES.findLast(([,time])=>seconds>=time)?.[0]||'existing';return stage==='completed'&&!completed?'waiting':stage;}
export function revealedCheckCount(seconds,total){return Math.max(0,Math.min(total,Math.floor((seconds-3.5)/.32)+1));}
export function checkOutcome(report){return report?.state==='completed'&&report.checks.length>0&&report.checks.every(c=>c.state==='passed')?'passed':report?.state==='completed'?'warning':'pending';}
