import {isoWeekLabel,isoWeekRange,addDays,beijingDate} from '../contracts/src/time.ts';
export function periodKey(kind:'weekly'|'monthly',now=Date.now()) {
 const date=beijingDate(now);
 if(kind==='weekly')return isoWeekLabel(addDays(date,-7));
 const first=new Date(date.slice(0,7)+'-01T00:00:00Z');first.setUTCMonth(first.getUTCMonth()-1);return first.toISOString().slice(0,7);
}
export function periodWindow(kind:'weekly'|'monthly',key:string) {
 if(kind==='weekly'){const range=isoWeekRange(key);if(!range)throw Error('周报日期无效');return {start:Date.parse(range.start+'T00:00:00+08:00'),end:Date.parse(addDays(range.end,1)+'T00:00:00+08:00')};}
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(key))throw Error('月报日期无效');const next=new Date(key+'-01T00:00:00Z');next.setUTCMonth(next.getUTCMonth()+1);return {start:Date.parse(key+'-01T00:00:00+08:00'),end:Date.parse(next.toISOString().slice(0,10)+'T00:00:00+08:00')};
}
