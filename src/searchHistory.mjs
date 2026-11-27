export const SEARCH_HISTORY_LIMIT=20;
/** @param {unknown} value @returns {string[]} */
export function normalizeSearchHistory(value){
 if(!Array.isArray(value))return [];
 const result=[],seen=new Set();
 for(const item of value){
  if(typeof item!=='string')continue;
  const query=item.trim();if(query.length<2||query.length>200)continue;
  const key=query.toLowerCase();if(seen.has(key))continue;
  seen.add(key);result.push(query);if(result.length===SEARCH_HISTORY_LIMIT)break;
 }
 return result;
}
/** @param {unknown} history @param {string} query */
export function rememberSearch(history,query){
 return normalizeSearchHistory([query,...normalizeSearchHistory(history)]);
}
