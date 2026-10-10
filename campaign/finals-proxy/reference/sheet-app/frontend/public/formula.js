'use strict';
// Small expression parser. No JavaScript evaluation or formula-specific canned values.
(function () {
  const failure = code => { throw { code }; };
  const numeric = v => v !== '' && v != null && String(v).trim() !== '' && !isNaN(Number(v));
  const column = name => {let n=0;for(const c of name.toUpperCase())n=n*26+c.charCodeAt(0)-64;return n-1;};
  const letter = c => {let s='';for(let n=c+1;n>0;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
  const coord = text => {const m=/^\$?([A-Za-z]{1,3})\$?([1-9][0-9]*)$/.exec(text);if(!m)failure('#REF!');return {c:column(m[1]),r:Number(m[2])-1};};
  function tokens(source) {
    const out=[];let i=0;
    while(i<source.length){
      const rest=source.slice(i);let m;
      if((m=/^\s+/.exec(rest))){i+=m[0].length;continue;}
      if((m=/^"((?:""|[^"])*)"/.exec(rest))){out.push({t:'string',v:m[1].replace(/""/g,'"')});i+=m[0].length;continue;}
      if((m=/^'((?:''|[^'])*)'/.exec(rest))){out.push({t:'sheet',v:m[1].replace(/''/g,"'")});i+=m[0].length;continue;}
      if((m=/^(?:\d+(?:\.\d*)?|\.\d+)/.exec(rest))){out.push({t:'number',v:Number(m[0])});i+=m[0].length;continue;}
      if((m=/^#[A-Z0-9/]+[!?]/.exec(rest))){out.push({t:'error',v:m[0]});i+=m[0].length;continue;}
      if((m=/^[A-Za-z_$][A-Za-z0-9_.$]*/.exec(rest))){out.push({t:'word',v:m[0]});i+=m[0].length;continue;}
      if((m=/^(?:>=|<=|<>|[+\-*/&=><():,!])/.exec(rest))){out.push({t:m[0]});i+=m[0].length;continue;}
      failure('#ERROR!');
    }
    return out;
  }
  function parse(source) {
    const list=tokens(source);let at=0;
    const peek=t=>list[at]?.t===t;
    const take=t=>{if(!peek(t))failure('#ERROR!');return list[at++];};
    const precedence={'=':1,'<>':1,'>':1,'<':1,'>=':1,'<=':1,'&':2,'+':3,'-':3,'*':4,'/':4,':':5};
    function atom(){
      const t=list[at++];if(!t)failure('#ERROR!');
      if(['number','string','error'].includes(t.t))return {kind:t.t,value:t.v};
      if(t.t==='+'||t.t==='-')return {kind:'unary',op:t.t,value:atom()};
      if(t.t==='('){const value=expr(0);take(')');return value;}
      if(t.t==='word'||t.t==='sheet'){
        if(peek('!')){at++;const ref=take('word').v;coord(ref);return {kind:'ref',sheet:t.v,ref:ref.replace(/\$/g,'').toUpperCase()};}
        if(t.t==='sheet')failure('#REF!');
        if(peek('(')){
          at++;const args=[];
          if(!peek(')')){for(;;){args.push(expr(0));if(!peek(','))break;at++;}}
          take(')');return {kind:'call',name:t.v.toUpperCase(),args};
        }
        if(/^\$?[A-Za-z]{1,3}\$?\d+$/.test(t.v)){coord(t.v);return {kind:'ref',ref:t.v.replace(/\$/g,'').toUpperCase()};}
        if(['TRUE','FALSE'].includes(t.v.toUpperCase()))return {kind:'boolean',value:t.v.toUpperCase()==='TRUE'};
        return {kind:'name',name:t.v};
      }
      failure('#ERROR!');
    }
    function expr(min){let left=atom();while((precedence[list[at]?.t]||0)>min){const op=list[at++].t;left={kind:op===':'?'range':'binary',op,left,right:expr(precedence[op])};}return left;}
    const tree=expr(0);if(at!==list.length)failure('#ERROR!');return tree;
  }
  const scalar = v => Array.isArray(v)?(v[0]??''):v;
  function number(v){v=scalar(v);if(typeof v==='number')return v;if(typeof v==='boolean')return v?1:0;return numeric(v)?Number(v):0;}
  function criterion(value,rule) {
    const match=/^(>=|<=|<>|>|<|=)?(.*)$/.exec(String(rule)),op=match[1]||'=',term=match[2];
    const a=numeric(value)&&numeric(term)?Number(value):String(value).toLowerCase();
    const b=numeric(value)&&numeric(term)?Number(term):term.toLowerCase();
    return op==='='?a===b:op==='<>'?a!==b:op==='>'?a>b:op==='<'?a<b:op==='>='?a>=b:a<=b;
  }
  function makeValuer(sheet,workbook) {
    const cache=new Map(),busy=new Set();
    const sheets=(workbook?.sheets||[sheet]).map(s=>s.id===sheet.id?sheet:s);
    function target(name,current){if(!name)return current;const s=sheets.find(s=>s.name.toLowerCase()===name.toLowerCase());if(!s)failure('#REF!');return s;}
    function value(s,ref){
      const pos=coord(ref);if(pos.r>=1000||pos.c>=702)failure('#REF!');
      const key=s.id+':'+ref;
      if(cache.has(key)){const c=cache.get(key);if(c.error)failure(c.error);return c.value;}
      if(busy.has(key))failure('#REF!');busy.add(key);
      try{const raw=String(s.cells?.[ref]??'');const out=raw.startsWith('=')?evaluate(parse(raw.slice(1)),s):numeric(raw)?Number(raw):raw;cache.set(key,{value:out});return out;}
      catch(e){cache.set(key,{error:e.code||'#ERROR!'});throw e;}
      finally{busy.delete(key);}
    }
    function range(s,start,end){const a=coord(start),b=coord(end),out=[];for(let r=Math.min(a.r,b.r);r<=Math.max(a.r,b.r);r++)for(let c=Math.min(a.c,b.c);c<=Math.max(a.c,b.c);c++)out.push(value(s,letter(c)+(r+1)));return out;}
    function evaluate(node,s){
      if(['number','string','boolean'].includes(node.kind))return node.value;
      if(node.kind==='error')failure(node.value);
      if(node.kind==='ref')return value(target(node.sheet,s),node.ref);
      if(node.kind==='name'){
        const n=(workbook?.namedRanges||[]).find(n=>n.name.toLowerCase()===node.name.toLowerCase());if(!n)failure('#NAME?');
        const ns=sheets.find(s=>s.id===n.sheetId);if(!ns)failure('#REF!');const refs=n.range.split(':');return range(ns,refs[0],refs[1]||refs[0]);
      }
      if(node.kind==='range'){
        if(node.left.kind!=='ref'||node.right.kind!=='ref')failure('#REF!');
        const ss=target(node.left.sheet,s);if(node.right.sheet&&target(node.right.sheet,s)!==ss)failure('#REF!');return range(ss,node.left.ref,node.right.ref);
      }
      if(node.kind==='unary')return number(evaluate(node.value,s))*(node.op==='-'?-1:1);
      if(node.kind==='binary'){
        const a=scalar(evaluate(node.left,s)),b=scalar(evaluate(node.right,s));
        if(node.op==='&')return String(a)+String(b);
        if(['=','<>','>','<','>=','<='].includes(node.op))return criterion(a,node.op+String(b));
        const x=number(a),y=number(b);if(node.op==='+')return x+y;if(node.op==='-')return x-y;if(node.op==='*')return x*y;if(y===0)failure('#DIV/0!');return x/y;
      }
      if(node.kind==='call'){
        const n=node.name,args=node.args;
        if(n==='IF'){if(args.length<2||args.length>3)failure('#ERROR!');return evaluate(args[scalar(evaluate(args[0],s))?1:2]||{kind:'boolean',value:false},s);}
        if(n==='IFERROR'){if(args.length!==2)failure('#ERROR!');try{return evaluate(args[0],s);}catch(e){return evaluate(args[1],s);}}
        if(!['SUM','AVERAGE','COUNT','MIN','MAX','COUNTIF','SUMIF'].includes(n))failure('#NAME?');
        const vals=args.map(a=>evaluate(a,s));
        if(n==='COUNTIF'||n==='SUMIF'){
          if(vals.length<(n==='SUMIF'?2:2)||vals.length>3)failure('#ERROR!');
          const criteria=[vals[0]].flat(),rule=scalar(vals[1]),sums=[vals[2]??vals[0]].flat();
          return criteria.reduce((total,v,i)=>total+(criterion(v,rule)?n==='COUNTIF'?1:typeof sums[i]==='number'?sums[i]:0:0),0);
        }
        const nums=vals.flat().filter(v=>typeof v==='number');
        if(n==='COUNT')return nums.length;if(n==='SUM')return nums.reduce((a,b)=>a+b,0);
        if(n==='AVERAGE'){if(!nums.length)failure('#DIV/0!');return nums.reduce((a,b)=>a+b,0)/nums.length;}
        return nums.length?(n==='MIN'?Math.min(...nums):Math.max(...nums)):0;
      }
      failure('#ERROR!');
    }
    const val=ref=>{try{return scalar(value(sheet,ref));}catch(e){return e.code||'#ERROR!';}};
    val.raw=ref=>String(sheet.cells?.[ref]??'');return val;
  }
  window.SheetFormula={makeValuer};
})();
