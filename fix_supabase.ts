import fs from 'fs';

let code = fs.readFileSync('App.tsx', 'utf8');

const regex = /(await supabase\.from\(['"][^'"]+['"]\)\.(?:insert|update|delete)(?:\(.*\)|[\s\S]*?)(?:\\.eq\(.*?\)|\.in\(.*?\)|\.lt\(.*?\))?);/g;

code = code.replace(regex, (match, p1) => {
   if (match.includes('.select(') || match.includes('then(') || match.includes('const {')) {
      return match;
   }
   return match.replace(/;$/, ".then(({error}) => { if (error) throw error; });");
});

fs.writeFileSync('App.tsx', code);
console.log("Replaced multi-line instances");
