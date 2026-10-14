// Remove presentation markup, not meaningful punctuation, numbers or identifiers.
export function spokenText(text){
 if(typeof text!=='string')return '';
 return text.replace(/```[^\n]*\n([\s\S]*?)```/g,'$1')
  .replace(/!\[([^\]]*)\]\([^)]*\)/g,'$1').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1')
  .replace(/^\s{0,3}#{1,6}\s+/gm,'').replace(/^\s*[-*+]\s+/gm,'')
  .replace(/\*{1,3}(\S(?:[^*\n]*?\S)?)\*{1,3}/g,'$1').replace(/(?<!\w)_{1,3}(\S(?:[^_\n]*?\S)?)_{1,3}(?!\w)/g,'$1')
  .replace(/`([^`]+)`/g,'$1').replace(/^\s*>\s?/gm,'').trim();
}
